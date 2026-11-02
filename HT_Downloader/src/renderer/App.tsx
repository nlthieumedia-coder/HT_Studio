import { useEffect, useMemo, useState } from 'react';
import type { DownloadProgress, LicenseStatus, VideoItem } from '../shared/types';
import { ActivationScreen } from './components/ActivationScreen';
import { Icon } from './components/Icon';
import { SupportModal } from './components/SupportModal';
import { useAppStore } from './stores/app-store';
import { formatDuration } from './utils/format';
import { parseUrlLines } from './utils/url-list';

type FilterKey = 'all' | 'pending' | 'complete' | 'error';

export function App(): React.JSX.Element {
  const store = useAppStore();
  const downloads = Object.values(store.downloads);
  const videos = store.result?.videos ?? [];
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const validUrlCount = parseUrlLines(store.url).length;

  useEffect(() => {
    void store.checkTikTokStatus();
    return window.htDownloader.onDownloadProgress(progress => useAppStore.getState().updateDownload(progress));
  }, []);

  useEffect(() => {
    let mounted = true;
    void window.htDownloader.licenseCheck()
      .then(status => { if (mounted) setLicenseStatus(status); })
      .catch(error => { if (mounted) setLicenseStatus({ licensed: false, hwid: 'UNKNOWN', error: error instanceof Error ? error.message : 'Không thể kiểm tra bản quyền.' }); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setSelectedIds(new Set(videos.map(video => video.id)));
  }, [store.result]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select')) return;
      if (event.ctrlKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(new Set(videos.map(video => video.id)));
      }
      if (event.key === 'Delete') {
        event.preventDefault();
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [videos]);

  const latestDownloads = useMemo(() => {
    const map = new Map<string, DownloadProgress>();
    for (const item of downloads) map.set(item.videoId, item);
    return map;
  }, [downloads]);

  const counts = useMemo(() => {
    const values = videos.map(video => latestDownloads.get(video.id));
    return {
      all: videos.length,
      pending: values.filter(item => !item || ['starting', 'downloading', 'merging'].includes(item.status)).length,
      complete: values.filter(item => item?.status === 'complete').length,
      error: values.filter(item => item?.status === 'error' || item?.status === 'cancelled').length
    };
  }, [videos, latestDownloads]);

  const filteredVideos = useMemo(() => videos.filter(video => {
    const category = downloadCategory(latestDownloads.get(video.id));
    const matchesFilter = filter === 'all' || category === filter;
    const query = search.trim().toLocaleLowerCase('vi');
    return matchesFilter && (!query || video.title.toLocaleLowerCase('vi').includes(query));
  }), [videos, latestDownloads, filter, search]);

  const allVisibleSelected = filteredVideos.length > 0 && filteredVideos.every(video => selectedIds.has(video.id));
  const selectedVideos = videos.filter(video => selectedIds.has(video.id));
  const firstCompletedFile = downloads.find(item => item.status === 'complete' && item.filePath)?.filePath;

  const toggleSelected = (id: string): void => setSelectedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleVisible = (): void => setSelectedIds(current => {
    const next = new Set(current);
    for (const video of filteredVideos) allVisibleSelected ? next.delete(video.id) : next.add(video.id);
    return next;
  });

  const downloadSelected = async (): Promise<void> => {
    if (!selectedVideos.length) return;
    if (!useAppStore.getState().outputDirectory) await useAppStore.getState().chooseDirectory();
    if (!useAppStore.getState().outputDirectory) return;
    for (const video of selectedVideos) void useAppStore.getState().startDownload(video);
  };

  const pasteLinks = async (): Promise<void> => {
    try {
      const value = await navigator.clipboard.readText();
      if (value.trim()) store.setUrl(value.trim());
    } catch {
      document.getElementById('source-url')?.focus();
    }
  };

  if (!licenseStatus) return <LicenseLoadingScreen/>;
  if (!licenseStatus.licensed) return <ActivationScreen status={licenseStatus} onActivated={setLicenseStatus}/>;

  return <div className="app-shell">
    <div className="window-titlebar"><span className="window-logo">HT</span><span>HT Studio · Downloader</span><span className="titlebar-version-badge">v2.0.2</span></div>

    <header className="app-header">
      <div className="app-identity">
        <div className="app-icon"><Icon name="download"/></div>
        <div>
          <div className="app-title-row">
            <h1>Downloader</h1>
            <span className="app-version-badge">v2.0.2</span>
          </div>
          <p>Tải và quản lý video · Phiên bản v2.0.2</p>
        </div>
      </div>
      <div className="header-actions">
        <span className="license-badge"><Icon name="key"/>{licenseStatus.type === 'LIFETIME' ? 'PRO TRỌN ĐỜI' : 'PRO LICENSE'}</span>
        {store.tiktokLoggedIn ? <button type="button" className="tiktok-button connected" onClick={() => void store.logoutTikTok()}><Icon name="tiktok"/>TikTok: Đã kết nối</button> : <button type="button" className="tiktok-button" onClick={() => void store.loginTikTok()}><Icon name="tiktok"/>Đăng nhập TikTok</button>}
        <span className="ready-status"><i/>Sẵn sàng</span>
        <button type="button" className="icon-button" title="Hỗ trợ Zalo / Telegram" onClick={() => setSupportOpen(true)}><Icon name="info"/></button>
        <button type="button" className="icon-button" title="Cài đặt"><Icon name="settings"/></button>
      </div>
    </header>

    <div className="workspace-frame">
      <aside className="sidebar">
        <section className="sidebar-section source-section">
          <div className="section-title-row"><h2>Nguồn video</h2><button type="button" className="outline-button paste-button" onClick={() => void pasteLinks()}><Icon name="paste"/>Dán</button></div>
          <p className="section-description">Nhập các liên kết video TikTok (mỗi liên kết một dòng).</p>
          <textarea id="source-url" value={store.url} onChange={event => store.setUrl(event.target.value)} placeholder={'https://www.tiktok.com/@username/video/...\nMỗi dòng một liên kết'} />
          <div className="url-summary"><span className={validUrlCount ? 'valid' : ''}><Icon name={validUrlCount ? 'check' : 'info'}/>{validUrlCount} liên kết hợp lệ</span><small>Mỗi liên kết một dòng</small></div>
          <div className="settings-row"><label htmlFor="max-videos-select">Giới hạn quét</label><select id="max-videos-select" value={store.maxVideos} onChange={event => store.setMaxVideos(Number(event.target.value))}>{[5, 10, 15, 20, 30, 50].map(value => <option key={value} value={value}>{value} video mới nhất</option>)}</select></div>
          <button type="button" disabled={store.scanStatus === 'scanning' || !validUrlCount} onClick={() => void store.scan()} className="scan-button"><Icon name="search"/>{store.scanStatus === 'scanning' ? `Đang quét ${store.scanProgress?.completed ?? 0}/${store.scanProgress?.total ?? 0}` : 'Quét liên kết'}</button>
        </section>

        <div className="sidebar-divider"/>

        <section className="sidebar-section download-settings">
          <h2>Cài đặt tải</h2>
          <label>Thư mục lưu</label>
          <button type="button" className="directory-field" onClick={() => void store.chooseDirectory()}><span>{store.outputDirectory ?? 'Chọn thư mục lưu'}</span><Icon name="folder"/></button>
          <button type="button" className="text-button" onClick={() => firstCompletedFile && void window.htDownloader.openFolder(firstCompletedFile)} disabled={!firstCompletedFile}><Icon name="folder"/>Mở thư mục</button>
          <div className="settings-row"><label>Chất lượng mặc định</label><select aria-label="Chất lượng mặc định" defaultValue="best"><option value="best">Cao nhất có sẵn</option></select></div>
          <div className="settings-row"><label>Định dạng</label><select aria-label="Định dạng" defaultValue="mp4"><option value="mp4">MP4</option></select></div>
          <p className="settings-hint"><Icon name="info"/>Áp dụng cho các video được chọn.</p>
        </section>
      </aside>

      <main className="library">
        <div className="library-title"><h2>Danh sách video <span>{videos.length}</span></h2></div>
        <div className="library-toolbar">
          <div className="filter-tabs">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="Tất cả" count={counts.all}/>
            <FilterButton active={filter === 'pending'} onClick={() => setFilter('pending')} label="Chờ tải" count={counts.pending}/>
            <FilterButton active={filter === 'complete'} onClick={() => setFilter('complete')} label="Hoàn tất" count={counts.complete}/>
            <FilterButton active={filter === 'error'} onClick={() => setFilter('error')} label="Lỗi" count={counts.error}/>
          </div>
          <div className="view-tools"><label className="search-box"><Icon name="search"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm video..."/></label><button className="view-button active" title="Danh sách"><Icon name="list"/></button><button className="view-button" title="Dạng lưới"><Icon name="grid"/></button></div>
        </div>

        {store.error && <div className="alert-error"><Icon name="close"/><span>{store.error}</span>{store.errorCode === 'LOGIN_REQUIRED' && <button onClick={() => void store.loginTikTok()}>Đăng nhập TikTok</button>}</div>}

        <div className="video-table">
          <div className="table-header"><label className="check-wrap"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible}/><span/></label><span>Video</span><span>Chất lượng</span><span>Trạng thái</span><span>Thao tác</span></div>
          <div className="table-body">
            {store.scanStatus === 'scanning' && <div className="table-empty"><div className="scan-loader"/><h3>Đang phân tích liên kết</h3><p>Vui lòng chờ trong giây lát.</p></div>}
            {store.scanStatus !== 'scanning' && videos.length === 0 && <div className="table-empty"><div className="empty-icon"><Icon name="download"/></div><h3>Chưa có video</h3><p>Dán liên kết vào khung bên trái và bấm “Quét liên kết”.</p></div>}
            {videos.length > 0 && filteredVideos.length === 0 && <div className="table-empty compact"><h3>Không tìm thấy video phù hợp</h3><p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p></div>}
            {store.scanStatus !== 'scanning' && filteredVideos.map(video => <VideoRow key={video.id} video={video} selected={selectedIds.has(video.id)} download={latestDownloads.get(video.id)} onToggle={() => toggleSelected(video.id)}/>) }
          </div>
        </div>
        <div className="table-help">Ctrl + A: Chọn tất cả <i/> Nhấn Del để bỏ chọn</div>
      </main>
    </div>

    <div className="selection-bar">
      <div><strong>Đã chọn {selectedIds.size} video</strong><i/><button type="button" onClick={() => setSelectedIds(new Set())}>Bỏ chọn</button></div>
      <span className="completion-summary"><Icon name="check"/>{counts.complete} / {videos.length} video hoàn tất</span>
      <div className="selection-actions"><button type="button" className="open-folder-button" disabled={!firstCompletedFile} onClick={() => firstCompletedFile && void window.htDownloader.openFolder(firstCompletedFile)}><Icon name="folder"/>Mở thư mục</button><button type="button" className="download-selected-button" disabled={!selectedVideos.length} onClick={() => void downloadSelected()}><Icon name="download"/>Tải {selectedVideos.length} video</button></div>
    </div>
    <footer className="status-bar"><span><Icon name="info"/>{downloads.some(item => ['starting', 'downloading', 'merging'].includes(item.status)) ? 'Đang có tác vụ tải xuống' : 'Không có tác vụ đang chạy'}</span><span className="status-version">Phiên bản v2.0.2</span></footer>
    <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)}/>
  </div>;
}

