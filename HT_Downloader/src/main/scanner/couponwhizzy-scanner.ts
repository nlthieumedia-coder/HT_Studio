import * as cheerio from 'cheerio';
import type { VideoItem } from '../../shared/types';
import { AppError } from '../utils/app-error';
import { DirectScanner } from './direct-scanner';

const host = 'couponwhizzy.com';
const watchPath = /^\/movies\/w\/[^/]+\/\d+\/?$/;
const seriesPath = /^\/movies\/s\/[^/]+\/?$/;
const maximumPageBytes = 5_000_000;

export function isCouponWhizzyUrl(value: string): boolean {
  try { return new URL(value).hostname === host; } catch { return false; }
}

/**
 * Whizzy creates a short-lived HLS URL only after its playback endpoint has
 * authorised an episode. This scanner uses that documented browser flow for
 * episodes available without a purchase; a 403 paywall response is skipped.
 */
export class CouponWhizzyScanner {
  constructor(private readonly directScanner: DirectScanner) {}

  async scan(pageUrl: string, maxVideos = 10, displayTitle = pageUrl): Promise<{ title?: string; videos: VideoItem[] }> {
    const page = await getPage(pageUrl);
    const $ = cheerio.load(page.html);
    const title = $('title').first().text().replace(/\s*[·|]\s*Whizzy\s*$/i, '').trim() || undefined;
    let targets = watchPath.test(new URL(page.url).pathname) ? [page] : await pagesForUrls(watchUrls($, page.url));
    // The landing page lists series, not episodes. Follow only enough series
    // pages to satisfy the requested scan limit.
    if (!targets.length) {
      const seriesPages = await pagesForUrls(seriesUrls($, page.url).slice(0, maxVideos));
      const urls = seriesPages.flatMap(series => watchUrls(cheerio.load(series.html), series.url));
      targets = await pagesForUrls(urls.slice(0, maxVideos));
    }
    if (!targets.length) return { title, videos: [] };

    const videos: VideoItem[] = [];
    for (const episode of targets.slice(0, maxVideos)) {
      const episodeId = extractEpisodeId(episode.html);
      if (!episodeId) continue;
      const playback = await getPlayback(episode.url, episodeId);
      if (!playback) continue; // The site reports locked episodes as HTTP 403.
      const episodeTitle = cheerio.load(episode.html)('title').first().text().replace(/\s*[·|]\s*Whizzy\s*$/i, '').trim()
        || `${title ?? 'Whizzy'} — episode`;
      const thumbnail = await getThumbnail(episode.html, episode.url);
      videos.push(await this.directScanner.scanMediaUrl(playback, displayTitle, thumbnail, episode.url));
    }
    return { title, videos };
  }
}

function watchUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
  return pageUrls($, baseUrl, watchPath);
}

function seriesUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
  return pageUrls($, baseUrl, seriesPath);
}

function pageUrls($: cheerio.CheerioAPI, baseUrl: string, pattern: RegExp): string[] {
  const urls = new Set<string>();
  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const url = new URL(href, baseUrl);
    if (url.hostname === host && pattern.test(url.pathname)) urls.add(url.toString());
  });
  return [...urls];
}

async function pagesForUrls(urls: string[]): Promise<Array<{ url: string; html: string }>> {
  return Promise.all(urls.map(getPage));
}

function extractEpisodeId(html: string): string | undefined {
  return html.match(/episodeId\\?"\s*:\\?"([0-9a-f-]{36})\\?"/i)?.[1];
}

async function getPlayback(pageUrl: string, episodeId: string): Promise<string | undefined> {
  const apiUrl = new URL('/movies/api/playback', pageUrl);
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'HT-Downloader/1.0' },
    body: JSON.stringify({ episodeId }), signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 403) return undefined;
  if (!response.ok) throw new AppError('PAGE_INACCESSIBLE', `Could not request playback (HTTP ${response.status}).`);
  const body = await response.json() as { playlistUrl?: unknown };
  return typeof body.playlistUrl === 'string' && /^https:\/\//.test(body.playlistUrl) ? body.playlistUrl : undefined;
}

async function getPage(url: string): Promise<{ url: string; html: string }> {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'HT-Downloader/1.0' } });
  if (!response.ok) throw new AppError('PAGE_INACCESSIBLE', `Could not access page (HTTP ${response.status}).`);
  if (Number(response.headers.get('content-length') ?? 0) > maximumPageBytes) throw new AppError('PAGE_INACCESSIBLE', 'The page response is too large to scan safely.');
  const html = await response.text();
  if (Buffer.byteLength(html) > maximumPageBytes) throw new AppError('PAGE_INACCESSIBLE', 'The page response is too large to scan safely.');
  return { url: response.url, html };
}

async function getThumbnail(html: string, pageUrl: string): Promise<string | undefined> {
  const src = cheerio.load(html)('img[src]').first().attr('src');
  if (!src) return undefined;
  try {
    const imageUrl = new URL(src, pageUrl).toString();
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000), headers: { referer: pageUrl, 'user-agent': 'HT-Downloader/1.0' } });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.startsWith('image/')) return undefined;
    const image = Buffer.from(await response.arrayBuffer());
    if (image.byteLength > 1_000_000) return undefined;
    return `data:${contentType};base64,${image.toString('base64')}`;
  } catch { return undefined; }
}
