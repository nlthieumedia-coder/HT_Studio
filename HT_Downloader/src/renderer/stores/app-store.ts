import { create } from 'zustand';
import type { DownloadProgress, ScanResult, VideoItem } from '../../shared/types';
import { friendlyError } from '../utils/format';
import { parseUrlLines } from '../utils/url-list';

interface AppState {
  url: string; scanStatus: 'idle' | 'scanning' | 'complete' | 'error'; result?: ScanResult; error?: string;
  maxVideos: number;
  scanProgress?: { completed: number; total: number };
  selectedFormats: Record<string, string>; outputDirectory?: string; downloads: Record<string, DownloadProgress>;
  setUrl(url: string): void; setMaxVideos(count: number): void; scan(): Promise<void>; selectFormat(videoId: string, formatId: string): void;
  chooseDirectory(): Promise<void>; startDownload(video: VideoItem): Promise<void>; startDownloadAll(): Promise<void>; updateDownload(progress: DownloadProgress): void; cancel(id: string): Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  url: '', scanStatus: 'idle', maxVideos: 10, selectedFormats: {}, downloads: {},
  setUrl: url => set({ url }),
  setMaxVideos: maxVideos => set({ maxVideos }),
  scan: async () => {
    const urls = parseUrlLines(get().url);
    if (!urls.length) return;
    set({ scanStatus: 'scanning', scanProgress: { completed: 0, total: urls.length }, error: undefined, result: undefined });

    const results: ScanResult[] = [];
    const errors: string[] = [];
    for (const [index, url] of urls.entries()) {
      const response = await window.htDownloader.scanUrl(url, { maxVideos: get().maxVideos });
      if (response.ok) results.push(response.data);
      else errors.push(`Dòng ${index + 1}: ${friendlyError(response.error.code, response.error.message)}`);
      set({ scanProgress: { completed: index + 1, total: urls.length } });
    }

    if (!results.length) {
      return set({ scanStatus: 'error', error: errors.join('\n') || 'Không tìm thấy video.', scanProgress: undefined });
    }

    const videos = Array.from(new Map(results.flatMap(result => result.videos).map(video => [video.id, video])).values());
    const result: ScanResult = {
      pageUrl: urls.join('\n'),
      pageTitle: results.length === 1 ? results[0].pageTitle : `${results.length} nguồn video`,
      videos
    };
    const selectedFormats = Object.fromEntries(videos.map(video => [video.id, video.formats[0]?.id ?? '']));
    const partialError = errors.length ? `Đã quét ${results.length}/${urls.length} liên kết.\n${errors.join('\n')}` : undefined;
    set({ result, selectedFormats, scanStatus: 'complete', error: partialError, scanProgress: undefined });
  },
  selectFormat: (videoId, formatId) => set(state => ({ selectedFormats: { ...state.selectedFormats, [videoId]: formatId } })),
  chooseDirectory: async () => { const directory = await window.htDownloader.chooseDirectory(); if (directory) set({ outputDirectory: directory }); },
  startDownload: async video => {
    let outputDirectory = get().outputDirectory;
    if (!outputDirectory) { await get().chooseDirectory(); outputDirectory = get().outputDirectory; }
    if (!outputDirectory) return;
    const selectedFormatId = get().selectedFormats[video.id]; const format = video.formats.find(item => item.id === selectedFormatId);
    // yt-dlp format IDs only have meaning against the original webpage URL.
    // Direct/HLS/DASH fallback formats instead need their detected stream URL.
    const sourceUrl = video.sourceType === 'ytdlp' ? video.sourceUrl : (format?.sourceUrl ?? video.sourceUrl);
    const response = await window.htDownloader.download({ videoId: video.id, sourceUrl, selectedFormatId, selectedHasAudio: format?.hasAudio, outputDirectory, title: video.title });
    if (!response.ok && response.error.code !== 'DOWNLOAD_CANCELLED') set({ error: friendlyError(response.error.code, response.error.message) });
  },
  startDownloadAll: async () => {
    const result = get().result;
    if (!result || !result.videos.length) return;
    let outputDirectory = get().outputDirectory;
    if (!outputDirectory) { await get().chooseDirectory(); outputDirectory = get().outputDirectory; }
    if (!outputDirectory) return;
    for (const video of result.videos) {
      void get().startDownload(video);
    }
  },
  updateDownload: progress => set(state => ({ downloads: { ...state.downloads, [progress.downloadId]: progress } })),
  cancel: async id => { await window.htDownloader.cancelDownload(id); }
}));
