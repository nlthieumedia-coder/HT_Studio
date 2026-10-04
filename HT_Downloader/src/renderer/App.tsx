import { useEffect } from 'react';
import { DownloadPanel } from './components/DownloadPanel';
import { Icon } from './components/Icon';
import { VideoCard } from './components/VideoCard';
import { useAppStore } from './stores/app-store';

export function App(): React.JSX.Element {
  const store = useAppStore();
  const downloads = Object.values(store.downloads);
  useEffect(() => window.htDownloader.onDownloadProgress(progress => useAppStore.getState().updateDownload(progress)), []);

  return <div className="app-shell">
    <header className="app-header">
      <div className="brand"><img className="brand-mark" src="./logo_icon.png" alt="HT Studio"/><div><div className="brand-suite">HT_STUDIO</div><h1>Downloader</h1></div></div>
      <div className="header-status"><span className="status-dot"/><span>Sẵn sàng</span><div className="version-badge">v2.0.3</div></div>
    </header>

    <main className="dashboard">
      <aside className="control-column">
        <div className="dashboard-intro"><p className="eyebrow">BẢNG ĐIỀU KHIỂN</p><h2>Tải video</h2><p>Dán liên kết, chọn nơi lưu rồi quét video.</p></div>

        <section className="panel control-panel">
          <div className="step-label"><span>1</span><div><strong>Liên kết nguồn</strong><small>Reddit và các trang hỗ trợ yt-dlp</small></div></div>
          <form onSubmit={event => { event.preventDefault(); void store.scan(); }}>
            <label className="field-label" htmlFor="source-url">URL video / Kênh TikTok</label>
            <textarea id="source-url" autoFocus value={store.url} onChange={event => store.setUrl(event.target.value)} placeholder={'Mỗi dòng một liên kết\nhttps://www.tiktok.com/@username (Kênh TikTok)\nhttps://www.youtube.com/watch?v=...\n@username'} rows={5}/>
            <div style={{ marginTop: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label htmlFor="max-videos-select" style={{ fontSize: '12px', color: '#999' }}>Giới hạn quét kênh/playlist:</label>
              <select id="max-videos-select" value={store.maxVideos} onChange={event => store.setMaxVideos(Number(event.target.value))} style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#262626', color: '#fff', border: '1px solid #3d3d3d', fontSize: '12px', cursor: 'pointer' }}>
                <option value={5}>5 video mới nhất</option>
                <option value={10}>10 video mới nhất</option>
                <option value={15}>15 video mới nhất</option>
                <option value={20}>20 video mới nhất</option>
                <option value={30}>30 video mới nhất</option>
                <option value={50}>50 video mới nhất</option>
              </select>
            </div>
            <button disabled={store.scanStatus === 'scanning' || !store.url.trim()} className="btn-primary scan-button"><Icon name="link"/><span>{store.scanStatus === 'scanning' ? `Đang quét ${store.scanProgress?.completed ?? 0}/${store.scanProgress?.total ?? 0}` : 'Quét các liên kết'}</span></button>
          </form>
        </section>

        <section className="panel control-panel storage-panel">
          <div className="step-label"><span>2</span><div><strong>Nơi lưu tệp</strong><small>Thư mục chứa video sau khi tải</small></div></div>
          <button type="button" onClick={() => void store.chooseDirectory()} className="storage-picker"><div className="storage-icon"><Icon name="folder"/></div><div><small>THƯ MỤC ĐÍCH</small><strong>{store.outputDirectory ?? 'Chưa chọn thư mục'}</strong></div><Icon name="external"/></button>
        </section>

        <section className="panel control-panel batch-panel">
          <div className="step-label"><span>3</span><div><strong>Tải hàng loạt</strong><small>Bắt đầu tải tất cả các video</small></div></div>
          <button type="button" disabled={!store.result || store.result.videos.length === 0} onClick={() => void store.startDownloadAll()} className="btn-primary scan-button" style={{ height: '44px', fontSize: '13px', fontWeight: '700', background: store.result && store.result.videos.length > 0 ? 'linear-gradient(135deg, #7667e8, #11cbe2)' : 'var(--field)', color: store.result && store.result.videos.length > 0 ? '#fff' : 'var(--muted)', border: '1px solid var(--border)', cursor: store.result && store.result.videos.length > 0 ? 'pointer' : 'not-allowed' }}>
            <Icon name="download"/>
            <span>{store.result ? `TẢI TẤT CẢ (${store.result.videos.length} VIDEO)` : 'TẢI TẤT CẢ VIDEO'}</span>
          </button>
        </section>

        <div className="control-note"><Icon name="check"/><span>FFmpeg tự động ghép video và âm thanh. Hỗ trợ quét 10 clip mới từ kênh TikTok.</span></div>
      </aside>

      <section className="content-column">
        <div className="content-header"><div><p className="eyebrow">THƯ VIỆN KẾT QUẢ</p><h2>Video đã quét</h2></div>{store.result && <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><button type="button" className="btn-primary download-all-button" onClick={() => void store.startDownloadAll()}><Icon name="download"/><span>Tải tất cả ({store.result.videos.length})</span></button><span className="result-count">{store.result.videos.length}</span></div>}</div>
        {store.error && <div className="alert-error"><Icon name="close"/><span>{store.error}</span></div>}
        {store.scanStatus === 'scanning' && <div className="empty-state scanning-state"><div className="scan-loader"/><h3>Đang phân tích các liên kết</h3><p>Đã quét {store.scanProgress?.completed ?? 0} trên {store.scanProgress?.total ?? 0} liên kết.</p></div>}
        {store.scanStatus !== 'scanning' && !store.result && <div className="empty-state"><div className="empty-icon"><Icon name="file"/></div><h3>Chưa có video</h3><p>Nhập liên kết ở bảng điều khiển bên trái và bấm “Quét liên kết”.</p></div>}
        {store.result && <div className="batch-download-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', marginBottom: '16px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(118,103,232,0.25), rgba(17,203,226,0.15))', border: '1px solid rgba(118,103,232,0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 700 }}>Đã tìm thấy {store.result.videos.length} video</h4>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#b9b2ff' }}>Bấm Tải Tất Cả để lưu toàn bộ danh sách video về thư mục mục tiêu.</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => void store.startDownloadAll()} style={{ height: '42px', padding: '0 20px', fontSize: '13px', fontWeight: 700, background: 'linear-gradient(135deg, #7667e8, #3f6df6)', boxShadow: '0 4px 15px rgba(118,103,232,0.4)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            <Icon name="download"/>
            <span>TẢI TẤT CẢ ({store.result.videos.length})</span>
          </button>
        </div>}
        {store.result && <div className="result-list dashboard-results">{store.result.videos.map(video => {
          const videoDownloads = downloads.filter(item => item.videoId === video.id);
          return <div className="video-result-group" key={video.id}>
            <VideoCard video={video}/>
            {videoDownloads.length > 0 && <div className="inline-downloads">{videoDownloads.map(item => <DownloadPanel key={item.downloadId} item={item}/>)}</div>}
          </div>;
        })}</div>}
      </section>
    </main>
    <footer><span>HT Studio · Media workflow tools</span><span>Chỉ tải nội dung mà bạn có quyền sử dụng</span></footer>
  </div>;
}
