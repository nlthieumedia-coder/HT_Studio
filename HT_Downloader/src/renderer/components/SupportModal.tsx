import { useEffect, useState } from 'react';
import { Icon } from './Icon';

const ZALO_URL = 'https://zalo.me/0349887132';
const TELEGRAM_URL = 'https://t.me/NLTH_MEDIA';

export function SupportModal({ open, onClose }: { open: boolean; onClose(): void }): React.JSX.Element | null {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  const copyTelegram = async (): Promise<void> => {
    await navigator.clipboard.writeText('@NLTH_MEDIA');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return <div className="support-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="support-modal" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <header className="support-modal-header">
        <div className="support-meta">
          <span className="support-live"><i/>Sẵn sàng kết nối</span>
          <span>HT Studio · Nguyễn Lê Trung Hiếu</span>
          <span className="support-version-tag">Phiên bản v2.0.2</span>
        </div>
        <button type="button" className="support-close" onClick={onClose} aria-label="Đóng"><Icon name="close"/></button>
        <h2 id="support-title">Trung tâm kết nối &amp; hỗ trợ</h2>
        <p>Quét mã QR hoặc mở trực tiếp Zalo, Telegram để mua key, gia hạn bản quyền và nhận hỗ trợ kỹ thuật.</p>
      </header>

      <div className="support-channel-grid">
        <article className="support-channel zalo-channel">
          <div className="support-channel-heading">
            <span className="support-brand zalo-brand">Zalo</span>
            <div><h3>Zalo cá nhân</h3><p>Hiếu đây rồi · 0349 887 132</p></div>
            <span className="support-channel-pill">Quét mã Zalo</span>
          </div>
          <div className="support-qr"><img src="./qr_zalo.png" alt="Mã QR Zalo của HT Studio"/></div>
          <p className="support-qr-tip">Mở Zalo trên điện thoại → chọn <strong>Quét mã QR</strong></p>
          <button type="button" className="support-primary zalo-action" onClick={() => void window.htDownloader.openExternal(ZALO_URL)}><Icon name="external"/>Mở Zalo Chat</button>
        </article>

        <article className="support-channel telegram-channel">
          <div className="support-channel-heading">
            <span className="support-brand telegram-brand">T</span>
            <div><h3>Telegram</h3><p>@NLTH_MEDIA · Hỗ trợ 24/7</p></div>
            <span className="support-channel-pill">Kênh hỗ trợ</span>
          </div>
          <div className="support-qr"><img src="./qr_telegram.png" alt="Mã QR Telegram @NLTH_MEDIA"/></div>
          <p className="support-qr-tip">Quét bằng camera điện thoại hoặc ứng dụng <strong>Telegram</strong></p>
          <div className="support-actions">
            <button type="button" className="support-primary telegram-action" onClick={() => void window.htDownloader.openExternal(TELEGRAM_URL)}><Icon name="external"/>Nhắn tin Telegram</button>
            <button type="button" className="support-copy" onClick={() => void copyTelegram()}><Icon name="copy"/>{copied ? 'Đã sao chép' : 'Sao chép ID'}</button>
          </div>
        </article>
      </div>

      <footer className="support-modal-footer"><span><Icon name="info"/>Khi cần hỗ trợ, hãy gửi ảnh màn hình và mô tả lỗi để được xử lý nhanh hơn.</span><button type="button" onClick={onClose}>Đóng</button></footer>
    </section>
  </div>;
}
