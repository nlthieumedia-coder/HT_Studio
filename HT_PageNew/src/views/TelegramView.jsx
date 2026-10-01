import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Send, Settings, Trash2, XCircle } from 'lucide-react';
import { ElectronService } from '../services/electronService';

export default function TelegramView({ onOpenSettings, addToast }) {
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [configResult, logsResult] = await Promise.all([ElectronService.getTelegramConfig(), ElectronService.getTelegramLogs()]);
    if (configResult.success) setConfig(configResult.config);
    if (logsResult.success) setLogs(logsResult.logs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const stats = useMemo(() => ({ sent: logs.filter((item) => item.success).length, failed: logs.filter((item) => !item.success).length }), [logs]);
  const connected = Boolean(config?.enabled && config?.hasToken && config?.chatId);

  const clearLogs = async () => {
    await ElectronService.clearTelegramLogs();
    setLogs([]);
    addToast?.('Đã xóa lịch sử gửi Telegram.', 'info');
  };

  return (
    <div className="telegram-screen">
      <section className="telegram-banner">
        <span><Send size={25} /></span>
        <div><h3>Telegram & thông báo nhật ký</h3><p>Theo dõi việc chuyển nhật ký bắt đầu, kết thúc và sự cố từ ứng dụng sang Telegram.</p></div>
        <div className="telegram-banner-actions"><button className="btn btn-secondary" onClick={load}><RefreshCw size={15} /> Làm mới</button><button className="btn btn-primary" onClick={onOpenSettings}><Settings size={15} /> Cấu hình Telegram</button></div>
      </section>

      <section className="telegram-metrics">
        <article><span className="blue"><Send size={21} /></span><div><strong>{connected ? 'Đang bật' : 'Chưa bật'}</strong><small>Trạng thái kết nối</small></div></article>
        <article><span className="green"><CheckCircle2 size={21} /></span><div><strong>{stats.sent}</strong><small>Thông báo đã gửi</small></div></article>
        <article><span className="red"><XCircle size={21} /></span><div><strong>{stats.failed}</strong><small>Thông báo gửi lỗi</small></div></article>
      </section>

      <section className="telegram-command-card">
        <header><div><h3>Menu chat với bot</h3><p>Bấm Menu trong Telegram hoặc nhập lệnh để kiểm tra hệ thống từ xa.</p></div></header>
        <div className="telegram-command-grid">
          {[
            ['/tongquan', 'Tổng quan hồ sơ, Page và lịch'],
            ['/lich', 'Danh sách lịch IN/OUT đang bật'],
            ['/fanpage', 'Danh sách Fanpage theo hồ sơ'],
            ['/them_page', 'Thêm tên và link Fanpage'],
            ['/chay_page', 'Chọn Fanpage và chạy ngay'],
            ['/them_lich', 'Đặt giờ IN/OUT cho Fanpage'],
            ['/dangchay', 'Các phiên Feed/Reels đang hoạt động'],
            ['/dung', 'Dừng phiên đang chạy của hồ sơ'],
            ['/xacnhan / /huy', 'Xác nhận hoặc hủy thao tác'],
            ['/trogiup', 'Hiển thị lại toàn bộ lệnh'],
          ].map(([command, description]) => <article key={command}><b>{command}</b><span>{description}</span></article>)}
        </div>
        <footer>Bot chỉ phản hồi đúng Chat ID đã lưu trong ứng dụng.</footer>
      </section>

      <section className="telegram-log-card">
        <header><div><h3>Tiến trình gửi thông báo</h3><p>Lịch sử phản hồi gần nhất từ Telegram Bot</p></div><button onClick={clearLogs} disabled={!logs.length}><Trash2 size={15} /> Xóa lịch sử</button></header>
        <div className="telegram-table-wrap"><table><thead><tr><th>Thời gian</th><th>Trạng thái</th><th>Nội dung nhật ký gửi Telegram</th><th>Phản hồi</th></tr></thead><tbody>
          {logs.map((item) => <tr key={item.id}><td><time>{new Date(item.timestamp).toLocaleString('vi-VN')}</time></td><td>{item.success ? <span className="telegram-result success"><CheckCircle2 size={13} /> Đã gửi</span> : <span className="telegram-result error"><AlertTriangle size={13} /> Gửi lỗi</span>}</td><td><p>{item.text}</p></td><td><b className={item.success ? 'success-text' : 'error-text'}>{item.message}</b></td></tr>)}
          {!logs.length && <tr><td colSpan="4" className="telegram-empty">{loading ? 'Đang tải dữ liệu...' : 'Chưa có thông báo Telegram nào được gửi.'}</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
