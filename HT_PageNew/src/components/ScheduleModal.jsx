import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Plus, Trash2, UserRound } from 'lucide-react';
import Modal from './Modal';

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const newSlot = (startTime = '08:30', endTime = '09:00') => ({ id: `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`, enabled: true, startTime, endTime });
const addMinutes = (time, amount) => { const [h, m] = time.split(':').map(Number); const total = (h * 60 + m + amount) % 1440; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };

function TimePicker24({ value, onChange, tone }) {
  const [hour = '00', minute = '00'] = String(value || '00:00').split(':');
  return <div className={`time-picker-24 ${tone}`}><select aria-label="Giờ" value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)}>{hours.map((item) => <option key={item}>{item}</option>)}</select><b>:</b><select aria-label="Phút" value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)}>{minutes.map((item) => <option key={item}>{item}</option>)}</select><small>24h</small></div>;
}

const intervals = (slot) => {
  const toMinutes = (value) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
  const start = toMinutes(slot.startTime);
  let end = toMinutes(slot.endTime);
  if (end <= start) end += 1440;
  return end > 1440 ? [[start, end], [0, end - 1440]] : [[start, end]];
};
const overlaps = (left, right) => intervals(left).some(([a, b]) => intervals(right).some(([c, d]) => a < d && c < b));
const normalizePage = (page, index) => {
  const item = typeof page === 'string' ? { id: `legacy-${index}`, name: page, url: '', enabled: true } : { ...page };
  const schedules = Array.isArray(item.schedules)
    ? item.schedules
    : item.scheduleEnabled ? [newSlot(item.startTime || '08:30', item.endTime || '09:00')] : [];
  return { ...item, enabled: true, schedules };
};

