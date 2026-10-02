import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import TopHeader from './components/TopHeader';
import Toast from './components/Toast';
import ProfileModal from './components/ProfileModal';
import ConfirmModal from './components/ConfirmModal';
import PageSelectorModal from './components/PageSelectorModal';
import ScheduleModal from './components/ScheduleModal';
import TelegramSettingsModal from './components/TelegramSettingsModal';

import DashboardView from './views/DashboardView';
import ProfilesView from './views/ProfilesView';
import ScheduleView from './views/ScheduleView';
import ScheduledRunsView from './views/ScheduledRunsView';
import LogsView from './views/LogsView';
import TelegramView from './views/TelegramView';

import { ProfileStorage } from './services/profileStorage';
import { ElectronService } from './services/electronService';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profiles, setProfiles] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const schedulerHydratedRef = useRef(false);
  const skipNextSchedulerPushRef = useRef(false);

  // Toast State
  const [toasts, setToasts] = useState([]);

  // Modal States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [isPageModalOpen, setIsPageModalOpen] = useState(false);
  const [pageModalProfile, setPageModalProfile] = useState(null);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalProfile, setScheduleModalProfile] = useState(null);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);

  // Load Initial Data
  const loadData = () => {
    const profs = ProfileStorage.getProfiles();
    const schs = ProfileStorage.getSchedules();
    const lgs = ProfileStorage.getLogs();
    setProfiles(profs);
    setSchedules(schs);
    setLogs(lgs);
  };

  const mergeSchedulerConfiguration = (localProfiles, schedulerProfiles) => {
    if (!Array.isArray(schedulerProfiles) || !schedulerProfiles.length) return localProfiles;
    const localById = new Map(localProfiles.map((profile) => [String(profile.id), profile]));
    const merged = schedulerProfiles.map((remoteProfile) => {
      const localProfile = localById.get(String(remoteProfile.id));
      if (!localProfile) return remoteProfile;
      localById.delete(String(remoteProfile.id));
      return {
        ...localProfile,
        scheduleConfig: {
          ...(localProfile.scheduleConfig || {}),
          personalSchedules: Array.isArray(remoteProfile.scheduleConfig?.personalSchedules)
            ? remoteProfile.scheduleConfig.personalSchedules
            : (localProfile.scheduleConfig?.personalSchedules || []),
        },
        managedPages: Array.isArray(remoteProfile.managedPages)
          ? remoteProfile.managedPages
          : localProfile.managedPages,
      };
    });
    return [...merged, ...localById.values()];
  };

  const applySchedulerProfiles = (schedulerProfiles, { notify = false } = {}) => {
    if (!Array.isArray(schedulerProfiles)) return false;
    const localProfiles = ProfileStorage.getProfiles();
    const merged = mergeSchedulerConfiguration(localProfiles, schedulerProfiles);
    const changed = JSON.stringify(merged) !== JSON.stringify(localProfiles);
    if (!changed) return false;
    skipNextSchedulerPushRef.current = true;
    ProfileStorage.saveProfiles(merged);
    setProfiles(merged);
    if (notify) addToast('Cấu hình Fanpage/lịch vừa được cập nhật từ Telegram.', 'success');
    return true;
  };

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      loadData();
      const localProfiles = ProfileStorage.getProfiles();
      try {
        const result = await ElectronService.getSchedulerProfiles();
        if (cancelled) return;
        if (result?.success && Array.isArray(result.profiles) && result.profiles.length) {
          applySchedulerProfiles(result.profiles);
        } else if (localProfiles.length) {
          await ElectronService.syncSchedulerProfiles(localProfiles);
        }
      } catch (error) {
        console.error('Không thể tải cấu hình lịch từ tiến trình nền:', error);
      } finally {
        schedulerHydratedRef.current = true;
      }
    };
    initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!schedulerHydratedRef.current || !profiles.length) return;
    if (skipNextSchedulerPushRef.current) {
      skipNextSchedulerPushRef.current = false;
      return;
    }
    ElectronService.syncSchedulerProfiles(profiles).catch(console.error);
  }, [profiles]);

  useEffect(() => ElectronService.onScheduledSessionResult(({ profileId, pageId, result }) => {
    const current = ProfileStorage.getProfiles().find((p) => p.id === profileId);
    if (!current) return;
    if (result.success && result.sessionInfo) {
      ProfileStorage.updateProfile({
        ...current,
        pageName: result.sessionInfo.pageName,
        pageUrl: result.sessionInfo.pageUrl,
        pageRotationIndex: result.sessionInfo.pageRotationIndex,
        managedPages: (current.managedPages || []).map((page) => (
          typeof page === 'object' && page.name === result.sessionInfo.pageName && result.sessionInfo.actingPageId
            ? { ...page, pageId: result.sessionInfo.actingPageId }
            : page
        )),
      });
    }
    if (result.errorType !== 'schedule_conflict') {
      ProfileStorage.updateProfileExecutionStatus(profileId, result.success ? 'running' : (result.errorType === 'verification_required' ? 'verification_required' : 'error'));
    }
    const targetPage = pageId
      ? (current.managedPages || []).find((page) => typeof page === 'object' && page.id === pageId)
      : null;
    const logPageName = result.sessionInfo?.pageName || targetPage?.name || current.pageName;
    ProfileStorage.addLog({
      profileName: current.name,
      pageName: logPageName,
      action: result.success ? 'Bắt đầu phiên chạy theo lịch' : 'Không thể bắt đầu phiên chạy theo lịch',
      type: result.success ? 'info' : (result.errorType === 'schedule_conflict' ? 'warning' : 'error'),
      details: result.message || result.reason || 'Không có chi tiết'
    });
    loadData();
  }), []);

  useEffect(() => ElectronService.onSessionEnded(({ profileId, session }) => {
    const current = ProfileStorage.getProfiles().find((p) => p.id === profileId);
    if (!current) return;
    const finalStatus = session.errorType === 'verification_required'
      ? 'verification_required'
      : session.errorType ? 'error' : 'completed';
    ProfileStorage.updateProfileExecutionStatus(profileId, finalStatus);
    if (session.isStopped) {
      loadData();
      return;
    }
    ProfileStorage.addSessionAuditLog({
      profileName: current.name,
      pageName: current.pageName,
      startTime: session.audit?.startTime,
      endTime: session.audit?.endTime,
      actualDurationStr: session.audit?.actualDurationStr,
      stopReason: session.audit?.stopReason,
      type: session.errorType ? 'error' : 'success'
    });
    loadData();
  }), []);

  useEffect(() => ElectronService.onSessionAlert(({ profileId, errorType, reason }) => {
    ProfileStorage.updateProfileExecutionStatus(profileId, errorType === 'verification_required' ? 'verification_required' : 'error');
    addToast(reason, errorType === 'verification_required' ? 'warning' : 'error');
    loadData();
  }), []);

  useEffect(() => ElectronService.onTelegramProfilesUpdated(({ profiles: updatedProfiles }) => {
    if (!Array.isArray(updatedProfiles)) return;
    applySchedulerProfiles(updatedProfiles, { notify: true });
  }), []);

  useEffect(() => {
    let busy = false;
    const refreshFromScheduler = async () => {
      if (busy || !schedulerHydratedRef.current) return;
      busy = true;
      try {
        const result = await ElectronService.getSchedulerProfiles();
        if (result?.success) applySchedulerProfiles(result.profiles, { notify: true });
      } catch (error) {
        console.error('Không thể đồng bộ lịch Telegram:', error);
      } finally {
        busy = false;
      }
    };
    const handleFocus = () => refreshFromScheduler();
    const timer = window.setInterval(refreshFromScheduler, 5000);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 3500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Profile Actions
  const handleSaveProfile = (formData) => {
    if (editingProfile) {
      const updated = ProfileStorage.updateProfile(formData);
      setProfiles(updated);
      addToast(`Đã cập nhật hồ sơ "${formData.name}" thành công!`, 'success');
    } else {
      const updated = ProfileStorage.addProfile(formData);
      setProfiles(updated);
      addToast(`Đã tạo hồ sơ mẫu "${formData.name}" thành công!`, 'success');
    }
    setLogs(ProfileStorage.getLogs());
  };

  const handleOpenAddModal = () => {
    setEditingProfile(null);
    setIsProfileModalOpen(true);
  };

  const handleOpenEditModal = (profile) => {
    setEditingProfile(profile);
    setIsProfileModalOpen(true);
  };

  const handleOpenPageModal = (profile) => {
    setPageModalProfile(profile);
    setIsPageModalOpen(true);
  };

  const handleOpenScheduleModal = (profile) => {
    setScheduleModalProfile(profile);
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = (profileId, scheduleConfig, managedPages = []) => {
    ProfileStorage.updateProfileSchedule(profileId, scheduleConfig);
    const current = ProfileStorage.getProfiles().find((profile) => profile.id === profileId);
    const updated = managedPages.length
      ? ProfileStorage.selectPageForProfile(profileId, {
          managedPages,
          pageRotationMode: current?.pageRotationMode || 'sequential',
          pageName: current?.pageName || managedPages[0]?.name || '',
          pageUrl: current?.pageUrl || managedPages[0]?.url || '',
          pageRotationIndex: current?.pageRotationIndex || 0,
        }, { silent: true })
      : ProfileStorage.getProfiles();
    setProfiles(updated);
    addToast('Đã lưu lịch chạy riêng cho hồ sơ thành công!', 'success');
    setLogs(ProfileStorage.getLogs());
  };

  const handleSelectPage = (profileId, pageConfig, options = {}) => {
    const updated = ProfileStorage.selectPageForProfile(profileId, pageConfig, options);
    setProfiles(updated);
    if (!options.silent) {
      addToast(`Đã lưu ${pageConfig.managedPages.length} Page cho hồ sơ!`, 'success');
      setLogs(ProfileStorage.getLogs());
    }
  };

  const handleRunPageNow = async (profile, page) => {
    const toMinutes = (value) => {
      const [hour, minute] = String(value || '00:00').split(':').map(Number);
      return hour * 60 + minute;
    };
    let durationMinutes = 30;
    if (page.scheduleEnabled) {
      durationMinutes = toMinutes(page.endTime) - toMinutes(page.startTime);
      if (durationMinutes <= 0) durationMinutes += 24 * 60;
    }
    const isPersonal = page.type === 'personal' || page.id === 'personal';
    const exactProfile = isPersonal
      ? { ...profile, runAsPersonal: true }
      : {
          ...profile,
          runAsPersonal: false,
          pageName: page.name,
          pageUrl: page.url,
          managedPages: [{ ...page, enabled: true }],
          pageRotationMode: 'fixed',
          pageRotationIndex: 0,
        };
    const startTime = new Date().toLocaleTimeString('vi-VN');
    ProfileStorage.updateProfileExecutionStatus(profile.id, 'running');
    loadData();
    addToast(`Đang bắt đầu phiên cho ${page.name} (${durationMinutes} phút)...`, 'info');
    try {
      const result = await ElectronService.startSession({
        profile: exactProfile,
        durationMinutes,
        actionType: 'Xem Feed & Reels (Chỉ xem)',
      });
      if (!result.success) {
        const status = ['verification_required', 'login_expired'].includes(result.errorType) ? 'verification_required' : 'error';
        ProfileStorage.updateProfileExecutionStatus(profile.id, status);
        ProfileStorage.addSessionAuditLog({
          profileName: profile.name,
          pageName: page.name,
          startTime,
          endTime: new Date().toLocaleTimeString('vi-VN'),
          actualDurationStr: '0s',
          stopReason: result.reason || result.message || 'Không thể bắt đầu phiên',
          type: status === 'verification_required' ? 'warning' : 'danger',
        });
        addToast(result.reason || result.message || 'Không thể bắt đầu phiên.', 'error');
      } else {
        const current = ProfileStorage.getProfiles().find((item) => item.id === profile.id) || profile;
        ProfileStorage.updateProfile({
          ...current,
          pageName: result.sessionInfo?.pageName || page.name,
          pageUrl: result.sessionInfo?.pageUrl || page.url,
          managedPages: (current.managedPages || []).map((item) => (
            typeof item === 'object' && item.id === page.id && result.sessionInfo?.actingPageId
              ? { ...item, pageId: result.sessionInfo.actingPageId }
              : item
          )),
        });
        ProfileStorage.addSessionAuditLog({
          profileName: profile.name,
          pageName: page.name,
          startTime,
          endTime: 'Đang chạy',
          actualDurationStr: '0s',
          stopReason: 'Bắt đầu thủ công từ cấu hình Fanpage',
          type: 'info',
        });
        addToast(result.message || `Đã bắt đầu chạy Fanpage "${page.name}".`, 'success');
      }
    } catch (error) {
      ProfileStorage.updateProfileExecutionStatus(profile.id, 'error');
      addToast(`Lỗi khởi chạy Fanpage "${page.name}": ${error.message}`, 'error');
    } finally {
      loadData();
    }
  };

  const handleDeleteSchedule = (profile, target, slot) => {
    const current = ProfileStorage.getProfiles().find((item) => item.id === profile.id);
    if (!current) return;
    if (target.type === 'personal') {
      const scheduleConfig = {
        ...(current.scheduleConfig || {}),
        personalSchedules: (current.scheduleConfig?.personalSchedules || []).filter((item) => item.id !== slot.id),
      };
      ProfileStorage.updateProfileSchedule(profile.id, scheduleConfig);
    } else {
      const managedPages = (current.managedPages || []).map((page) => {
        if (typeof page !== 'object' || page.id !== target.id) return page;
        const schedules = Array.isArray(page.schedules)
          ? page.schedules
          : (page.scheduleEnabled ? [{ id: `legacy-${page.id}`, enabled: true, startTime: page.startTime, endTime: page.endTime }] : []);
        const nextSchedules = schedules.filter((item) => item.id !== slot.id);
        return { ...page, schedules: nextSchedules, scheduleEnabled: nextSchedules.length > 0 };
      });
      ProfileStorage.selectPageForProfile(profile.id, { managedPages }, { silent: true });
    }
    ProfileStorage.addLog({
      profileName: profile.name,
      pageName: target.name,
      action: 'Xóa ca chạy',
      type: 'info',
      details: `${slot.startTime}–${slot.endTime}`,
    });
    loadData();
    addToast(`Đã xóa ca ${slot.startTime}–${slot.endTime} của ${target.name}.`, 'success');
  };

  const handleConfirmDelete = (id) => {
    setDeletingId(id);
    setIsConfirmDeleteOpen(true);
  };

  const handleDeleteProfile = () => {
    if (deletingId) {
      const target = profiles.find((p) => p.id === deletingId);
      const updated = ProfileStorage.deleteProfile(deletingId);
      setProfiles(updated);
      if (target) {
        addToast(`Đã xóa hồ sơ "${target.name}"!`, 'info');
      }
      setLogs(ProfileStorage.getLogs());
    }
    setIsConfirmDeleteOpen(false);
    setDeletingId(null);
  };

  const handleToggleStatus = (id) => {
    const updated = ProfileStorage.toggleStatus(id);
    setProfiles(updated);
    const p = updated.find((item) => item.id === id);
    if (p) {
      addToast(`Hồ sơ "${p.name}" đã được ${p.status ? 'BẬT' : 'TẮT'}`, p.status ? 'success' : 'info');
    }
    setLogs(ProfileStorage.getLogs());
  };

  const handleToggleAll = (status) => {
    const updated = profiles.map((p) => ({ ...p, status }));
    ProfileStorage.saveProfiles(updated);
    setProfiles(updated);
    addToast(`Đã ${status ? 'BẬT' : 'TẮT'} tất cả ${profiles.length} hồ sơ tài khoản!`, 'success');
    
    ProfileStorage.addLog({
      profileName: 'Tất cả hồ sơ',
      pageName: 'Hệ thống',
      action: `Thực hiện ${status ? 'BẬT' : 'TẮT'} hàng loạt hồ sơ`,
      type: status ? 'success' : 'warning',
      details: `Thay đổi trạng thái hàng loạt cho ${profiles.length} hồ sơ.`
    });
    setLogs(ProfileStorage.getLogs());
  };

  const handleAddQuickSample = () => {
    const count = profiles.length + 1;
    const sample = {
      name: `Hồ sơ Mẫu Thao Tác ${count}`,
      proxy: `192.0.2.${Math.floor(Math.random() * 190) + 10}:8080`,
      pageName: `Page Thời Trang Hot ${count}`,
      status: true,
      targetAction: 'Xem Feed & Reels (25 phút/phiên)',
    };
    const updated = ProfileStorage.addProfile(sample);
    setProfiles(updated);
    addToast(`Đã thêm nhanh hồ sơ mẫu "${sample.name}"!`, 'success');
    setLogs(ProfileStorage.getLogs());
  };

  const handleClearLogs = () => {
    const cleared = ProfileStorage.clearLogs();
    setLogs(cleared);
    addToast('Đã dọn dẹp nhật ký hoạt động!', 'info');
  };

  const handleStopScheduledRun = async (profile) => {
    const result = await ElectronService.stopSession(profile.id);
    if (result.success) {
      ProfileStorage.updateProfileExecutionStatus(profile.id, 'completed');
      addToast(result.message || `Đã dừng phiên của hồ sơ "${profile.name}".`, 'success');
    } else {
      addToast(result.message || `Không thể dừng hồ sơ "${profile.name}".`, 'error');
    }
    loadData();
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Tổng Quan Hệ Thống';
      case 'profiles':
        return 'Quản Lý Hồ Sơ & Đăng Nhập Facebook';
      case 'schedule':
        return 'Lịch Chạy Mở Facebook';
      case 'scheduled-runs':
        return 'Lịch Đã Lên';
      case 'logs':
        return 'Nhật Ký Hoạt Động';
      case 'telegram':
        return 'Telegram & Thông Báo Nhật Ký';
      default:
        return 'Tổng Quan';
    }
  };

  const activeProfilesCount = profiles.filter((p) => p.status).length;
  return (
    <div className={`app-container ${activeTab === 'dashboard' ? 'dashboard-active' : ''} ${activeTab === 'profiles' ? 'profiles-active' : ''} ${activeTab === 'schedule' ? 'schedule-active' : ''} ${activeTab === 'scheduled-runs' ? 'scheduled-runs-active' : ''} ${activeTab === 'logs' ? 'logs-active' : ''} ${activeTab === 'telegram' ? 'telegram-active' : ''}`}>
      {/* Sidebar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProfilesCount={activeProfilesCount}
        totalProfilesCount={profiles.length}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <TopHeader
          activeTabTitle={getTabTitle()}
          profilesCount={profiles.length}
          activeProfilesCount={activeProfilesCount}
          onRefresh={loadData}
          onOpenTelegram={() => setIsTelegramModalOpen(true)}
        />

        <main className="content-body">
          {activeTab === 'dashboard' && (
            <DashboardView
              profiles={profiles}
              schedules={schedules}
              logs={logs}
              onNavigateToProfiles={() => setActiveTab('profiles')}
              onNavigateToSchedule={() => setActiveTab('schedule')}
              onNavigateToLogs={() => setActiveTab('logs')}
              onOpenAddModal={handleOpenAddModal}
              onToggleAll={handleToggleAll}
            />
          )}

          {activeTab === 'profiles' && (
            <ProfilesView
              profiles={profiles}
              onOpenAddModal={handleOpenAddModal}
              onOpenEditModal={handleOpenEditModal}
              onOpenPageModal={handleOpenPageModal}
              onConfirmDelete={handleConfirmDelete}
              onToggleStatus={handleToggleStatus}
              onToggleAll={handleToggleAll}
              onAddQuickSample={handleAddQuickSample}
              addToast={addToast}
              onRefreshData={loadData}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleView profiles={profiles} onOpenScheduleModal={handleOpenScheduleModal} />
          )}

          {activeTab === 'scheduled-runs' && (
            <ScheduledRunsView
              profiles={profiles}
              logs={logs}
              onRunNow={handleRunPageNow}
              onStop={handleStopScheduledRun}
              onEdit={handleOpenScheduleModal}
              onDeleteSchedule={handleDeleteSchedule}
              onOpenLogs={() => setActiveTab('logs')}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'logs' && (
            <LogsView logs={logs} onClearLogs={handleClearLogs} />
          )}

          {activeTab === 'telegram' && (
            <TelegramView onOpenSettings={() => setIsTelegramModalOpen(true)} addToast={addToast} />
          )}
        </main>
      </div>

      {/* Modals & Toasts */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfile}
        profile={editingProfile}
      />

      <PageSelectorModal
        isOpen={isPageModalOpen}
        onClose={() => setIsPageModalOpen(false)}
        profile={pageModalProfile}
        onSelectPage={handleSelectPage}
      />

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        profile={scheduleModalProfile}
        onSaveSchedule={handleSaveSchedule}
      />

      <TelegramSettingsModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        addToast={addToast}
      />

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDeleteProfile}
        title="Xác nhận xóa hồ sơ tài khoản"
        message="Bạn có chắc chắn muốn xóa hồ sơ tài khoản mẫu này khỏi hệ thống?"
      />

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