function LicenseLoadingScreen(): React.JSX.Element {
  return <div className="license-loading"><div className="activation-logo"><img src="./logo_icon.png" alt="HT Studio"/></div><div className="scan-loader"/><strong>Đang kiểm tra bản quyền...</strong></div>;
}

function FilterButton({ active, onClick, label, count }: { active: boolean; onClick(): void; label: string; count: number }): React.JSX.Element {
  return <button type="button" className={active ? 'active' : ''} onClick={onClick}>{label}<span>{count}</span></button>;
}

function VideoRow({ video, selected, download, onToggle }: { video: VideoItem; selected: boolean; download?: DownloadProgress; onToggle(): void }): React.JSX.Element {
  const selectedId = useAppStore(state => state.selectedFormats[video.id]);
  const selectFormat = useAppStore(state => state.selectFormat);
  const startDownload = useAppStore(state => state.startDownload);
  const cancel = useAppStore(state => state.cancel);
  const date = formatVideoDate(video.uploadDate, video.timestamp);
  const active = download && ['starting', 'downloading', 'merging'].includes(download.status);

  return <div className={`video-row ${selected ? 'selected' : ''}`}>
    <label className="check-wrap"><input type="checkbox" checked={selected} onChange={onToggle}/><span/></label>
    <div className="video-cell"><div className="row-thumbnail">{video.thumbnail ? <img src={video.thumbnail} alt=""/> : <Icon name="file"/>}<b>{formatDuration(video.duration)}</b></div><div className="row-video-copy"><strong title={video.title}>{video.title}</strong><span>{sourceName(video)}<i/> {formatDuration(video.duration)}{date && <><i/>{date}</>}</span></div></div>
    <select className="quality-select" value={selectedId} disabled={Boolean(active)} onChange={event => selectFormat(video.id, event.target.value)}>{video.formats.map(format => <option value={format.id} key={format.id}>{format.qualityLabel}</option>)}</select>
    <DownloadStatus item={download}/>
    <div className="row-actions">
      {download?.status === 'complete' && download.filePath && <button type="button" title="Mở thư mục" onClick={() => void window.htDownloader.openFolder(download.filePath!)}><Icon name="folder"/></button>}
      {(download?.status === 'error' || download?.status === 'cancelled') && <button type="button" className="retry-button" onClick={() => void startDownload(video)}><Icon name="retry"/>Thử lại</button>}
      {active && <button type="button" title="Hủy tải" onClick={() => void cancel(download.downloadId)}><Icon name="close"/></button>}
      {!download && <button type="button" title="Tải video" onClick={() => void startDownload(video)}><Icon name="download"/></button>}
      <button type="button" title="Tùy chọn"><Icon name="more"/></button>
    </div>
  </div>;
}

