import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Server, FileText, Power, Wifi, ShieldCheck, Folder, Loader2, CheckCircle2, AlertTriangle, UserCheck, Play, Square, Clock, Eye, AlertCircle, Check } from 'lucide-react';
import { ElectronService } from '../services/electronService';
import { ProfileStorage } from '../services/profileStorage';

const FacebookIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

export default function ProfilesView({
  profiles,
  onOpenAddModal,
  onOpenEditModal,
  onOpenPageModal,
  onConfirmDelete,
  onToggleStatus,
  onAddQuickSample,
  addToast,
  onRefreshData
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);

  // Proxy test state
  const [testingProxyIds, setTestingProxyIds] = useState({});
  const [proxyResults, setProxyResults] = useState({});

  // Browser Launch state
  const [launchingIds, setLaunchingIds] = useState({});

  // Running Session state & duration per profile (default 30 mins)
  const [runningProfileId, setRunningProfileId] = useState(null);
  const [runningSessionInfo, setRunningSessionInfo] = useState(null);
  const [runtimeSessions, setRuntimeSessions] = useState({});
  const [sessionDurations, setSessionDurations] = useState({});
  const [runTargets, setRunTargets] = useState({});
  const [isStartingSession, setIsStartingSession] = useState(false);

  useEffect(() => ElectronService.onSessionEnded(({ profileId }) => {
    setRuntimeSessions((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
    if (profileId === runningProfileId) {
      setRunningProfileId(null);
      setRunningSessionInfo(null);
    }
  }), [runningProfileId]);

  // The Electron main process is the source of truth for live sessions. Poll
  // every profile independently so scheduled runs and concurrent profiles are
  // reflected even when they were not started from this screen.
  useEffect(() => {
    let mounted = true;
    const profileIds = profiles.map((profile) => profile.id);
    const refreshRuntimeSessions = async () => {
      const results = await Promise.all(profileIds.map(async (profileId) => {
        try {
          return [profileId, await ElectronService.getSessionStatus(profileId)];
        } catch (_) {
          return [profileId, null];
        }
      }));
      if (!mounted) return;
      const next = {};
      results.forEach(([profileId, result]) => {
        if (result?.success && result.session?.isRunning) next[profileId] = result.session;
      });
      setRuntimeSessions(next);
    };
    refreshRuntimeSessions();
    const timer = window.setInterval(refreshRuntimeSessions, 1000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [profiles.map((profile) => profile.id).join('|')]);

  const getRuntimeStatusText = (session) => {
    if (!session) return '';
    const startedAt = session.startTimeObj ? new Date(session.startTimeObj).getTime() : Number(session.startTime) || Date.now();
    const totalMs = Number(session.durationMs) || Number(session.durationMinutes || 0) * 60000;
    const remainingMs = Math.max(0, totalMs - (Date.now() - startedAt));
    const remainingMinutes = Math.floor(remainingMs / 60000);
    const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
    return `${session.currentSection || 'Feed'} · còn ${remainingMinutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.proxy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pageName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? p.status
        : !p.status;

    return matchesSearch && matchesStatus;
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredProfiles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProfiles.map((p) => p.id));
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Test Proxy per Row
  const handleTestProxyRow = async (profile) => {
    if (!profile.proxy || profile.proxy.toLowerCase().includes('không')) {
      if (addToast) addToast(`Hồ sơ "${profile.name}" đang sử dụng IP máy (Không dùng Proxy).`, 'info');
      setProxyResults((prev) => ({
        ...prev,
        [profile.id]: { success: false, message: 'Dùng IP Máy (Không Proxy)' }
      }));
      return;
    }

    setTestingProxyIds((prev) => ({ ...prev, [profile.id]: true }));
    try {
      const result = await ElectronService.checkProxy(profile.proxy);
      setProxyResults((prev) => ({
        ...prev,
        [profile.id]: result
      }));
      if (addToast) {
        if (result.success) {
          addToast(`Proxy của "${profile.name}" HOẠT ĐỘNG! ${result.message}`, 'success');
        } else {
          addToast(`Proxy của "${profile.name}" MẤT KẾT NỐI! ${result.message}`, 'error');
          ProfileStorage.updateProfileExecutionStatus(profile.id, 'error', result.message);
          if (onRefreshData) onRefreshData();
        }
      }
    } catch (e) {
      setProxyResults((prev) => ({
        ...prev,
        [profile.id]: { success: false, message: 'Lỗi: ' + e.message }
      }));
    } finally {
      setTestingProxyIds((prev) => ({ ...prev, [profile.id]: false }));
    }
  };

  // Open Facebook for manual login
  const handleOpenFacebook = async (profile) => {
    setLaunchingIds((prev) => ({ ...prev, [profile.id]: true }));
    if (addToast) addToast(`Đang mở Facebook cho "${profile.name}"...`, 'info');

    try {
      const res = await ElectronService.launchBrowser(profile);
      if (res.success) {
        if (addToast) addToast(res.message || `Đã mở Facebook thành công cho "${profile.name}".`, 'success');
      } else {
        if (addToast) addToast(res.message || `Không thể mở trình duyệt: Lỗi hệ thống`, 'error');
      }
    } catch (e) {
      if (addToast) addToast(`Lỗi mở trình duyệt: ${e.message}`, 'error');
    } finally {
      setLaunchingIds((prev) => ({ ...prev, [profile.id]: false }));
    }
  };

  // Start Single Profile Run Session ("Chạy ngay")
  const handleCheckFacebookLogin = async (profile) => {
    setLaunchingIds((prev) => ({ ...prev, [profile.id]: true }));
    if (addToast) addToast(`Đang kiểm tra phiên đăng nhập của "${profile.name}"...`, 'info');
    try {
      const result = await ElectronService.checkFacebookLogin(profile);
      if (result.success) {
        ProfileStorage.updateProfile({
          ...profile,
          isLoggedIn: true,
          executionStatus: 'idle',
          checkpointStatus: 'normal',
        });
        if (onRefreshData) onRefreshData();
        if (addToast) addToast(result.message, 'success');
      } else if (addToast) {
        addToast(result.message, 'warning');
      }
    } catch (error) {
      if (addToast) addToast(`Không thể kiểm tra đăng nhập: ${error.message}`, 'error');
    } finally {
      setLaunchingIds((prev) => ({ ...prev, [profile.id]: false }));
    }
  };

  const handleStartSession = async (profile) => {
    const duration = sessionDurations[profile.id] || 30;
    const targetValue = runTargets[profile.id] || 'personal';
    const targetPage = (profile.managedPages || []).find((page) => typeof page === 'object' && page.id === targetValue);
    const runProfile = targetValue === 'personal'
      ? { ...profile, runAsPersonal: true }
      : {
          ...profile,
          runAsPersonal: false,
          pageName: targetPage?.name || profile.pageName,
          pageUrl: targetPage?.url || profile.pageUrl,
          managedPages: targetPage ? [{ ...targetPage, enabled: true }] : profile.managedPages,
          pageRotationMode: 'fixed',
          pageRotationIndex: 0,
        };
    setIsStartingSession(true);
    const startTimeStr = new Date().toLocaleTimeString('vi-VN');

    // Set execution status to 'running'
    ProfileStorage.updateProfileExecutionStatus(profile.id, 'running');
    if (onRefreshData) onRefreshData();

    if (addToast) addToast(`Đang kiểm tra điều kiện & khởi tạo phiên chạy cho "${profile.name}" (${duration} phút)...`, 'info');

    try {
      const result = await ElectronService.startSession({
        profile: runProfile,
        durationMinutes: parseInt(duration),
        actionType: 'Xem Feed & Reels (Chỉ xem)'
      });

      if (result.success) {
        ProfileStorage.updateProfile({
          ...profile,
          pageName: result.sessionInfo.runAsPersonal ? profile.pageName : result.sessionInfo.pageName,
          pageUrl: result.sessionInfo.runAsPersonal ? profile.pageUrl : result.sessionInfo.pageUrl,
          pageRotationIndex: result.sessionInfo.pageRotationIndex,
          managedPages: (profile.managedPages || []).map((page) => (
            typeof page === 'object' && page.name === result.sessionInfo.pageName && result.sessionInfo.actingPageId
              ? { ...page, pageId: result.sessionInfo.actingPageId }
              : page
          )),
        });
        setRunningProfileId(profile.id);
        setRunningSessionInfo(result.sessionInfo);
        setRuntimeSessions((current) => ({ ...current, [profile.id]: result.sessionInfo }));
        if (addToast) addToast(result.message, 'success');

        // Log session start (Sanitized, NO cookies/passwords/raw feed content)
        ProfileStorage.addSessionAuditLog({
          profileName: profile.name,
          pageName: result.sessionInfo.pageName,
          startTime: startTimeStr,
          endTime: 'Đang chạy',
          actualDurationStr: '0s',
          stopReason: 'Bắt đầu phiên lướt Feed & Reels tự động',
          type: 'info'
        });

      } else {
        // Handle Error Cases: Proxy down, Login expired, Verification required
        let newStatus = 'error';
        if (result.errorType === 'verification_required' || result.errorType === 'login_expired') {
          newStatus = 'verification_required';
        }

        ProfileStorage.updateProfileExecutionStatus(profile.id, newStatus);
        if (onRefreshData) onRefreshData();

        // Trigger Notification Toast
        if (addToast) addToast(`ĐÃ DỪNG HỒ SƠ: ${result.reason}`, 'error');

        // Audit Sanitized Log (NO cookies, passwords, or tokens)
        ProfileStorage.addSessionAuditLog({
          profileName: profile.name,
          pageName: runProfile.pageName,
          startTime: startTimeStr,
          endTime: new Date().toLocaleTimeString('vi-VN'),
          actualDurationStr: '0s',
          stopReason: result.reason,
          type: result.errorType === 'verification_required' ? 'warning' : 'danger'
        });
      }
    } catch (e) {
      ProfileStorage.updateProfileExecutionStatus(profile.id, 'error');
      if (onRefreshData) onRefreshData();
      if (addToast) addToast(`Lỗi khởi chạy phiên: ${e.message}`, 'error');
    } finally {
      setIsStartingSession(false);
    }
  };

  // Stop Running Session ("Dừng ngay")
  const handleStopSession = async (profileId) => {
    const p = profiles.find(item => item.id === profileId);
    const endTimeStr = new Date().toLocaleTimeString('vi-VN');

    try {
      const result = await ElectronService.stopSession(profileId);
      setRunningProfileId(null);
      setRunningSessionInfo(null);
      setRuntimeSessions((current) => {
        const next = { ...current };
        delete next[profileId];
        return next;
      });

      // Update status to 'completed' or 'idle'
      ProfileStorage.updateProfileExecutionStatus(profileId, 'completed');
      if (onRefreshData) onRefreshData();

      if (addToast) addToast(result.message || 'Đã dừng phiên chạy thành công.', 'info');

      // Audit Sanitized Log
      if (p) {
        ProfileStorage.addSessionAuditLog({
          profileName: p.name,
          pageName: p.pageName,
          startTime: result.audit?.startTime || '-',
          endTime: endTimeStr,
          actualDurationStr: result.audit?.actualDurationStr || 'Vài giây',
          stopReason: 'Người dùng bấm Dừng ngay',
          type: 'info'
        });
      }
    } catch (e) {
      if (addToast) addToast(`Lỗi dừng phiên: ${e.message}`, 'error');
    }
  };

  // Helper to render 5 explicit execution status badges
  const renderExecutionStatusBadge = (execStatus) => {
    switch (execStatus) {
      case 'running':
        return (
          <span className="badge badge-success execution-badge execution-running">
            <span className="dot dot-active"></span> Đang chạy
          </span>
        );
      case 'verification_required':
        return (
          <span className="badge badge-warning execution-badge execution-verification" title="Facebook yêu cầu xác minh thủ công (2FA / CAPTCHA)">
            <AlertTriangle size={12} /> Cần xác minh
          </span>
        );
      case 'error':
        return (
          <span className="badge badge-danger execution-badge execution-error" title="Proxy mất kết nối hoặc phiên hết hạn">
            <AlertCircle size={12} /> Lỗi
          </span>
        );
      case 'completed':
        return (
          <span className="badge badge-info execution-badge execution-completed">
            <Check size={12} /> Đã hoàn thành
          </span>
        );
      case 'idle':
      default:
        return (
          <span className="badge badge-info execution-badge execution-idle">
            <Clock size={12} /> Đang chờ
          </span>
        );
    }
  };

  return (
    <div className="profiles-screen" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Live Session Status Banner if Running */}
      {runningProfileId && (
        <div
          className="glass-panel profiles-live-banner"
          style={{
            padding: '1.25rem 1.75rem',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: '0 0 25px rgba(52, 211, 153, 0.15)',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={24} className="animate-pulse" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-success"><span className="dot dot-active"></span> ĐANG CHẠY PHIÊN THỰC TẾ</span>
                <span style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>{runningSessionInfo?.profileName}</span>
                <span className="badge badge-info">Page: {runningSessionInfo?.pageName}</span>
              </div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Chế độ: <strong style={{ color: '#93c5fd' }}>{runningSessionInfo?.statusText || 'Đang lướt Feed & Xem Reels (Chỉ xem)'}</strong> | Thời lượng: <strong>{runningSessionInfo?.durationMinutes || 30} phút</strong>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleStopSession(runningProfileId)}
            className="btn btn-danger"
            style={{ gap: '6px', padding: '0.65rem 1.25rem' }}
          >
            <Square size={16} fill="white" /> Dừng ngay
          </button>
        </div>
      )}

      {/* Audit & Error Handling Rules Banner */}
      <div
        className="glass-panel profiles-safety-banner"
        style={{
          padding: '1rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderRadius: '10px' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700, color: 'white' }}>
              Quản lý và vận hành an toàn
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Theo dõi trạng thái theo thời gian thực. Kiểm tra cấu hình, Proxy và đăng nhập trước khi chạy.
              <span style={{ color: '#34d399', marginLeft: '4px' }}>
                Nhật ký không lưu cookie, mật khẩu hoặc token.
              </span>
            </p>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.2)', flexShrink: 0 }}>
          Không thử đăng nhập liên tục khi có lỗi
        </div>
      </div>

      {/* Top Action & Search Bar */}
      <div
        className="glass-panel profiles-toolbar"
        style={{
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên hồ sơ, proxy, tên Page..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '38px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={16} className="text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-control"
              style={{ width: '130px', background: '#1a2336' }}
            >
              <option value="all">Tất cả ({profiles.length})</option>
              <option value="active">Đang Bật ({profiles.filter(p=>p.status).length})</option>
              <option value="inactive">Đang Tắt ({profiles.filter(p=>!p.status).length})</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={onAddQuickSample} className="btn btn-secondary btn-sm" title="Thêm mẫu hồ sơ tự động">
            <Plus size={14} /> Hồ Sơ Mẫu
          </button>
          
          <button onClick={onOpenAddModal} className="btn btn-primary">
            <Plus size={16} /> Thêm Hồ Sơ Mới
          </button>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="glass-panel profiles-table-panel" style={{ padding: '0.5rem', overflow: 'hidden' }}>
        <div className="table-container">
          <table className="custom-table profiles-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredProfiles.length > 0 &&
                      selectedIds.length === filteredProfiles.length
                    }
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Tên hồ sơ & Tài khoản</th>
                <th>Proxy kết nối</th>
                <th>Cấu hình Fanpage</th>
                <th>Trạng thái thực thi</th>
                <th style={{ width: '110px' }}>Thời lượng</th>
                <th style={{ textAlign: 'center' }}>Kiểm tra Proxy</th>
                <th style={{ textAlign: 'center' }}>Bật/Tắt</th>
                <th style={{ textAlign: 'right', width: '450px' }}>Điều khiển phiên chạy</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    Không tìm thấy hồ sơ tài khoản nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const isTesting = testingProxyIds[p.id];
                  const testResult = proxyResults[p.id];
                  const isLaunching = launchingIds[p.id];
                  const runtimeSession = runtimeSessions[p.id];
                  const isRunningThis = Boolean(runtimeSession?.isRunning);
                  const currentDuration = sessionDurations[p.id] || 30;
                  const configuredPages = (p.managedPages || []).filter((page) => typeof page === 'object' ? page.name : page);

                  return (
                    <tr key={p.id} style={{ background: isRunningThis ? 'rgba(16, 185, 129, 0.08)' : isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(p.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Tên hồ sơ & Account Name */}
                      <td>
                        <div className="profile-account-cell">
                          <span className="profile-account-avatar">{String(p.name || 'H').charAt(0).toUpperCase()}</span>
                          <div>
                            <div style={{ fontWeight: 700, color: 'white', fontSize: '0.88rem' }}>{p.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <UserCheck size={12} className={p.isLoggedIn ? 'text-emerald-400' : 'text-muted'} />
                              <span style={{ fontSize: '0.7rem', color: p.isLoggedIn ? '#34d399' : 'var(--text-muted)' }}>
                                {p.accountName || 'Chưa đăng nhập'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Proxy */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Server size={14} className="text-purple-400" />
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '0.83rem',
                                color: p.proxy ? '#e0e7ff' : 'var(--text-muted)',
                              }}
                            >
                              {p.proxy || 'Dùng IP máy'}
                            </span>
                          </div>

                          {testResult && (
                            <span
                              className={`badge ${testResult.success ? 'badge-success' : 'badge-danger'}`}
                              style={{ fontSize: '0.72rem', alignSelf: 'flex-start', marginTop: '2px' }}
                            >
                              {testResult.success ? `Live (${testResult.latency || 'OK'})` : 'Dead / Lỗi'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Saved Fanpage configuration */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={14} className="text-cyan-400" />
                            <span className="badge badge-info" style={{ fontWeight: 600 }}>
                              {configuredPages.length ? `${configuredPages.length} Fanpage đã lưu` : 'Chưa cấu hình Fanpage'}
                            </span>
                          </div>

                          {configuredPages.length > 0 && (
                            <span style={{ maxWidth: 180, fontSize: '.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {configuredPages.slice(0, 2).map((page) => typeof page === 'object' ? page.name : page).join(', ')}{configuredPages.length > 2 ? '…' : ''}
                            </span>
                          )}

                          <button
                            onClick={() => onOpenPageModal(p)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem', color: '#93c5fd' }}
                          >
                            Cấu hình Page
                          </button>
                        </div>
                      </td>

                      {/* Explicit 5 Execution Status Badges */}
                      <td>
                        {renderExecutionStatusBadge(isRunningThis ? 'running' : p.executionStatus || 'idle')}
                        {isRunningThis && (
                          <div title={runtimeSession.statusText || ''} style={{ marginTop: 5, color: '#059669', fontSize: '.68rem', whiteSpace: 'nowrap' }}>
                            {getRuntimeStatusText(runtimeSession)}
                          </div>
                        )}
                      </td>

                      {/* Session Duration Selector */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} className="text-muted" />
                          <select
                            value={currentDuration}
                            onChange={(e) =>
                              setSessionDurations((prev) => ({
                                ...prev,
                                [p.id]: parseInt(e.target.value),
                              }))
                            }
                            className="form-control"
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.78rem', background: '#1a2336', width: '80px' }}
                          >
                            <option value="1">1 phút (Test)</option>
                            <option value="5">5 phút</option>
                            <option value="15">15 phút</option>
                            <option value="30">30 phút (Mặc định)</option>
                            <option value="60">60 phút</option>
                          </select>
                        </div>
                      </td>

                      {/* Test Proxy Button */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleTestProxyRow(p)}
                          disabled={isTesting}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                          title="Kiểm tra kết nối Proxy"
                        >
                          {isTesting ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Wifi size={13} className="text-purple-400" />
                          )}
                          {isTesting ? 'Test' : 'Test Proxy'}
                        </button>
                      </td>

                      {/* Switch */}
                      <td style={{ textAlign: 'center' }}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={p.status}
                            onChange={() => onToggleStatus(p.id)}
                          />
                          <span className="slider"></span>
                        </label>
                      </td>

                      {/* Session Control Buttons: Mở FB, Chạy ngay, Dừng ngay */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="profile-row-actions" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.35rem' }}>
                          <div className="profile-identity-actions">
                          <select
                            className="form-control"
                            value={runTargets[p.id] || 'personal'}
                            onChange={(e) => setRunTargets((current) => ({ ...current, [p.id]: e.target.value }))}
                            disabled={isRunningThis}
                            title="Chọn danh tính Facebook sẽ dùng khi chạy ngay"
                            style={{ width: 165, padding: '0.32rem', fontSize: '0.75rem' }}
                          >
                            <option value="personal">Trang cá nhân</option>
                            {configuredPages.map((page, index) => {
                              const item = typeof page === 'object' ? page : { id: `legacy-${index}`, name: page };
                              return <option key={item.id} value={item.id}>Page: {item.name}</option>;
                            })}
                          </select>
                          <button
                            onClick={() => handleOpenFacebook(p)}
                            disabled={isLaunching || isRunningThis}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', gap: '4px' }}
                            title="Mở trình duyệt để tự đăng nhập Facebook"
                          >
                            <FacebookIcon size={13} color="#60a5fa" /> FB
                          </button>
                          </div>

                          <div className="profile-session-actions">
                          {isRunningThis ? (
                            <button
                              onClick={() => handleStopSession(p.id)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '4px' }}
                            >
                              <Square size={13} fill="white" /> Dừng ngay
                            </button>
                          ) : (
                            <button
                              onClick={() => p.executionStatus === 'verification_required' ? handleCheckFacebookLogin(p) : handleStartSession(p)}
                              disabled={isStartingSession || isLaunching || !p.status}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '4px', background: p.status ? 'linear-gradient(135deg, #10b981, #059669)' : 'gray' }}
                              title="Chạy phiên xem Feed & Reels tự động"
                            >
                              {p.executionStatus === 'verification_required'
                                ? <><UserCheck size={13} /> Kiểm tra đăng nhập</>
                                : <><Play size={13} fill="white" /> Chạy ngay</>}
                            </button>
                          )}

                          <button
                            onClick={() => onOpenEditModal(p)}
                            className="btn btn-secondary btn-icon btn-sm"
                            title="Sửa hồ sơ"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => onConfirmDelete(p.id)}
                            className="btn btn-danger btn-icon btn-sm"
                            title="Xóa hồ sơ"
                          >
                            <Trash2 size={13} />
                          </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
