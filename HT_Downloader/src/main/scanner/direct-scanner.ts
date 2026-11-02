import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import type { SourceType, VideoFormat, VideoItem } from '../../shared/types';
import { AppError } from '../utils/app-error';

interface Candidate { url: string; title: string; thumbnail?: string; referer?: string }
const mediaExtension = /\.(?:mp4|webm|mov|m3u8|mpd)(?:$|[?#])/i;
const idFor = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 16);

export class DirectScanner {
  async scan(pageUrl: string): Promise<{ title?: string; videos: VideoItem[] }> {
    const response = await fetchWithLimit(pageUrl, 5_000_000);
    const html = await response.text();
    if (/widevine|fairplay|playready|com\.microsoft\.playready/i.test(html)) throw new AppError('DRM_PROTECTED', 'DRM protected content is not supported.');
    const $ = cheerio.load(html);
    const pageTitle = $('title').first().text().trim() || undefined;
    const thumbnail = attr($, 'meta[property="og:image"]', 'content');
    const candidates = new Map<string, Candidate>();
    const add = (raw: string | undefined, title = pageTitle ?? 'Detected video'): void => {
      if (!raw) return;
      try { const url = new URL(raw, pageUrl).toString(); if (/^https?:/.test(url) && mediaExtension.test(url)) candidates.set(url, { url, title, thumbnail }); } catch { /* Invalid embedded URL. */ }
    };
    $('video[src], video source[src], source[src]').each((_index, node) => add($(node).attr('src')));
    ['meta[property="og:video"]', 'meta[property="og:video:url"]', 'meta[name="twitter:player:stream"]'].forEach(selector => add(attr($, selector, 'content')));
    $('script[type="application/ld+json"]').each((_index, node) => {
      try { visitJson(JSON.parse($(node).text()), value => add(value)); } catch { /* Ignore malformed page metadata. */ }
    });
    return { title: pageTitle, videos: await Promise.all([...candidates.values()].map(candidate => this.normalize(candidate))) };
  }

  async scanMediaUrl(url: string, title: string, thumbnail?: string, referer?: string): Promise<VideoItem> {
    return this.normalize({ url, title, thumbnail, referer });
  }

  private async normalize(candidate: Candidate): Promise<VideoItem> {
    const pathname = new URL(candidate.url).pathname.toLowerCase();
    const sourceType: SourceType = pathname.endsWith('.m3u8') ? 'hls' : pathname.endsWith('.mpd') ? 'dash' : 'direct';
    let formats: VideoFormat[];
    if (sourceType === 'hls') formats = await parseHls(candidate.url, candidate.referer);
    else if (sourceType === 'dash') formats = await parseDash(candidate.url, candidate.referer);
    else formats = [{ id: `direct:${idFor(candidate.url)}`, qualityLabel: 'Original', extension: extension(candidate.url), hasVideo: true, hasAudio: true, sourceUrl: candidate.url, protocol: 'https', referer: candidate.referer }];
    formats = formats.map(format => ({ ...format, referer: candidate.referer }));
    return { id: idFor(candidate.url), title: candidate.title, thumbnail: candidate.thumbnail, sourceType, sourceUrl: candidate.url, formats };
  }
}

function attr($: cheerio.CheerioAPI, selector: string, name: string): string | undefined { return $(selector).first().attr(name); }
function visitJson(value: unknown, add: (url: string) => void): void {
  if (Array.isArray(value)) return value.forEach(item => visitJson(item, add));
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (['contentUrl', 'embedUrl'].includes(key) && typeof item === 'string') add(item);
    else visitJson(item, add);
  }
}
function extension(url: string): string | undefined { return new URL(url).pathname.split('.').pop()?.toLowerCase(); }

async function fetchWithLimit(url: string, maximum: number, referer?: string): Promise<Response> {
  const headers: Record<string, string> = { 'User-Agent': 'HT-Downloader/1.0' }; if (referer) headers.referer = referer;
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000), headers });
  if (!response.ok) throw new AppError('PAGE_INACCESSIBLE', `Could not access page (HTTP ${response.status}).`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > maximum) throw new AppError('PAGE_INACCESSIBLE', 'The page response is too large to scan safely.');
  return response;
}

async function parseHls(url: string, referer?: string): Promise<VideoFormat[]> {
  const text = await (await fetchWithLimit(url, 2_000_000, referer)).text();
  if (/EXT-X-KEY:.*KEYFORMAT=(?:"?com\.apple\.streamingkeydelivery|"?urn:uuid)/i.test(text)) throw new AppError('DRM_PROTECTED', 'DRM protected content is not supported.');
  const lines = text.split(/\r?\n/); const formats: VideoFormat[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].startsWith('#EXT-X-STREAM-INF:')) continue;
    const attrs = lines[index].slice(lines[index].indexOf(':') + 1);
    const resolution = attrs.match(/RESOLUTION=(\d+)x(\d+)/i); const fps = attrs.match(/FRAME-RATE=([\d.]+)/i);
    const next = lines.slice(index + 1).find(line => line.trim() && !line.startsWith('#'));
    if (!next) continue;
    const sourceUrl = new URL(next.trim(), url).toString(); const height = resolution ? Number(resolution[2]) : undefined;
    formats.push({ id: `hls:${idFor(sourceUrl)}`, qualityLabel: height ? `${height}p${fps && Number(fps[1]) > 30 ? ` • ${Math.round(Number(fps[1]))} FPS` : ''}` : 'Adaptive', width: resolution ? Number(resolution[1]) : undefined, height, fps: fps ? Number(fps[1]) : undefined, extension: 'mp4', hasVideo: true, hasAudio: true, sourceUrl, protocol: 'm3u8' });
  }
  return formats.length ? formats.sort((a, b) => (b.height ?? 0) - (a.height ?? 0)) : [{ id: `hls:${idFor(url)}`, qualityLabel: 'Adaptive', extension: 'mp4', hasVideo: true, hasAudio: true, sourceUrl: url, protocol: 'm3u8' }];
}

async function parseDash(url: string, referer?: string): Promise<VideoFormat[]> {
  const text = await (await fetchWithLimit(url, 3_000_000, referer)).text();
  if (/ContentProtection/i.test(text)) throw new AppError('DRM_PROTECTED', 'DRM protected content is not supported.');
  const data = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(text) as Record<string, unknown>;
  const representations: Record<string, unknown>[] = [];
  collectRepresentations(data, representations);
  const formats = representations.filter(item => Number(item['@_height']) > 0).map((item, index): VideoFormat => {
    const height = Number(item['@_height']); const width = Number(item['@_width']) || undefined;
    return { id: `dash:${String(item['@_id'] ?? index)}:${height}`, qualityLabel: `${height}p`, width, height, extension: 'mp4', videoCodec: String(item['@_codecs'] ?? ''), hasVideo: true, hasAudio: false, sourceUrl: url, protocol: 'dash' };
  });
  return formats.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
}
function collectRepresentations(value: unknown, output: Record<string, unknown>[]): void {
  if (Array.isArray(value)) return value.forEach(item => collectRepresentations(item, output));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) { if (key === 'Representation') (Array.isArray(child) ? child : [child]).forEach(item => { if (item && typeof item === 'object') output.push(item as Record<string, unknown>); }); else collectRepresentations(child, output); }
}
