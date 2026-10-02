import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock3, ListChecks,
  Play, RefreshCw, Square, Timer, UsersRound,
} from 'lucide-react';

const pad = (value) => String(value).padStart(2, '0');
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const minutesOf = (value = '00:00') => {
  const [hour, minute] = String(value).split(':').map(Number);
  return (Number(hour) || 0) * 60 + (Number(minute) || 0);
};
const durationOf = (start, end) => {
  let duration = minutesOf(end) - minutesOf(start);
  if (duration <= 0) duration += 24 * 60;
  return duration;
};
const formatSelectedDate = (date) => new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(date);

function getEntryStatus(entry, selectedDate, logs, now) {
  const selected = dateKey(selectedDate);
  const today = dateKey(now);
  const relatedLogs = logs.filter((log) => String(log.timestamp || '').startsWith(selected)
    && log.pageName === entry.target.name
    && /phiên chạy|phiên xem|bắt đầu phiên|kết thúc phiên|tạm dừng phiên/i.test(`${log.action || ''} ${log.details || ''}`));
  const latest = relatedLogs[0];
  const isRunning = selected === today
    && entry.profile.executionStatus === 'running'
    && (entry.target.type === 'personal' || entry.profile.pageName === entry.target.name);
  if (isRunning) return { key: 'running', label: 'Đang chạy' };
  if (latest?.type === 'error' || latest?.type === 'danger') return { key: 'error', label: 'Lỗi' };
  if (latest?.type === 'success' && /kết thúc|hoàn thành/i.test(`${latest.action} ${latest.details}`)) {
    return { key: 'completed', label: 'Đã hoàn thành' };
  }
  if (selected < today) return { key: 'past', label: 'Đã qua' };
  if (selected > today) return { key: 'scheduled', label: 'Đã lên lịch' };
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const start = minutesOf(entry.slot.startTime);
  const end = start + durationOf(entry.slot.startTime, entry.slot.endTime);
  if (currentMinute < start) return { key: 'upcoming', label: 'Sắp chạy' };
  if (currentMinute <= end) return { key: 'waiting', label: 'Đang chờ' };
  return { key: 'past', label: 'Đã qua' };
}

