import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { healthService } from '../api/services';
import type { BackendStatus, ThemePreference } from '../types/ui';

interface AppContextValue {
  backendStatus: BackendStatus;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const THEME_PREFERENCES: ReadonlyArray<ThemePreference> = ['dark', 'light', 'system'];

const getStoredTheme = (): ThemePreference => {
  const storedTheme = localStorage.getItem('ht-theme');
  return THEME_PREFERENCES.includes(storedTheme as ThemePreference)
    ? (storedTheme as ThemePreference)
    : 'system';
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('CONNECTING');
  const [theme, setThemeState] = useState<ThemePreference>(getStoredTheme);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => localStorage.getItem('ht-sidebar-collapsed') === 'true');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    apply(); media.addEventListener('change', apply); localStorage.setItem('ht-theme', theme);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try { const response = await healthService.check(); if (active) setBackendStatus(response.status === 'ok' ? 'ONLINE' : 'OFFLINE'); }
      catch { if (active) setBackendStatus('OFFLINE'); }
    };
    void check(); const interval = window.setInterval(check, 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const setTheme = (value: ThemePreference) => setThemeState(value);
  const setSidebarCollapsed = (value: boolean) => { setSidebarCollapsedState(value); localStorage.setItem('ht-sidebar-collapsed', String(value)); };
  const value = useMemo(() => ({ backendStatus, theme, setTheme, sidebarCollapsed, setSidebarCollapsed }), [backendStatus, theme, sidebarCollapsed]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextValue => {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
};
