import type { VideoItem } from '../../shared/types';
import { useAppStore } from '../stores/app-store';
import { formatBytes, formatDuration } from '../utils/format';
import { Icon } from './Icon';

export function VideoCard({ video }: { video: VideoItem }): React.JSX.Element {
  const selectedId = useAppStore(state => state.selectedFormats[video.id]);
  const select = useAppStore(state => state.selectFormat);
  const download = useAppStore(state => state.startDownload);
  const format = video.formats.find(item => item.id === selectedId) ?? video.formats[0];
  const dateStr = formatDate(video.uploadDate, video.timestamp);
  return <article className="video-card">
    <div className="thumbnail">{video.thumbnail ? <img src={video.thumbnail} alt=""/> : <div className="thumbnail-placeholder"><Icon name="file"/></div>}<span className="source-badge">{sourceName(video.sourceType)}</span>{video.duration && <span className="duration-badge">{formatDuration(video.duration)}</span>}</div>
    <div className="video-content"><div className="video-title-row"><div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><p className="video-kicker">VIDEO ĐÃ PHÁT HIỆN</p>{dateStr && <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 500 }}>📅 {dateStr}</span>}</div><h3>{video.title}</h3></div>
      <div className="video-actions"><label><span>Chất lượng đầu ra</span><select value={selectedId} onChange={event => select(video.id, event.target.value)}>{video.formats.map(item => <option key={item.id} value={item.id}>{item.qualityLabel}</option>)}</select></label><button className="btn-primary download-button" onClick={() => void download(video)}><Icon name="download"/><span>Tải xuống</span></button></div>
      <div className="format-meta"><span>{format?.width && format.height ? `${format.width} × ${format.height}` : 'Độ phân giải gốc'}</span>{format?.fps && <span>{Math.round(format.fps)} FPS</span>}{format?.extension && <span>{format.extension.toUpperCase()}</span>}<span>{formatBytes(format?.fileSize)}</span>{!format?.hasAudio && <span className="merge-note">Tự động ghép âm thanh</span>}</div>
    </div>
  </article>;
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