function DownloadStatus({ item }: { item?: DownloadProgress }): React.JSX.Element {
  if (!item) return <div className="download-status pending"><Icon name="clock"/><span>Chờ tải</span></div>;
  if (item.status === 'complete') return <div className="download-status complete"><Icon name="check"/><span>Hoàn tất</span></div>;
  if (item.status === 'error' || item.status === 'cancelled') return <div className="download-status error"><Icon name="info"/><span>{item.status === 'cancelled' ? 'Đã hủy' : 'Lỗi kết nối'}</span></div>;
  const percent = Math.max(0, Math.min(100, Math.round(item.percent)));
  return <div className="download-status active"><div><span>{item.status === 'merging' ? 'Đang xử lý' : 'Đang tải'}</span><b>{percent}%</b></div><div className="row-progress"><span style={{ width: `${percent}%` }}/></div></div>;
}

function downloadCategory(item?: DownloadProgress): Exclude<FilterKey, 'all'> {
  if (!item || ['starting', 'downloading', 'merging'].includes(item.status)) return 'pending';
  if (item.status === 'complete') return 'complete';
  return 'error';
}

function sourceName(video: VideoItem): string {
  if (video.sourceType === 'ytdlp' && video.sourceUrl.includes('tiktok.com')) return 'TikTok';
  return video.sourceType.toUpperCase();
}

function formatVideoDate(dateString?: string, timestamp?: number): string | null {
  const date = timestamp ? new Date(timestamp * 1000) : dateString && /^\d{8}$/.test(dateString) ? new Date(`${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}T00:00:00`) : null;
  if (!date) return null;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}
