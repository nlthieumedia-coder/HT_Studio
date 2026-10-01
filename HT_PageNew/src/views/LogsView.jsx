import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, FileText, Info, Search, Trash2, XCircle } from 'lucide-react';

const PAGE_SIZE = 7;

export default function LogsView({ logs, onClearLogs }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [page, setPage] = useState(1);

  const todayKey = new Date().toLocaleDateString('en-CA');
  const filteredLogs = useMemo(() => logs.filter((log) => {
    const keyword = searchTerm.trim().toLowerCase();
    const matchesSearch = !keyword || [log.profileName, log.pageName, log.action, log.details].some((value) => String(value || '').toLowerCase().includes(keyword));
    const matchesType = typeFilter === 'all' || log.type === typeFilter;
    const matchesDate = dateFilter === 'all' || String(log.timestamp || '').startsWith(todayKey);
    return matchesSearch && matchesType && matchesDate;
  }), [logs, searchTerm, typeFilter, dateFilter, todayKey]);

  useEffect(() => setPage(1), [searchTerm, typeFilter, dateFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const successCount = logs.filter((log) => log.type === 'success').length;
  const warningCount = logs.filter((log) => log.type === 'warning').length;
  const errorCount = logs.filter((log) => ['error', 'danger'].includes(log.type)).length;

  const metrics = [
    { label: 'Tổng nhật ký', value: logs.length, note: 'Toàn bộ hoạt động', icon: FileText, tone: 'blue' },
    { label: 'Hoạt động thành công', value: successCount, note: 'Đã hoàn tất', icon: CheckCircle2, tone: 'green' },
    { label: 'Cần lưu ý', value: warningCount, note: 'Cần kiểm tra', icon: AlertTriangle, tone: 'amber' },
    { label: 'Lỗi', value: errorCount, note: 'Cần xử lý', icon: XCircle, tone: 'red' },
  ];

  const renderType = (type) => {
    if (type === 'success') return <span className="log-type success"><CheckCircle2 size={13} /> Thành công</span>;
    if (type === 'warning') return <span className="log-type warning"><AlertTriangle size={13} /> Thay đổi</span>;
    if (type === 'error' || type === 'danger') return <span className="log-type error"><XCircle size={13} /> Lỗi</span>;
    return <span className="log-type info"><Info size={13} /> Thông tin</span>;
  };

  return (
    <div className="logs-screen">
      <section className="logs-toolbar">
        <label className="logs-search"><Search size={18} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm nhật ký theo tên hồ sơ, hành động, chi tiết..." /></label>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Tất cả loại nhật ký</option><option value="success">Thành công</option><option value="info">Thông tin</option><option value="warning">Cảnh báo / Thay đổi</option><option value="error">Lỗi</option></select>
        <label className="logs-date"><CalendarDays size={16} /><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="all">Tất cả thời gian</option><option value="today">Hôm nay</option></select></label>
        <button className="logs-clear" onClick={onClearLogs}><Trash2 size={16} /> Xóa nhật ký</button>
      </section>

      <section className="logs-metrics">{metrics.map(({ label, value, note, icon: Icon, tone }) => <article className="logs-metric" key={label}><span className={tone}><Icon size={20} /></span><div><strong>{value}</strong><b>{label}</b><small>{note}</small></div></article>)}</section>

      <section className="logs-table-card">
        <div className="logs-table-wrap"><table><thead><tr><th>Thời gian</th><th>Tên hồ sơ</th><th>Page liên quan</th><th>Hành động thực hiện</th><th>Loại</th><th>Chi tiết nhật ký</th></tr></thead><tbody>
          {visibleLogs.map((log) => <tr key={log.id}><td><time>{log.timestamp}</time></td><td><strong>{log.profileName}</strong></td><td><b>{log.pageName}</b></td><td><strong>{log.action}</strong></td><td>{renderType(log.type)}</td><td><p>{log.details}</p></td></tr>)}
          {!visibleLogs.length && <tr><td colSpan="6" className="logs-empty">Chưa có nhật ký hoạt động phù hợp.</td></tr>}
        </tbody></table></div>
        <footer className="logs-pagination"><span>Hiển thị {filteredLogs.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} / {filteredLogs.length} nhật ký</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button>{Array.from({ length: Math.min(pageCount, 5) }, (_, index) => index + 1).map((number) => <button className={currentPage === number ? 'active' : ''} onClick={() => setPage(number)} key={number}>{number}</button>)}<button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight size={16} /></button></div></footer>
      </section>
    </div>
  );
}
