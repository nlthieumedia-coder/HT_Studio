import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText } from 'lucide-react';
import Modal from './Modal';

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

function TimePicker24({ value, onChange, tone }) {
  const [hour = '00', minute = '00'] = String(value || '00:00').split(':');
  return (
    <div className={`time-picker-24 ${tone}`}>
      <select aria-label="Giờ" value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)}>{hours.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <b>:</b>
      <select aria-label="Phút" value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)}>{minutes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <small>24h</small>
    </div>
  );
}

export default function ScheduleModal({ isOpen, onClose, profile, onSaveSchedule }) {
  const [step, setStep] = useState(1);
  const [scheduleConfig, setScheduleConfig] = useState({ scheduleEnabled: false, startTime: '08:30', durationMinutes: 30, daysOfWeek: [1, 2, 3, 4, 5, 6, 0], restIntervalMinutes: 60 });
  const [pages, setPages] = useState([]);

  useEffect(() => {
    if (!profile || !isOpen) return;
    setStep(1);
    setScheduleConfig(profile.scheduleConfig || { scheduleEnabled: false, startTime: '08:30', durationMinutes: 30, daysOfWeek: [1, 2, 3, 4, 5, 6, 0], restIntervalMinutes: 60 });
    setPages((profile.managedPages || []).map((page, index) => typeof page === 'string'
      ? { id: `legacy-${index}`, name: page, url: '', enabled: true, scheduleEnabled: false, startTime: '08:30', endTime: '09:00' }
      : { ...page, enabled: true, scheduleEnabled: page.scheduleEnabled === true, startTime: page.startTime || '08:30', endTime: page.endTime || '09:00' }));
  }, [profile, isOpen]);

  if (!profile) return null;
  const selected = pages.filter((page) => page.scheduleEnabled);
  const updatePage = (id, patch) => setPages((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const save = () => {
    onSaveSchedule(profile.id, { ...scheduleConfig, scheduleEnabled: false }, pages);
    onClose();
  };

  const steps = ['Chọn Fanpage', 'Đặt giờ IN / OUT', 'Xác nhận'];
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="860px" title={`Thiết lập lịch cho hồ sơ: ${profile.name}`}>
      <div className="modal-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem', marginBottom: '1rem' }}>
          {steps.map((label, index) => <div className={`schedule-step ${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'done' : ''}`} key={label}><span>{step > index + 1 ? '✓' : index + 1}</span><b>{label}</b></div>)}
        </div>

        {step === 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>Chọn Fanpage sẽ tự động chạy theo lịch. Fanpage không chọn vẫn có thể chạy thủ công.</p>
          {pages.map((page) => <label key={page.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.8rem', border: `1px solid ${page.scheduleEnabled ? 'rgba(59,130,246,.45)' : 'var(--border-color)'}`, borderRadius: 8, cursor: 'pointer' }}><input type="checkbox" checked={page.scheduleEnabled} onChange={(e) => updatePage(page.id, { scheduleEnabled: e.target.checked })} /><FileText size={16} color="#60a5fa" /><div><strong style={{ color: 'white' }}>{page.name}</strong><div style={{ color: 'var(--text-muted)', fontSize: '.7rem' }}>{page.url}</div></div></label>)}
          {!pages.length && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Hồ sơ chưa có Fanpage. Hãy thêm ở tab Hồ sơ tài khoản trước.</div>}
        </div>}

        {step === 2 && <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>Đặt giờ bắt đầu (IN) và kết thúc (OUT) cho từng Fanpage. Lịch chạy hằng ngày theo múi giờ Asia/Bangkok.</p>
          {selected.map((page) => <div className="page-time-row" key={page.id}><div><strong>{page.name}</strong><small>Chạy hằng ngày</small></div><label className="time-block in"><span>IN · Bắt đầu</span><TimePicker24 tone="in" value={page.startTime} onChange={(value) => updatePage(page.id, { startTime: value })} /></label><span className="time-arrow">→</span><label className="time-block out"><span>OUT · Kết thúc</span><TimePicker24 tone="out" value={page.endTime} onChange={(value) => updatePage(page.id, { endTime: value })} /></label></div>)}
          {!selected.length && <div style={{ padding: '2rem', textAlign: 'center', color: '#f59e0b' }}>Chưa chọn Fanpage nào. Hãy quay lại bước 1.</div>}
        </div>}

        {step === 3 && <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
          <div style={{ padding: '.85rem', color: '#6ee7b7', border: '1px solid rgba(16,185,129,.35)', borderRadius: 8 }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} />Sẽ lưu {selected.length} lịch Fanpage cho hồ sơ “{profile.name}”.</div>
          {selected.map((page) => <div className="schedule-confirm-row" key={page.id}><div><strong>{page.name}</strong><small>Hằng ngày · Asia/Bangkok</small></div><span className="confirm-in"><Clock size={14} /> IN {page.startTime}</span><span className="confirm-out">OUT {page.endTime}</span></div>)}
          {!selected.length && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Không có lịch Page nào được bật. Lưu sẽ tắt toàn bộ lịch Page của hồ sơ.</div>}
        </div>}
      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={step === 1 ? onClose : () => setStep((value) => value - 1)}>{step === 1 ? 'Đóng' : <><ChevronLeft size={14} /> Quay lại</>}</button>
        {step < 3 ? <button className="btn btn-primary" onClick={() => setStep((value) => value + 1)} disabled={step === 1 && !pages.length}>Tiếp tục <ChevronRight size={14} /></button> : <button className="btn btn-primary" onClick={save}><CheckCircle2 size={14} /> Xác nhận & lưu lịch</button>}
      </div>
    </Modal>
  );
}
