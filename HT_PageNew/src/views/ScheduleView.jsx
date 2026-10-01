import React from 'react';
import { CalendarClock, ChevronRight, Clock, FileText, ShieldCheck } from 'lucide-react';

export default function ScheduleView({ profiles, onOpenScheduleModal }) {
  return (
    <div className="schedule-screen">
      <section className="schedule-banner">
        <span className="schedule-banner-icon"><CalendarClock size={25} /></span>
        <div><h3>Cấu hình lịch theo từng hồ sơ</h3><p>Chọn một hồ sơ rồi thực hiện lần lượt: chọn Fanpage, đặt giờ IN/OUT và xác nhận lịch.</p></div>
        <span className="schedule-safe"><ShieldCheck size={15} /> Không tự chạy bù khi mở lại app</span>
      </section>

      <section className="glass-panel" style={{ overflow: 'hidden' }}>
        <header style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr .8fr auto', gap: '1rem', padding: '.85rem 1rem', color: 'var(--text-muted)', fontSize: '.72rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)' }}>
          <span>HỒ SƠ</span><span>FANPAGE ĐÃ LƯU</span><span>LỊCH ĐANG BẬT</span><span>THAO TÁC</span>
        </header>
        {profiles.map((profile) => {
          const pages = (profile.managedPages || []).filter((page) => page && typeof page === 'object');
          const activeSchedules = pages.filter((page) => page.scheduleEnabled);
          return (
            <article key={profile.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr .8fr auto', gap: '1rem', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div><strong style={{ color: 'white', fontSize: '.95rem' }}>{profile.name}</strong><div style={{ color: 'var(--text-muted)', fontSize: '.75rem', marginTop: 4 }}>{profile.proxy ? 'Có proxy kết nối' : 'Dùng IP máy'}</div></div>
              <span className="badge badge-info"><FileText size={13} /> {pages.length} Fanpage</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><strong style={{ color: activeSchedules.length ? '#087a53' : 'var(--text-muted)' }}>{activeSchedules.length} lịch bật</strong>{activeSchedules.length > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '.74rem', lineHeight: 1.45 }}><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />{activeSchedules.map((page) => `${page.name} ${page.startTime}`).join(', ')}</span>}</div>
              <button className="btn btn-primary btn-sm" onClick={() => onOpenScheduleModal(profile)}>Cấu hình từng bước <ChevronRight size={15} /></button>
            </article>
          );
        })}
        {!profiles.length && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có hồ sơ để thiết lập lịch chạy.</div>}
      </section>
    </div>
  );
}