export default function ScheduleModal({ isOpen, onClose, profile, onSaveSchedule }) {
  const [step, setStep] = useState(1);
  const [scheduleConfig, setScheduleConfig] = useState({});
  const [pages, setPages] = useState([]);
  const [personalSchedules, setPersonalSchedules] = useState([]);

  useEffect(() => {
    if (!profile || !isOpen) return;
    const config = profile.scheduleConfig || {};
    setStep(1);
    setScheduleConfig(config);
    setPersonalSchedules(Array.isArray(config.personalSchedules) ? config.personalSchedules : []);
    setPages((profile.managedPages || []).map(normalizePage));
  }, [profile, isOpen]);

  const targets = useMemo(() => [
    { id: 'personal', name: 'Trang cá nhân', url: 'Tài khoản Facebook chính', type: 'personal', schedules: personalSchedules },
    ...pages.map((page) => ({ ...page, type: 'page' })),
  ], [pages, personalSchedules]);
  const selected = targets.filter((target) => target.schedules.length > 0);
  const flatSlots = selected.flatMap((target) => target.schedules.map((slot) => ({ target, slot })));
  const conflict = flatSlots.some((entry, index) => flatSlots.slice(index + 1).some((other) => overlaps(entry.slot, other.slot)));

  const setTargetSchedules = (target, schedules) => {
    if (target.type === 'personal') setPersonalSchedules(schedules);
    else setPages((items) => items.map((item) => item.id === target.id ? { ...item, schedules } : item));
  };
  const toggleTarget = (target, checked) => setTargetSchedules(target, checked ? [newSlot()] : []);
  const updateSlot = (target, slotId, patch) => setTargetSchedules(target, target.schedules.map((slot) => slot.id === slotId ? { ...slot, ...patch } : slot));
  const removeSlot = (target, slotId) => setTargetSchedules(target, target.schedules.filter((slot) => slot.id !== slotId));
  const addSlot = (target) => {
    const startTime = target.schedules.at(-1)?.endTime || '08:30';
    setTargetSchedules(target, [...target.schedules, newSlot(startTime, addMinutes(startTime, 30))]);
  };
  const save = () => {
    const savedPages = pages.map((page) => ({
      ...page,
      scheduleEnabled: page.schedules.length > 0,
      startTime: page.schedules[0]?.startTime || page.startTime || '08:30',
      endTime: page.schedules[0]?.endTime || page.endTime || '09:00',
    }));
    onSaveSchedule(profile.id, { ...scheduleConfig, scheduleEnabled: false, personalSchedules }, savedPages);
    onClose();
  };

  if (!profile) return null;
  const steps = ['Chọn danh tính', 'Đặt nhiều khung giờ', 'Xác nhận'];
  return <Modal isOpen={isOpen} onClose={onClose} maxWidth="900px" title={`Thiết lập lịch cho hồ sơ: ${profile.name}`}>
    <div className="modal-body">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem', marginBottom: '1rem' }}>{steps.map((label, index) => <div className={`schedule-step ${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'done' : ''}`} key={label}><span>{step > index + 1 ? '✓' : index + 1}</span><b>{label}</b></div>)}</div>

      {step === 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>Chọn Trang cá nhân hoặc Fanpage cần chạy theo lịch. Mỗi mục tiêu có thể có nhiều ca mỗi ngày.</p>
        {targets.map((target) => <label key={target.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.8rem', border: `1px solid ${target.schedules.length ? 'rgba(59,130,246,.45)' : 'var(--border-color)'}`, borderRadius: 8, cursor: 'pointer' }}><input type="checkbox" checked={target.schedules.length > 0} onChange={(event) => toggleTarget(target, event.target.checked)} />{target.type === 'personal' ? <UserRound size={17} color="#34d399" /> : <FileText size={16} color="#60a5fa" />}<div><strong>{target.name}</strong><div style={{ color: 'var(--text-muted)', fontSize: '.7rem' }}>{target.url}</div></div><span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '.76rem' }}>{target.schedules.length} ca</span></label>)}
      </div>}

      {step === 2 && <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>Các ca trong cùng hồ sơ không được chồng lấn, kể cả ca của Trang cá nhân và ca qua nửa đêm.</p>
        {selected.map((target) => <section key={target.id} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: '.8rem' }}><header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.6rem' }}><strong>{target.name}</strong><button className="btn btn-secondary btn-sm" type="button" onClick={() => addSlot(target)}><Plus size={14} /> Thêm khung giờ</button></header>{target.schedules.map((slot, index) => <div className="page-time-row" key={slot.id}><div><strong>Ca {index + 1}</strong><small>Chạy hằng ngày</small></div><label className="time-block in"><span>IN · Bắt đầu</span><TimePicker24 tone="in" value={slot.startTime} onChange={(value) => updateSlot(target, slot.id, { startTime: value })} /></label><span className="time-arrow">→</span><label className="time-block out"><span>OUT · Kết thúc</span><TimePicker24 tone="out" value={slot.endTime} onChange={(value) => updateSlot(target, slot.id, { endTime: value })} /></label><button className="btn btn-secondary btn-sm" type="button" title="Xóa ca" onClick={() => removeSlot(target, slot.id)}><Trash2 size={14} /></button></div>)}</section>)}
        {conflict && <div style={{ padding: '.8rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>Khung giờ bị trùng trong hồ sơ. Hãy điều chỉnh trước khi tiếp tục.</div>}
        {!selected.length && <div style={{ padding: '2rem', textAlign: 'center', color: '#b45309' }}>Chưa chọn danh tính nào.</div>}
      </div>}

      {step === 3 && <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
        <div style={{ padding: '.85rem', color: '#087a53', border: '1px solid #a7f3d0', borderRadius: 8 }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} />Sẽ lưu {flatSlots.length} ca chạy cho {selected.length} danh tính trong hồ sơ “{profile.name}”.</div>
        {flatSlots.sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime)).map(({ target, slot }) => <div className="schedule-confirm-row" key={`${target.id}-${slot.id}`}><div><strong>{target.name}</strong><small>Hằng ngày · Asia/Bangkok</small></div><span className="confirm-in"><Clock size={14} /> IN {slot.startTime}</span><span className="confirm-out">OUT {slot.endTime}</span></div>)}
      </div>}
    </div>
    <div className="modal-footer"><button className="btn btn-secondary" onClick={step === 1 ? onClose : () => setStep((value) => value - 1)}>{step === 1 ? 'Đóng' : <><ChevronLeft size={14} /> Quay lại</>}</button>{step < 3 ? <button className="btn btn-primary" onClick={() => setStep((value) => value + 1)} disabled={(step === 1 && !selected.length) || (step === 2 && conflict)}>Tiếp tục <ChevronRight size={14} /></button> : <button className="btn btn-primary" onClick={save}><CheckCircle2 size={14} /> Xác nhận & lưu lịch</button>}</div>
  </Modal>;
}