export default function ScheduledRunsView({ profiles, logs, onRunNow, onStop, onEdit, onDeleteSchedule, onOpenLogs, onRefresh }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const entries = useMemo(() => profiles.flatMap((profile) => {
    const personal = (profile.scheduleConfig?.personalSchedules || []).filter((slot) => slot.enabled !== false)
      .map((slot) => ({ profile, target: { id: 'personal', name: 'Trang cá nhân', url: '', type: 'personal' }, slot, duration: durationOf(slot.startTime, slot.endTime) }));
    const pages = (profile.managedPages || []).filter((page) => page && typeof page === 'object' && page.enabled !== false)
      .flatMap((page) => {
        const slots = Array.isArray(page.schedules) ? page.schedules : (page.scheduleEnabled ? [{ id: `legacy-${page.id}`, startTime: page.startTime, endTime: page.endTime }] : []);
        return slots.filter((slot) => slot.enabled !== false).map((slot) => ({ profile, target: { ...page, type: 'page' }, slot, duration: durationOf(slot.startTime, slot.endTime) }));
      });
    return [...personal, ...pages];
  }).sort((a, b) => minutesOf(a.slot.startTime) - minutesOf(b.slot.startTime)), [profiles]);

  const rows = useMemo(() => entries.map((entry) => ({
    ...entry,
    status: getEntryStatus(entry, selectedDate, logs, now),
  })), [entries, selectedDate, logs, now]);

  const uniquePages = new Set(rows.map((row) => `${row.profile.id}:${row.target.id || row.target.name}`)).size;
  const totalMinutes = rows.reduce((total, row) => total + row.duration, 0);
  const runningCount = rows.filter((row) => row.status.key === 'running').length;
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const showNowLine = dateKey(selectedDate) === dateKey(now) && rows.length > 0;

  const changeDay = (amount) => setSelectedDate((current) => {
    const next = new Date(current);
    next.setDate(next.getDate() + amount);
    return next;
  });

  return (
    <div className="runs-screen">
      <section className="runs-banner">
        <span><CalendarDays size={24} /></span>
        <div><h3>Theo dõi lịch chạy trong ngày</h3><p>Tổng hợp các Page sẽ chạy theo ngày và khung giờ đã cấu hình.</p></div>
        <button type="button" onClick={onRefresh}><RefreshCw size={15} /> Làm mới dữ liệu</button>
      </section>

      <section className="runs-datebar">
        <div className="runs-date-navigation">
          <button type="button" aria-label="Ngày trước" onClick={() => changeDay(-1)}><ChevronLeft size={18} /></button>
          <label><CalendarDays size={17} /><input type="date" value={dateKey(selectedDate)} onChange={(event) => setSelectedDate(new Date(`${event.target.value}T12:00:00`))} /><strong>{formatSelectedDate(selectedDate)}</strong></label>
          <button type="button" aria-label="Ngày sau" onClick={() => changeDay(1)}><ChevronRight size={18} /></button>
        </div>
        <button type="button" className="runs-today" onClick={() => setSelectedDate(new Date())}>Hôm nay</button>
        <div className="runs-view-toggle"><button className="active">Theo ngày</button><button disabled title="Sẽ phát triển ở phiên bản sau">Theo tuần</button></div>
      </section>

      <section className="runs-metrics">
        <article><span className="blue"><ListChecks size={20} /></span><div><strong>{rows.length}</strong><b>Phiên trong ngày</b><small>Lịch đang được bật</small></div></article>
        <article><span className="violet"><UsersRound size={20} /></span><div><strong>{uniquePages}</strong><b>Danh tính</b><small>Trang cá nhân và Fanpage</small></div></article>
        <article><span className="amber"><Timer size={20} /></span><div><strong>{totalMinutes} phút</strong><b>Thời lượng dự kiến</b><small>Tổng thời gian chạy</small></div></article>
        <article><span className="green"><Play size={20} /></span><div><strong>{runningCount}</strong><b>Đang chạy</b><small>Cập nhật theo thời gian thực</small></div></article>
      </section>

      <section className="runs-table-card">
        <div className="runs-table-wrap">
          <table>
            <thead><tr><th>Thời gian</th><th>Hồ sơ</th><th>Danh tính chạy</th><th>IN</th><th>OUT</th><th>Thời lượng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.profile.id}-${row.target.id || row.target.name}-${row.slot.id}`} className={`run-row status-${row.status.key}`}>
                  <td><span className="run-time-range"><i />{row.slot.startTime}–{row.slot.endTime}</span></td>
                  <td><strong>{row.profile.name}</strong><small>{row.profile.status ? 'Hồ sơ đang bật' : 'Hồ sơ đang tắt'}</small></td>
                  <td><b>{row.target.name}</b><small title={row.target.url}>{row.target.type === 'personal' ? 'Tài khoản Facebook chính' : (row.target.url || 'Chưa có liên kết')}</small></td>
                  <td><span className="run-in"><Clock3 size={13} /> {row.slot.startTime}</span></td>
                  <td><span className="run-out"><Clock3 size={13} /> {row.slot.endTime}</span></td>
                  <td>{row.duration} phút</td>
                  <td><span className={`run-status ${row.status.key}`}><i />{row.status.label}</span></td>
                  <td><div className="run-actions">
                    {row.status.key === 'running'
                      ? <button className="danger" onClick={() => onStop(row.profile)}><Square size={13} fill="currentColor" /> Dừng ngay</button>
                      : row.status.key === 'completed' || row.status.key === 'error'
                        ? <button onClick={onOpenLogs}>Xem nhật ký</button>
                        : <button className="primary" onClick={() => onRunNow(row.profile, { ...row.target, scheduleEnabled: true, startTime: row.slot.startTime, endTime: row.slot.endTime })}><Play size={13} fill="currentColor" /> Chạy ngay</button>}
                    <button className="quiet" onClick={() => onEdit(row.profile)}>Sửa lịch</button>
                    <button className="danger" onClick={() => onDeleteSchedule(row.profile, row.target, row.slot)}>Xóa lịch</button>
                  </div></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="8" className="runs-empty"><CalendarDays size={30} /><strong>Chưa có lịch trong ngày</strong><span>Hãy bật lịch cho Fanpage tại tab “Lịch chạy”.</span></td></tr>}
            </tbody>
          </table>
          {showNowLine && <div className="runs-now-note">Thời gian hiện tại: {pad(Math.floor(currentMinute / 60))}:{pad(currentMinute % 60)}</div>}
        </div>
        <footer className="runs-legend"><span><i className="completed" />Hoàn thành</span><span><i className="running" />Đang chạy</span><span><i className="waiting" />Đang chờ</span><span><i className="error" />Lỗi</span></footer>
      </section>
    </div>
  );
}
