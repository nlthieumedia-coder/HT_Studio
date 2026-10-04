import { logger } from '../utils/logger';

export function resolveTikTokProfileUsername(inputUrl: string): string | null {
  const match = inputUrl.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/i);
  return match ? match[1] : null;
}

export class TikTokScanner {
  async resolveSecUid(username: string): Promise<string | null> {
    try {
      const url = `https://www.tiktok.com/@${username}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      const html = await response.text();
      const secUid = html.match(/"secUid":"([^"]+)"/)?.[1];
      if (secUid) {
        logger.info('TIKTOK_SECUID_RESOLVED', { username, secUid });
        return secUid;
      }
    } catch (error) {
      logger.warn('TIKTOK_SECUID_FAILED', { username, error: error instanceof Error ? error.message : String(error) });
    }
    return null;
  }
}
