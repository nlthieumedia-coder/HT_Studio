import React from 'react';
import {
  Bell,
  CircleHelp,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Monitor,
  WifiOff,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  ListOrdered,
  Users,
  Film,
  Terminal,
  Settings,
  TriangleAlert,
  ListChecks,
  HeartPulse,
  Activity,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge, cx } from './ui';
import { FirstRunSetup } from './FirstRunSetup';
import { useI18n } from '../i18n/I18nContext';
import { useTranslation } from 'react-i18next';

const navigation = [
  { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard },
  { key: 'projects', path: '/projects', icon: FolderKanban },
  { key: 'productionRuns', path: '/production-runs', icon: Activity },
  { key: 'jobs', path: '/jobs', icon: ListOrdered },
  { key: 'queue', path: '/queue', icon: ListChecks },
  { key: 'interrupted', path: '/interrupted', icon: TriangleAlert },
  { key: 'accounts', path: '/accounts', icon: Users },
  { key: 'outputs', path: '/outputs', icon: Film },
  { key: 'logs', path: '/logs', icon: Terminal },
  { key: 'health', path: '/health', icon: HeartPulse },
  { key: 'settings', path: '/settings', icon: Settings },
];

export const AppSidebar: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed, backendStatus } = useApp();
  const { t } = useTranslation();
  return (
    <aside className={cx('app-sidebar', sidebarCollapsed && 'collapsed')}>
      <div className="brand">
        <span className="brand-mark">HT</span>
        {!sidebarCollapsed && (
          <div>
            <strong>HT Dola Studio</strong>
            <small>Production manager</small>
          </div>
        )}
        <button
          className="icon-button collapse-button"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
      <nav aria-label="Primary navigation">
        {navigation.map(({ key, path, icon: Icon }) => {
          const label = t(`nav.${key}`);
          return (
            <NavLink
              key={path}
              to={path}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) => cx('nav-link', isActive && 'active')}
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        {!sidebarCollapsed && (
          <>
            <strong>HT Dola Studio</strong>
            <small>Version 1.0.0</small>
          </>
        )}
        <StatusBadge status={backendStatus} label={sidebarCollapsed ? '' : backendStatus} />
      </div>
    </aside>
  );
};

const routeKey = (pathname: string): string => {
  if (pathname.startsWith('/projects/')) return 'projects';
  const item = navigation.find((nav) => pathname.startsWith(nav.path));
  return item?.key ?? 'dashboard';
};

export const AppTopbar: React.FC = () => {
  const location = useLocation();
  const { backendStatus, theme, setTheme } = useApp();
  const { language, setLanguage } = useI18n();
  const { t } = useTranslation();
  const page = t(`nav.${routeKey(location.pathname)}`);
  const nextTheme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
  return (
    <header className="app-topbar">
      <div>
        <strong>{page}</strong>
      </div>
      <div className="topbar-actions">
        <select
          aria-label="Language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as 'vi' | 'en')}
        >
          <option value="vi">VI</option>
          <option value="en">EN</option>
        </select>
        <StatusBadge status={backendStatus} />
        <button
          className="icon-button"
          title={`Theme: ${theme}. Click for ${nextTheme}.`}
          aria-label={`Change theme, current theme ${theme}`}
          onClick={() => setTheme(nextTheme)}
        >
          {theme === 'dark' ? (
            <Moon size={16} />
          ) : theme === 'light' ? (
            <Sun size={16} />
          ) : (
            <Monitor size={16} />
          )}
        </button>
        <button
          className="icon-button"
          aria-label="Notifications"
          title="Notifications (coming soon)"
        >
          <Bell size={16} />
        </button>
        <button className="icon-button" aria-label="Help and user menu" title="Help (coming soon)">
          <CircleHelp size={16} />
        </button>
      </div>
    </header>
  );
};

export const AppStatusBar: React.FC = () => {
  const { backendStatus } = useApp();
  return (
    <footer className="app-statusbar">
      <span>{backendStatus === 'OFFLINE' && <WifiOff size={12} />} Local workspace</span>
      <span>Version 1.0.0</span>
      <span>Service 127.0.0.1:3001</span>
    </footer>
  );
};
export const AppShell: React.FC = () => (
  <div className="app-shell">
    <FirstRunSetup />
    <AppSidebar />
    <div className="app-column">
      <AppTopbar />
      <main className="app-content">
        <Outlet />
      </main>
      <AppStatusBar />
    </div>
  </div>
);
