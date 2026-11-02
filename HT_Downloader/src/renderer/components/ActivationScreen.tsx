import { useEffect, useState } from 'react';
import type { LicenseActivationResult, LicenseStatus } from '../../shared/types';
import { Icon } from './Icon';
import { SupportModal } from './SupportModal';

export function ActivationScreen({ status, onActivated }: { status: LicenseStatus; onActivated(status: LicenseStatus): void }): React.JSX.Element {
  const [key, setKey] = useState('');
  const [message, setMessage] = useState(status.error ?? '');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    void navigator.clipboard.readText().then(text => {
      const detected = text.match(/HTDOWN-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}/i)?.[0];
      if (detected) setKey(detected.toUpperCase());
    }).catch(() => undefined);
  }, []);

  const activate = async (): Promise<void> => {
    const normalized = key.trim().toUpperCase();
    if (!normalized) {
      setMessageType('error');
      setMessage('Vui lòng nhập mã key bản quyền.');
      return;
    }
    setActivating(true);
    setMessage('');
    let result: LicenseActivationResult;
    try {
      result = await window.htDownloader.licenseActivate(normalized);
    } catch (error) {
      result = { ok: false, hwid: status.hwid, error: error instanceof Error ? error.message : 'Không thể xác thực mã bản quyền.' };
    }
    if (!result.ok) {
      setActivating(false);
      setMessageType('error');
      setMessage(result.error ?? 'Mã bản quyền không hợp lệ hoặc đã bị khóa.');
      return;
    }
    setMessageType('success');
    setMessage('Kích hoạt thành công! Đang mở HT Downloader...');
    const checked = await window.htDownloader.licenseCheck();
    if (checked.licensed) onActivated(checked);
    else {
      setActivating(false);
      setMessageType('error');
      setMessage(checked.error ?? 'Không thể xác nhận trạng thái bản quyền.');
    }
  };

  const paste = async (): Promise<void> => {
    try {
      const value = await navigator.clipboard.readText();
      setKey(value.trim().toUpperCase());
      setMessage('');
    } catch { /* Keep the input focused when clipboard access is unavailable. */ }
  };

  const copyHwid = async (): Promise<void> => {
    await navigator.clipboard.writeText(status.hwid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return <div className="activation-screen">
    <div className="activation-backdrop"><i className="license-orb orb-one"/><i className="license-orb orb-two"/><i className="license-orb orb-three"/></div>
    <section className="activation-card">
      <header className="activation-header">
        <div className="activation-badge-group">
          <span className="activation-badge"><Icon name="key"/>BẢN QUYỀN THƯƠNG MẠI</span>
          <span className="activation-version-pill">v2.0.2</span>
        </div>
        <div className="activation-logo"><img src="./logo_icon.png" alt="HT Studio"/></div>
        <div className="activation-title-row">
          <h1>HT Downloader Pro</h1>
          <span className="activation-version-badge">v2.0.2</span>
        </div>
        <p>Nhập Key bản quyền để kích hoạt và sử dụng phần mềm trên thiết bị này.</p>
      </header>
      <div className="activation-body">
        <div className="hwid-box">
          <div className="hwid-heading"><strong>MÃ THIẾT BỊ (HWID)</strong><span>1 Máy = 1 Bản quyền</span></div>
          <div className="hwid-value"><code>{status.hwid}</code><button type="button" onClick={() => void copyHwid()}><Icon name="copy"/>{copied ? 'Đã chép' : 'Sao chép'}</button></div>
          <p>Gửi mã này cho HT Studio nếu bạn cần cấp key khóa cứng riêng cho máy tính này.</p>
        </div>
        <div className="license-input-box">
          <label htmlFor="license-key">MÃ KEY BẢN QUYỀN (LICENSE KEY)</label>
          <div className="license-key-field"><Icon name="key"/><input id="license-key" autoFocus value={key} maxLength={33} spellCheck={false} autoComplete="off" placeholder="HTDOWN-XXXX-XXXX-XXXX-XXXX" onChange={event => { setKey(event.target.value.toUpperCase()); setMessage(''); }} onKeyDown={event => { if (event.key === 'Enter') void activate(); }}/><button type="button" onClick={() => void paste()}><Icon name="paste"/>Dán</button></div>
          {message && <div className={`activation-message ${messageType}`}>{message}</div>}
        </div>
        <button type="button" className="activate-submit" disabled={activating} onClick={() => void activate()}><Icon name="key"/>{activating ? 'ĐANG XÁC THỰC MÃ BẢN QUYỀN...' : 'KÍCH HOẠT VÀO ỨNG DỤNG'}</button>
      </div>
      <footer className="activation-footer"><span>Chưa có Key bản quyền hoặc cần gia hạn?</span><button type="button" onClick={() => setSupportOpen(true)}>Liên hệ mua Key qua Zalo / Telegram</button></footer>
    </section>
    <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)}/>
  </div>;
}
