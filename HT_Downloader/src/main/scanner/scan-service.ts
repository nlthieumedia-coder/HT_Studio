import type { ScanResult } from '../../shared/types';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';
import { validatePublicUrl } from './url-validator';
import { deduplicateVideos, normalizeYtDlp } from './normalizer';
import { YtDlpAnalyzer } from './ytdlp-analyzer';
import { DirectScanner } from './direct-scanner';
import { isRedditUrl, normalizeRedditUrl } from './reddit';
import { RedditScanner } from './reddit-scanner';
import { TikTokScanner, resolveTikTokProfileUsername } from './tiktok-scanner';
import { CouponWhizzyScanner, isCouponWhizzyUrl } from './couponwhizzy-scanner';
import { HeadlessSniffer } from './headless-sniffer';

export class ScanService {
  private readonly redditScanner: RedditScanner;
  private readonly tiktokScanner = new TikTokScanner();
  private readonly couponWhizzyScanner: CouponWhizzyScanner;
  private readonly headlessSniffer = new HeadlessSniffer();
  constructor(private readonly analyzer: YtDlpAnalyzer, private readonly directScanner = new DirectScanner()) {
    this.redditScanner = new RedditScanner(directScanner);
    this.couponWhizzyScanner = new CouponWhizzyScanner(directScanner);
  }
  async scanUrl(input: string, options?: { maxVideos?: number; cookieFile?: string }): Promise<ScanResult> {
    const url = normalizeRedditUrl(validatePublicUrl(input)).toString();
    logger.info('SCAN_STARTED', { url, maxVideos: options?.maxVideos });
    // This site exposes the playable HLS URL through a POST-only playback
    // endpoint, so yt-dlp and the generic HTML scanner cannot discover it.
    if (isCouponWhizzyUrl(url)) {
      const direct = await this.couponWhizzyScanner.scan(url, options?.maxVideos, input.trim());
      const videos = deduplicateVideos(direct.videos);
      if (!videos.length) throw new AppError('NO_VIDEO', 'No publicly available video was detected on this page.');
      logger.info('MEDIA_FOUND', { count: videos.length });
      return { pageUrl: url, pageTitle: direct.title, videos };
    }
    let pageTitle: string | undefined; let pageUrl = url; let videos = [] as ScanResult['videos']; let ytDlpError: AppError | undefined;
    try {
      let targetUrl = url;
      const tiktokUsername = resolveTikTokProfileUsername(url);
      if (tiktokUsername) {
        const secUid = await this.tiktokScanner.resolveSecUid(tiktokUsername);
        if (secUid) targetUrl = `tiktokuser:${secUid}`;
      }
      const raw = await this.analyzer.analyze(targetUrl, { playlistEnd: options?.maxVideos, cookieFile: options?.cookieFile });
      logger.info('YTDLP_SCAN_COMPLETE');
      videos = normalizeYtDlp(raw, url); pageTitle = raw.title; pageUrl = (raw.webpage_url && /^https?:\/\//i.test(raw.webpage_url)) ? raw.webpage_url : url;
    } catch (error) {
      if (error instanceof AppError && ['DRM_PROTECTED', 'LOGIN_REQUIRED'].includes(error.code)) throw error;
      if (error instanceof AppError) ytDlpError = error;
      logger.warn('YTDLP_SCAN_FALLBACK', { reason: error instanceof AppError ? error.code : 'unknown' });
    }
    if (!videos.length) {
      const direct = isRedditUrl(url) ? await this.redditScanner.scan(url) : await this.directScanner.scan(url);
      videos = direct.videos; pageTitle = direct.title;
    }
    if (!videos.length) {
      try {
        const sniffed = await this.headlessSniffer.sniff(url);
        if (sniffed) {
          videos = [sniffed];
          pageTitle = sniffed.title;
        }
      } catch (snifferErr) {
        if (snifferErr instanceof AppError && snifferErr.code === 'LOGIN_REQUIRED') {
          throw snifferErr;
        }
        logger.warn('HEADLESS_SNIFFER_FAILED', { error: String(snifferErr) });
      }
    }
    videos = deduplicateVideos(videos);
    if (!videos.length) {
      if (ytDlpError?.code === 'YTDLP_MISSING' || ytDlpError?.code === 'FACEBOOK_EXTRACTOR') throw ytDlpError;
      throw new AppError('NO_VIDEO', 'No video was detected on this page.');
    }
    logger.info('MEDIA_FOUND', { count: videos.length });
    return { pageUrl, pageTitle, videos };
  }
}
