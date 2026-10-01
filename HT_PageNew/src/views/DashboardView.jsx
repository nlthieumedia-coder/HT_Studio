import React, { useMemo, useState } from 'react';
import {
  Activity, ArrowRight, CalendarClock, CheckCircle2, ChevronRight, Clock3,
  History, Play, Plus, Rocket, Search, Server, ShieldCheck, Users
} from 'lucide-react';

const formatTime = (profile) => profile.scheduleConfig?.startTime || '08:30';

export default function DashboardView({ profiles, schedules, logs, onNavigateToProfiles, onNavigateToSchedule, onNavigateToLogs, onOpenAddModal, onToggleAll }) {
  const [searchTerm, setSearchTerm] = useState('');
  const totalProfiles = profiles.length;
  const activeProfiles = profiles.filter((profile) => profile.status).length;
  const activeSchedules = profiles.filter((profile) => profile.scheduleConfig?.scheduleEnabled).length
    || schedules.filter((schedule) => schedule.status).length;
  const filteredProfiles = useMemo(() => profiles.filter((profile) => {
    const keyword = searchTerm.trim().toLowerCase();
    return !keyword || [profile.name, profile.pageName, profile.proxy].some((value) => String(value || '').toLowerCase().includes(keyword));
  }), [profiles, searchTerm]);
  const upcomingProfiles = profiles.filter((profile) => profile.status).slice(0, 4);

  const metrics = [
    { label: 'Tổng hồ sơ', value: totalProfiles, note: `+0 hôm nay`, icon: Users, tone: 'blue' },
    { label: 'Sẵn sàng chạy', value: activeProfiles, note: totalProfiles ? `${Math.round((activeProfiles / totalProfiles) * 100)}% khả dụng` : 'Chưa có hồ sơ', icon: Play, tone: 'green' },
    { label: 'Lịch tự động', value: activeSchedules, note: 'Đang hoạt động', icon: CalendarClock, tone: 'blue' },
    { label: 'Nhật ký hoạt động', value: logs.length, note: 'Đã ghi nhận', icon: History, tone: 'blue' },
  ];

  return (
    <div className="overview-shell">
      <div className="overview-main">
        <section className="overview-steps overview-card">
          <div className="overview-steps-copy"><b>BẮT ĐẦU NHANH</b><span>Thực hiện theo các bước để<br />vận hành hệ thống</span></div>
          <div className="overview-step-list">
            {[
              ['1', Users, 'Tạo hồ sơ', 'Tài khoản & Proxy', onOpenAddModal],
              ['2', Server, 'Chọn Page', 'Page cần vận hành', onNavigateToProfiles],
              ['3', CalendarClock, 'Đặt lịch', 'Giờ và thời lượng', onNavigateToSchedule],
              ['4', Activity, 'Theo dõi', 'Kết quả hoạt động', onNavigateToLogs],
            ].map(([number, Icon, title, hint, action], index) => (
              <React.Fragment key={title}>
                <button className="overview-step" onClick={action}><span className={`overview-step-number ${index === 2 ? 'done' : ''}`}>{number}</span><span className="overview-step-icon"><Icon size={19} /></span><span><strong>{title}</strong><small>{hint}</small></span></button>
                {index < 3 && <ChevronRight className="overview-step-arrow" size={20} />}
              </React.Fragment>
            ))}
          </div>
        </section>

        <section className="overview-hero overview-card">
          <span className="overview-hero-icon"><Rocket size={28} /></span>
          <div><b>TRUNG TÂM ĐIỀU KHIỂN</b><h2>{totalProfiles ? 'Hệ thống đã sẵn sàng để vận hành!' : 'Bắt đầu tạo hồ sơ đầu tiên!'}</h2><p>Bạn có {activeProfiles}/{totalProfiles} hồ sơ đang bật. Kiểm tra nhanh trạng thái trước khi chạy.</p></div>
          <div className="overview-hero-actions"><button className="overview-primary" onClick={onOpenAddModal}><Plus size={18} /> Thêm hồ sơ</button><button className="overview-secondary" onClick={() => onToggleAll(true)} disabled={!totalProfiles}><Play size={17} /> Bật tất cả</button></div>
        </section>

        <section className="overview-metrics">
          {metrics.map(({ label, value, note, icon: Icon, tone }) => <article className="overview-metric overview-card" key={label}><span className={`overview-metric-icon ${tone}`}><Icon size={20} /></span><div><span>{label}</span><strong>{value}</strong><small className={tone === 'green' ? 'positive' : ''}>{note}</small></div><ChevronRight size={18} /></article>)}
        </section>

        <section className="overview-profiles overview-card">
          <div className="overview-section-head"><div className="overview-title"><span><Users size={20} /></span><div><h3>Danh sách hồ sơ</h3><p>Theo dõi trạng thái các hồ sơ và Page đang vận hành</p></div></div><div className="overview-table-actions"><label><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm kiếm hồ sơ, Page..." /></label><button onClick={onNavigateToProfiles}>Quản lý hồ sơ <ChevronRight size={15} /></button></div></div>
          <div className="overview-table-wrap"><table><thead><tr><th>#</th><th>Hồ sơ</th><th>Page</th><th>Proxy</th><th>Lịch chạy</th><th>Trạng thái</th></tr></thead><tbody>
            {filteredProfiles.slice(0, 6).map((profile, index) => <tr key={profile.id}><td>{index + 1}</td><td><div className="overview-profile-cell"><span className="overview-avatar">{profile.name?.charAt(0)?.toUpperCase() || 'H'}</span><div><strong>{profile.name}</strong><small>#{String(profile.id).slice(-6)}</small></div></div></td><td><strong>{profile.pageName || 'Chưa chọn Page'}</strong></td><td><code>{profile.proxy || 'IP máy'}</code></td><td><strong>{formatTime(profile)}</strong><small>Mỗi ngày</small></td><td>{profile.status ? <span className="overview-status"><i /> Đang bật</span> : <span className="overview-status off"><i /> Đang tắt</span>}</td></tr>)}
            {!filteredProfiles.length && <tr><td colSpan="6" className="overview-empty">Không tìm thấy hồ sơ phù hợp.</td></tr>}
          </tbody></table></div>
          <div className="overview-table-footer">Hiển thị {Math.min(filteredProfiles.length, 6)} / {profiles.length} hồ sơ <button onClick={onNavigateToProfiles}>Xem tất cả <ArrowRight size={14} /></button></div>
        </section>
      </div>

      <aside className="overview-side">
        <section className="overview-side-card overview-card"><div className="overview-side-title"><Activity size={20} /><h3>Trạng thái hệ thống</h3></div><div className="overview-health"><div><i /><span>Hồ sơ hoạt động</span><b>{activeProfiles}/{totalProfiles}</b></div><div><i /><span>Lịch tự động</span><b>{activeSchedules}</b></div><div><i /><span>Lưu trữ cục bộ</span><b>An toàn</b></div><div><i /><span>Tài nguyên hệ thống</span><b>Ổn định</b></div></div></section>
        <section className="overview-side-card overview-card"><div className="overview-side-title"><CalendarClock size={20} /><h3>Lịch chạy sắp tới</h3><button onClick={onNavigateToProfiles}>Xem tất cả</button></div><div className="overview-timeline">{upcomingProfiles.length ? upcomingProfiles.map((profile, index) => <div key={profile.id}><span className={index === 0 ? 'active' : ''} /><time>{formatTime(profile)}</time><p><strong>{profile.name}</strong><small>{profile.pageName || 'Chưa chọn Page'}</small></p></div>) : <p className="overview-side-empty">Chưa có lịch sắp tới.</p>}</div></section>
        <section className="overview-side-card overview-card"><div className="overview-side-title amber"><History size={20} /><h3>Hoạt động gần đây</h3></div><div className="overview-activity">{logs.slice(0, 4).map((log) => <div key={log.id}><span><CheckCircle2 size={14} /></span><p>{log.action}<small>{log.profileName}</small></p><time>{log.timestamp}</time></div>)}{!logs.length && <p className="overview-side-empty">Chưa có hoạt động nào.</p>}</div></section>
        <div className="overview-safe"><ShieldCheck size={17} /><span>Dữ liệu được lưu an toàn trên máy</span></div>
      </aside>
    </div>
  );
}
