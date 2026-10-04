import { describe, expect, it } from 'vitest';
import { validatePublicUrl } from '../src/main/scanner/url-validator';
describe('URL validation', () => {
  it('accepts HTTPS', () => expect(validatePublicUrl('https://example.com/video').hostname).toBe('example.com'));
  it('normalizes TikTok handle starting with @', () => expect(validatePublicUrl('@shop_channel').href).toBe('https://www.tiktok.com/@shop_channel'));
  it('normalizes TikTok channel without protocol', () => expect(validatePublicUrl('tiktok.com/@shop_channel').href).toBe('https://tiktok.com/@shop_channel'));
  it('rejects non-web and malformed inputs', () => { expect(() => validatePublicUrl('file:///C:/secret')).toThrow(); expect(() => validatePublicUrl('not a URL')).toThrow(); });
});
