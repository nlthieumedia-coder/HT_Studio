import { describe, expect, it } from 'vitest';
import { classifyYtDlpError } from '../src/main/scanner/ytdlp-analyzer';

describe('yt-dlp error classification', () => {
  it('explains Facebook parser failures without treating them as a network error', () => {
    const error = classifyYtDlpError('ERROR: [facebook] 1652531266238971: Cannot parse data');
    expect(error.code).toBe('FACEBOOK_EXTRACTOR');
  });
});
