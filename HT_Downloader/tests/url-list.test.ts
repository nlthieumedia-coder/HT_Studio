import { describe, expect, it } from 'vitest';
import { parseUrlLines } from '../src/renderer/utils/url-list';

describe('parseUrlLines', () => {
  it('parses one URL per line and ignores empty lines', () => {
    expect(parseUrlLines(' https://a.example/video \n\nhttps://b.example/video\r\n')).toEqual([
      'https://a.example/video',
      'https://b.example/video'
    ]);
  });

  it('removes duplicate lines while preserving order', () => {
    expect(parseUrlLines('https://a.example\nhttps://b.example\nhttps://a.example')).toEqual([
      'https://a.example',
      'https://b.example'
    ]);
  });

  it('splits concatenated URLs pasted on a single line', () => {
    expect(parseUrlLines('https://vt.tiktok.com/ABC/https://vt.tiktok.com/DEF')).toEqual([
      'https://vt.tiktok.com/ABC/',
      'https://vt.tiktok.com/DEF'
    ]);
  });
});
