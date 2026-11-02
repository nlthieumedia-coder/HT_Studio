import type { DownloadProgress, VideoItem } from '../../shared/types';
import { useAppStore } from '../stores/app-store';
import { formatBytes, formatDuration } from '../utils/format';
import { Icon } from './Icon';

export function VideoCard({ video, downloadState }: { video: VideoItem; downloadState?: DownloadProgress }): React.JSX.Element {
  const selectedId = useAppStore(state => state.selectedFormats[video.id]);
  const select = useAppStore(state => state.selectFormat);
  const download = useAppStore(state => state.startDownload);
  const cancel = useAppStore(state => state.cancel);
  const format = video.formats.find(item => item.id === selectedId) ?? video.formats[0];
  const dateStr = formatDate(video.uploadDate, video.timestamp);
  const isActive = downloadState && ['starting', 'downloading', 'merging'].includes(downloadState.status);
  const isComplete = downloadState?.status === 'complete';
  const percent = Math.max(0, Math.min(100, Math.round(downloadState?.percent ?? 0)));

  const handleDownload = (): void => {
    if (isActive) return;
    if (isComplete && downloadState.filePath) {
      void window.htDownloader.openFile(downloadState.filePath);
      return;
    }
    void download(video);
  };

  return <article className="video-card">
    <div className="thumbnail">{video.thumbnail ? <img src={video.thumbnail} alt={`Ảnh xem trước của ${video.title}`}/> : <div className="thumbnail-placeholder"><Icon name="file"/></div>}<span className="source-badge">{sourceName(video.sourceType)}</span>{video.duration && <span className="duration-badge">{formatDuration(video.duration)}</span>}</div>
    <div className="video-content"><div className="video-title-row"><div className="video-card-meta"><p className="video-kicker">VIDEO ĐÃ PHÁT HIỆN</p>{dateStr && <span className="video-date">📅 {dateStr}</span>}</div><h3 title={video.title}>{video.title}</h3></div>
      <div className="video-actions"><label><span>Chất lượng đầu ra</span><select value={selectedId} disabled={Boolean(isActive)} onChange={event => select(video.id, event.target.value)}>{video.formats.map(item => <option key={item.id} value={item.id}>{item.qualityLabel}</option>)}</select></label><button className={`btn-primary download-button download-${downloadState?.status ?? 'idle'}`} aria-disabled={Boolean(isActive)} onClick={handleDownload}>
        {downloadState && <span className="download-progress-fill" style={{ width: `${percent}%` }}/>}<span className="download-button-content"><Icon name={isComplete ? 'check' : 'download'}/><span>{downloadLabel(downloadState)}</span>{downloadState && <strong>{percent}%</strong>}</span>
      </button></div>
      {downloadState && <div className={`card-download-status status-${downloadState.status}`}>
        <span>{downloadDetail(downloadState)}</span>
        {isActive && <button type="button" onClick={() => void cancel(downloadState.downloadId)}>Hủy</button>}
        {isComplete && downloadState.filePath && <div className="completed-actions"><button type="button" onClick={() => void window.htDownloader.openFile(downloadState.filePath!)}><Icon name="file"/>Mở tệp</button><button type="button" onClick={() => void window.htDownloader.openFolder(downloadState.filePath!)}><Icon name="external"/>Mở thư mục</button></div>}
      </div>}
      <div className="format-meta"><span>{format?.width && format.height ? `${format.width} × ${format.height}` : 'Độ phân giải gốc'}</span>{format?.fps && <span>{Math.round(format.fps)} FPS</span>}{format?.extension && <span>{format.extension.toUpperCase()}</span>}<span>{formatBytes(format?.fileSize)}</span>{!format?.hasAudio && <span className="merge-note">Tự động ghép âm thanh</span>}</div>
    </div>
  </article>;
}

function downloadLabel(item?: DownloadProgress): string {
  if (!item) return 'Tải xuống';
  if (item.status === 'starting') return 'Đang chuẩn bị';
  if (item.status === 'downloading') return 'Đang tải';
  if (item.status === 'merging') return 'Đang xử lý';
  if (item.status === 'complete') return 'Đã tải xong';
  if (item.status === 'error') return 'Thử tải lại';
  return 'Tải lại';
}

function downloadDetail(item: DownloadProgress): string {
  if (item.status === 'complete') return 'Video đã được lưu thành công';
  if (item.status === 'error') return item.message ?? 'Tải xuống thất bại';
  if (item.status === 'cancelled') return 'Đã hủy tải xuống';
  if (item.status === 'merging') return 'Đang ghép video và âm thanh';
  if (item.status === 'starting') return 'Đang chuẩn bị tệp tải xuống';
  const size = item.totalBytes ? `${formatBytes(item.downloadedBytes)} / ${formatBytes(item.totalBytes)}` : formatBytes(item.downloadedBytes);
  return [size, item.speed, item.eta ? `Còn ${item.eta}` : undefined].filter(Boolean).join(' · ');
}

function formatDate(dateStr?: string, timestamp?: number): string | null {
  if (timestamp) {
    const d = new Date(timestamp * 1000);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }
  if (dateStr && /^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
  }
  return null;
}

function sourceName(source: VideoItem['sourceType']): string { return source === 'dash' ? 'REDDIT · DASH' : source.toUpperCase(); }
