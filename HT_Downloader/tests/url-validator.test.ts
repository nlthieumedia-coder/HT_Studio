import { describe, expect, it } from 'vitest';
import { validatePublicUrl } from '../src/main/scanner/url-validator';
import { resolveTikTokProfileUsername } from '../src/main/scanner/tiktok-scanner';

describe('URL validation', () => {
  it('accepts HTTPS', () => expect(validatePublicUrl('https://example.com/video').hostname).toBe('example.com'));
  it('normalizes TikTok handle starting with @', () => expect(validatePublicUrl('@shop_channel').href).toBe('https://www.tiktok.com/@shop_channel'));
  it('normalizes TikTok channel without protocol', () => expect(validatePublicUrl('tiktok.com/@shop_channel').href).toBe('https://tiktok.com/@shop_channel'));
  it('rejects non-web and malformed inputs', () => { expect(() => validatePublicUrl('file:///C:/secret')).toThrow(); expect(() => validatePublicUrl('not a URL')).toThrow(); });

  it('correctly distinguishes TikTok profile URLs from individual video URLs', () => {
    expect(resolveTikTokProfileUsername('https://www.tiktok.com/@honeyreels_vn?_r=1&_t=ZS-9AuAS8ARutD')).toBe('honeyreels_vn');
    expect(resolveTikTokProfileUsername('https://www.tiktok.com/@honeyreels_vn')).toBe('honeyreels_vn');
    expect(resolveTikTokProfileUsername('https://www.tiktok.com/@honeyreels_vn/video/7701740523291233557?is_from_webapp=1')).toBeNull();
    expect(resolveTikTokProfileUsername('https://www.tiktok.com/@honeyreels_vn/photo/7701740523291233557')).toBeNull();
  });
});
