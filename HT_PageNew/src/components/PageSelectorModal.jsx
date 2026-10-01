import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { Plus, Trash2 } from 'lucide-react';

const normalizePage = (item, index) => typeof item === 'string'
  ? { id: `legacy-${index}`, name: item, url: '', enabled: true, scheduleEnabled: false, startTime: '08:30', endTime: '09:00' }
  : {
      id: item.id || `page-${index}`,
      name: item.name || '',
      url: item.url || '',
      enabled: true,
      scheduleEnabled: item.scheduleEnabled === true,
      startTime: item.startTime || '08:30',
      endTime: item.endTime || '09:00',
    };

export default function PageSelectorModal({ isOpen, onClose, profile, onSelectPage }) {
  const [pages, setPages] = useState([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    initializedRef.current = false;
    const source = profile.managedPages?.length ? profile.managedPages : (profile.pageName ? [profile.pageName] : []);
    setPages(source.map(normalizePage));
    setName('');
    setUrl('');
    setError('');
    setTimeout(() => { initializedRef.current = true; }, 0);
  }, [profile, isOpen]);

  useEffect(() => {
    if (!isOpen || !profile || !initializedRef.current) return undefined;
    const timer = setTimeout(() => {
      const enabled = pages.filter((item) => item.name.trim());
      onSelectPage(profile.id, {
        managedPages: pages,
        pageRotationMode: profile.pageRotationMode || 'sequential',
        pageName: enabled[0]?.name || '',
        pageUrl: enabled[0]?.url || '',
        pageRotationIndex: 0,
      }, { silent: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [pages, isOpen, profile]);

  if (!profile) return null;

  const addPage = (event) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanUrl = url.trim();
    if (!cleanName) return setError('Vui lòng nhập tên Page.');
    if (!/^https:\/\/(www\.)?facebook\.com\//i.test(cleanUrl)) {
      return setError('URL phải bắt đầu bằng https://facebook.com/ hoặc https://www.facebook.com/.');
    }
    setPages((current) => [...current, {
      id: `page-${Date.now()}`,
      name: cleanName,
      url: cleanUrl,
      enabled: true,
      scheduleEnabled: false,
      startTime: '08:30',
      endTime: '09:00',
    }]);
    setName('');
    setUrl('');
    setError('');
  };

  const save = () => {
    const enabled = pages.filter((item) => item.name.trim());
    if (!enabled.length) return setError('Cần có ít nhất một Fanpage.');
    onSelectPage(profile.id, {
      managedPages: pages,
      pageRotationMode: profile.pageRotationMode || 'sequential',
      pageName: enabled[0].name,
      pageUrl: enabled[0].url,
      pageRotationIndex: 0,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="800px" title={`Danh sách Fanpage của "${profile.name}"`}>
      <div className="modal-body">
        <div style={{ padding: '0.8rem', border: '1px solid rgba(59,130,246,.3)', borderRadius: 8, color: '#93c5fd', fontSize: '.8rem' }}>
          Tại đây chỉ lưu tên và đường dẫn Fanpage. Thời gian IN/OUT và bật lịch được cấu hình trong tab “Lịch chạy”. Các thay đổi được tự động lưu.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', maxHeight: 230, overflowY: 'auto' }}>
          {pages.map((item) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, .8fr) minmax(280px, 1.5fr) 34px', gap: '.7rem', alignItems: 'center', padding: '.75rem', border: '1px solid var(--border-color)', borderRadius: 10, background: 'rgba(255,255,255,.02)' }}>
              <input className="form-control" value={item.name} onChange={(e) => setPages((current) => current.map((p) => p.id === item.id ? { ...p, name: e.target.value } : p))} placeholder="Tên Fanpage" />
              <input className="form-control" value={item.url} onChange={(e) => setPages((current) => current.map((p) => p.id === item.id ? { ...p, url: e.target.value } : p))} placeholder="https://www.facebook.com/ten-page" />
              <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => setPages((current) => current.filter((p) => p.id !== item.id))}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>

        <form onSubmit={addPage} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: '.5rem', marginTop: '.65rem' }}>
          <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên Fanpage" />
          <input className="form-control" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.facebook.com/ten-page" />
          <button className="btn btn-secondary btn-sm" type="submit"><Plus size={14} /> Thêm</button>
        </form>
        {error && <div style={{ color: '#f87171', fontSize: '.78rem', marginTop: '.4rem' }}>{error}</div>}
      </div>

      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">Hủy</button>
        <button type="button" onClick={save} className="btn btn-primary">Lưu danh sách Page</button>
      </div>
    </Modal>
  );
}
