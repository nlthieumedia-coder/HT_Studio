import { describe, expect, it } from 'vitest';
import { normalizeYtDlp } from '../src/main/scanner/normalizer';

describe('yt-dlp normalizer', () => {
  it('groups multiple qualities into one video and hides audio-only formats', () => {
    const videos = normalizeYtDlp({ id: 'abc', title: 'Demo', formats: [
      { format_id: '140', acodec: 'aac', vcodec: 'none', ext: 'm4a' },
      { format_id: '22', height: 720, fps: 30, acodec: 'aac', vcodec: 'h264', ext: 'mp4' },
      { format_id: '137', height: 1080, fps: 60, acodec: 'none', vcodec: 'h264', ext: 'mp4' }
    ] }, 'https://example.com/video');
    expect(videos).toHaveLength(1);
    expect(videos[0].formats.map(item => item.qualityLabel)).toEqual(['1080p • 60 FPS', '720p']);
  });

  it('supports playlist entries without creating one item per format', () => {
    const videos = normalizeYtDlp({ title: 'Playlist', entries: [
      { id: 'one', title: 'One', formats: [{ format_id: '1', height: 480, vcodec: 'h264', acodec: 'aac' }] },
      { id: 'two', title: 'Two', formats: [{ format_id: '2', height: 720, vcodec: 'h264', acodec: 'none' }] }
    ] }, 'https://example.com/list');
    expect(videos.map(item => item.title)).toEqual(['One', 'Two']);
  });

  it('handles TikTok formats with height/width and constructs valid HTTPS sourceUrl', () => {
    const videos = normalizeYtDlp({
      title: 'Channel',
      entries: [
        {
          id: '7701740523291233557',
          title: 'HoneyReels Episode 1',
          webpage_url: 'tiktokuser:MS4wLjABAAAA...',
          formats: [
            { format_id: 'download_addr-0', height: 1080, width: 720, ext: 'mp4' }
          ]
        }
      ]
    }, 'https://www.tiktok.com/@honeyreels_vn?_r=1');
    expect(videos).toHaveLength(1);
    expect(videos[0].sourceUrl).toBe('https://www.tiktok.com/@honeyreels_vn/video/7701740523291233557');
    expect(videos[0].formats[0].qualityLabel).toBe('1080p');
  });
});
