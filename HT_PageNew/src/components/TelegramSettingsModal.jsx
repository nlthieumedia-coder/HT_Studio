import React, { useEffect, useState } from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import { ElectronService } from '../services/electronService';

export default function TelegramSettingsModal({ isOpen, onClose, addToast }) {
  const [form, setForm] = useState({ enabled: false, chatId: '', token: '', hasToken: false, events: { start: true, end: true, error: true } });
  const [busy, setBusy] = useState(false);
  const [foundChats, setFoundChats] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    ElectronService.getTelegramConfig().then((result) => {
      if (result.success) setForm((current) => ({ ...current, ...result.config, token: '' }));
    });
  }, [isOpen]);

  const save = async () => {
    setBusy(true);
    const result = await ElectronService.saveTelegramConfig(form);
    setBusy(false);
    if (!result.success) return addToast?.(`Không thể lưu Telegram: ${result.message}`, 'error');
    setForm((current) => ({ ...current, token: '', hasToken: result.hasToken }));
    addToast?.('Đã lưu cấu hình Telegram.', 'success');
  };

  const test = async () => {
    setBusy(true);
    const saved = await ElectronService.saveTelegramConfig(form);
    if (!saved.success) {
      setBusy(false);
      return addToast?.(`Không thể lưu Telegram: ${saved.message}`, 'error');
    }
    const result = await ElectronService.testTelegram();
    setBusy(false);
    addToast?.(result.success ? 'Đã gửi tin nhắn thử tới Telegram.' : `Gửi Telegram thất bại: ${result.message}`, result.success ? 'success' : 'error');
    if (result.success) setForm((current) => ({ ...current, token: '', hasToken: true }));
  };

  const discoverChats = async () => {
    setBusy(true);
    const result = await ElectronService.discoverTelegramChats(form.token);
    setBusy(false);
    if (!result.success) return addToast?.(`Không thể tìm Chat ID: ${result.message}`, 'error');
    setFoundChats(result.chats || []);
    if (result.chats?.length === 1) {
      setForm((current) => ({ ...current, chatId: result.chats[0].id }));
      addToast?.(`Đã tìm thấy Chat ID của ${result.chats[0].name}.`, 'success');
    } else if (!result.chats?.length) {
      addToast?.('Chưa thấy cuộc trò chuyện. Hãy bấm Start và gửi một tin nhắn cho bot rồi thử lại.', 'warning');
    }
  };

  const toggleEvent = (name) => setForm((current) => ({ ...current, events: { ...current.events, [name]: !current.events[name] } }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="560px" title="Thông báo Telegram">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '.75rem', borderRadius: 8, border: '1px solid rgba(16,185,129,.35)', color: '#6ee7b7', fontSize: '.8rem' }}>
          <ShieldCheck size={15} style={{ display: 'inline', marginRight: 6 }} /> Bot Token được mã hóa bằng Windows DPAPI và không xuất hiện trong nhật ký.
        </div>
        <label className="form-label">Bot Token</label>
        <input className="form-control" type="password" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder={form.hasToken ? 'Đã lưu token — để trống nếu không đổi' : '123456789:AA...'} />
        <label className="form-label">Chat ID</label>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input className="form-control" value={form.chatId} onChange={(e) => setForm({ ...form, chatId: e.target.value })} placeholder="Ví dụ: 123456789 hoặc -100..." />
          <button type="button" className="btn btn-secondary" onClick={discoverChats} disabled={busy || (!form.token && !form.hasToken)} style={{ whiteSpace: 'nowrap' }}>Tự tìm Chat ID</button>
        </div>
        {foundChats.length > 1 && (
          <select className="form-control" value={form.chatId} onChange={(e) => setForm({ ...form, chatId: e.target.value })}>
            <option value="">Chọn cuộc trò chuyện vừa tìm thấy</option>
            {foundChats.map((chat) => <option key={chat.id} value={chat.id}>{chat.name} ({chat.type}) — {chat.id}</option>)}
          </select>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Bật gửi thông báo tự động</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem' }}>
          <label><input type="checkbox" checked={form.events.start} onChange={() => toggleEvent('start')} /> Bắt đầu phiên</label>
          <label><input type="checkbox" checked={form.events.end} onChange={() => toggleEvent('end')} /> Kết thúc phiên</label>
          <label><input type="checkbox" checked={form.events.error} onChange={() => toggleEvent('error')} /> Lỗi/Proxy/Xác minh</label>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={test} disabled={busy}><Send size={14} /> Gửi thử</button>
        <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>Lưu cấu hình</button>
      </div>
    </Modal>
  );
}
