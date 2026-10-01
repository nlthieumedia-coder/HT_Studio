import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { User, Server, Activity, ShieldCheck, Wifi, Loader2, Monitor } from 'lucide-react';
import { ElectronService } from '../services/electronService';

export default function ProfileModal({ isOpen, onClose, onSave, profile }) {
  const [formData, setFormData] = useState({
    name: '',
    proxy: '',
    pageName: '',
    browserWindowWidth: 960,
    browserWindowHeight: 720,
    status: true,
    targetAction: 'Xem Feed & Reels (25 phút/phiên)',
  });

  const [errors, setErrors] = useState({});
  const [proxyChecking, setProxyChecking] = useState(false);
  const [proxyResult, setProxyResult] = useState(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        id: profile.id,
        name: profile.name || '',
        proxy: profile.proxy || '',
        pageName: profile.pageName || '',
        browserWindowWidth: profile.browserWindowWidth || 960,
        browserWindowHeight: profile.browserWindowHeight || 720,
        status: profile.status !== undefined ? profile.status : true,
        targetAction: profile.targetAction || 'Xem Feed & Reels (25 phút/phiên)',
      });
    } else {
      setFormData({
        name: '',
        proxy: '',
        pageName: '',
        browserWindowWidth: 960,
        browserWindowHeight: 720,
        status: true,
        targetAction: 'Xem Feed & Reels (25 phút/phiên)',
      });
    }
    setErrors({});
    setProxyResult(null);
  }, [profile, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (name === 'proxy') {
      setProxyResult(null);
    }
  };

  const handleTestProxyInModal = async () => {
    if (!formData.proxy.trim()) {
      setProxyResult({
        success: false,
        message: 'Chưa nhập thông tin Proxy để kiểm tra.',
      });
      return;
    }
    setProxyChecking(true);
    setProxyResult(null);
    try {
      const res = await ElectronService.checkProxy(formData.proxy);
      setProxyResult(res);
    } catch (e) {
      setProxyResult({
        success: false,
        message: 'Lỗi kiểm tra proxy: ' + e.message,
      });
    } finally {
      setProxyChecking(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Vui lòng nhập tên hồ sơ';
    }

    const width = Number(formData.browserWindowWidth);
    const height = Number(formData.browserWindowHeight);
    if (!Number.isInteger(width) || width < 640 || width > 1920) {
      newErrors.browserWindowWidth = 'Chiều rộng phải từ 640 đến 1920 px';
    }
    if (!Number.isInteger(height) || height < 480 || height > 1080) {
      newErrors.browserWindowHeight = 'Chiều cao phải từ 480 đến 1080 px';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={profile ? 'Chỉnh sửa hồ sơ tài khoản' : 'Thêm hồ sơ tài khoản mới'}
    >
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {/* Security Note Banner */}
          <div
            style={{
              padding: '0.65rem 0.85rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              fontSize: '0.78rem',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ShieldCheck size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Bảo mật cao:</strong> Ứng dụng không lưu mật khẩu Facebook. Dữ liệu trình duyệt và Cookie được lưu cách ly trong từng thư mục riêng.
            </span>
          </div>

          {/* Tên hồ sơ */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={15} className="text-blue-400" /> Tên hồ sơ tài khoản <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="VD: Hồ sơ Marketing 01, Tài khoản Seeding 02..."
              className="form-control"
              autoFocus
            />
            {errors.name && <span style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>{errors.name}</span>}
          </div>

          {/* Proxy */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Server size={15} className="text-purple-400" /> Proxy kết nối (Tùy chọn)
              </label>

              <button
                type="button"
                onClick={handleTestProxyInModal}
                disabled={proxyChecking || !formData.proxy}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
              >
                {proxyChecking ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Đang kiểm tra...
                  </>
                ) : (
                  <>
                    <Wifi size={12} className="text-blue-400" /> Kiểm tra Proxy
                  </>
                )}
              </button>
            </div>

            <input
              type="text"
              name="proxy"
              value={formData.proxy}
              onChange={handleChange}
              placeholder="VD: 192.0.2.10:8080 hoặc user:pass@ip:port"
              className="form-control"
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Định dạng: IP:PORT hoặc IP:PORT:USER:PASS. Mật khẩu Proxy được mã hóa bằng Windows DPAPI.
            </span>

            {/* Proxy Test Result Badge */}
            {proxyResult && (
              <div
                style={{
                  marginTop: '0.4rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  background: proxyResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${proxyResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: proxyResult.success ? '#34d399' : '#f87171',
                }}
              >
                {proxyResult.message}
              </div>
            )}
          </div>

          <div style={{ padding: '0.65rem 0.8rem', borderRadius: '8px', background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.22)', color: '#93c5fd', fontSize: '.78rem' }}>
            Tên Page, link Fanpage và lịch IN/OUT sẽ được thêm sau tại nút <strong>Đổi Page chọn</strong> trong bảng hồ sơ.
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Monitor size={15} className="text-blue-400" /> Kích thước cửa sổ Chromium
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <input
                  type="number"
                  name="browserWindowWidth"
                  value={formData.browserWindowWidth}
                  onChange={handleChange}
                  min="640"
                  max="1920"
                  step="10"
                  className="form-control"
                  aria-label="Chiều rộng cửa sổ Chromium"
                />
                {errors.browserWindowWidth && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{errors.browserWindowWidth}</span>}
              </div>
              <div>
                <input
                  type="number"
                  name="browserWindowHeight"
                  value={formData.browserWindowHeight}
                  onChange={handleChange}
                  min="480"
                  max="1080"
                  step="10"
                  className="form-control"
                  aria-label="Chiều cao cửa sổ Chromium"
                />
                {errors.browserWindowHeight && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{errors.browserWindowHeight}</span>}
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Rộng × cao (px). Mặc định 960 × 720; phù hợp đặt 2 cửa sổ cạnh nhau trên màn hình Full HD. Các cửa sổ được tự động xếp vị trí và không mở toàn màn hình.
            </span>
          </div>

          {/* Loại hành vi dự định */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={15} className="text-emerald-400" /> Chế độ tương tác dự định
            </label>
            <select
              name="targetAction"
              value={formData.targetAction}
              onChange={handleChange}
              className="form-control"
              style={{ background: '#1a2336' }}
            >
              <option value="Xem Feed & Reels (25 phút/phiên)">Xem Feed & Reels (25 phút/phiên)</option>
              <option value="Chỉ xem Feed Facebook (15 phút/phiên)">Chỉ xem Feed Facebook (15 phút/phiên)</option>
              <option value="Chỉ xem Reels Facebook (15 phút/phiên)">Chỉ xem Reels Facebook (15 phút/phiên)</option>
            </select>
          </div>

          {/* Trạng thái Bật/Tắt */}
          <div
            className="form-group"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white' }}>Trạng thái hoạt động</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {formData.status ? 'Bật (Cho phép đưa vào lịch chạy tự động)' : 'Tắt (Tạm dừng hoạt động)'}
              </div>
            </div>

            <label className="switch">
              <input
                type="checkbox"
                name="status"
                checked={formData.status}
                onChange={handleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Hủy bỏ
          </button>
          <button type="submit" className="btn btn-primary">
            {profile ? 'Cập nhật hồ sơ' : 'Lưu hồ sơ mới'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
