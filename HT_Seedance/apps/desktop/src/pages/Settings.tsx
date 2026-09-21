import React, { useCallback } from 'react';
import { Save, Wrench } from 'lucide-react';
import { settingsService, systemService } from '../api/services';
import { useAsyncData } from '../hooks/useAsyncData';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { ErrorState, FormField, LoadingState, PageHeader, SectionCard } from '../components/ui';
import { BackupRecovery } from '../components/BackupRecovery';
import { useI18n } from '../i18n/I18nContext';
const Toggle: React.FC<{ label: string; defaultChecked?: boolean }> = ({
  label,
  defaultChecked,
}) => (
  <label className="setting-toggle">
    <span>{label}</span>
    <input type="checkbox" defaultChecked={defaultChecked} />
  </label>
);
export const SettingsPage: React.FC = () => {
  const load = useCallback(
    async () => ({
      paths: await settingsService.getStoragePaths(),
      runtime: await systemService.getInfo(),
    }),
    [],
  );
  const { data, loading, error, reload } = useAsyncData(load);
  const { theme, setTheme } = useApp();
  const { language, setLanguage, t } = useI18n();
  const { notify } = useToast();
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? undefined} onRetry={reload} />;
  return (
    <div className="page-stack">
      <PageHeader
        title={t('nav.settings')}
        description={language==='vi'?'Cấu hình giao diện và các mặc định sản xuất.':'Configure the desktop interface and production defaults.'}
        actions={
          <button
            className="button primary"
            onClick={() =>
              notify('Settings persistence will be connected to the repository layer in Phase 2.')
            }
          >
            <Save size={15} /> Save Settings
          </button>
        }
      />
      <div className="settings-grid">
        <BackupRecovery />
        <SectionCard title="General">
          <div className="form-grid">
            <FormField label="Theme">
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as 'dark' | 'light' | 'system')}
              >
                <option value="system">System</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </FormField>
            <FormField label={t('language')}>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as 'vi' | 'en')}
              >
                <option value="vi">{t('vietnamese')}</option>
                <option value="en">{t('english')}</option>
              </select>
            </FormField>
            <Toggle label="Start on system startup" />
            <Toggle label="Minimize to tray" />
          </div>
        </SectionCard>
        <SectionCard title="Browser">
          <div className="form-grid">
            <FormField label="Browser executable mode">
              <select defaultValue="bundled">
                <option value="bundled">Playwright managed</option>
                <option value="custom">Custom executable</option>
              </select>
            </FormField>
            <FormField label="Default launch mode">
              <select defaultValue="visible">
                <option value="visible">Visible</option>
                <option value="headless">Headless</option>
              </select>
            </FormField>
            <FormField label="Browser timeout">
              <input type="number" defaultValue={60} min={10} />{' '}
            </FormField>
            <FormField label="Profile base directory">
              <input readOnly value={data.paths.profiles} />
            </FormField>
          </div>
        </SectionCard>
        <SectionCard title="Workers">
          <div className="form-grid">
            <FormField label="Max concurrent workers">
              <input type="number" defaultValue={2} min={1} />
            </FormField>
            <FormField label="Default job timeout (seconds)">
              <input type="number" defaultValue={900} min={30} />
            </FormField>
            <FormField label="Graceful shutdown timeout (seconds)">
              <input type="number" defaultValue={30} min={5} />
            </FormField>
          </div>
        </SectionCard>
        <SectionCard title="Downloads">
          <div className="form-grid">
            <FormField label="Default download directory">
              <input readOnly value={data.paths.downloads} />
            </FormField>
            <FormField label="Filename template">
              <input defaultValue="{project}_{scene}_{timestamp}" />
            </FormField>
            <Toggle label="Auto-open folder after batch" />
          </div>
        </SectionCard>
        <SectionCard title="FFmpeg">
          <div className="form-grid">
            <FormField label="FFmpeg path">
              <input placeholder="Use system PATH" />
            </FormField>
            <FormField label="FFprobe path">
              <input placeholder="Use system PATH" />
            </FormField>
            <button
              className="button secondary"
              onClick={() => notify('Installation testing is a future integration.')}
            >
              <Wrench size={14} /> Test Installation
            </button>
          </div>
        </SectionCard>
        <SectionCard title="Storage">
          <dl className="path-list">
            <div>
              <dt>Database</dt>
              <dd>{data.paths.database}</dd>
            </div>
            <div>
              <dt>Profiles</dt>
              <dd>{data.paths.profiles}</dd>
            </div>
            <div>
              <dt>Projects</dt>
              <dd>{data.paths.projects}</dd>
            </div>
            <div>
              <dt>Downloads</dt>
              <dd>{data.paths.downloads}</dd>
            </div>
            <div>
              <dt>Logs</dt>
              <dd>{data.paths.logs}</dd>
            </div>
          </dl>
        </SectionCard>
        <SectionCard title="Advanced & System">
          <div className="form-grid">
            <Toggle label="Developer logging" />
            <Toggle label="Diagnostic screenshots" />
            <button
              className="button secondary"
              onClick={() => {
                localStorage.removeItem('ht-sidebar-collapsed');
                localStorage.removeItem('ht-theme');
                localStorage.removeItem('ht-language');
                notify('UI preferences reset. Reload to apply all defaults.');
              }}
            >
              Reset UI Preferences
            </button>
          </div>
          {data.runtime ? (
            <dl className="system-info">
              <div>
                <dt>Service</dt>
                <dd>{data.runtime.system.service}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{data.runtime.system.version}</dd>
              </div>
              <div>
                <dt>Runtime</dt>
                <dd>{data.runtime.system.nodeVersion}</dd>
              </div>
              <div>
                <dt>Platform</dt>
                <dd>
                  {data.runtime.system.platform} / {data.runtime.system.arch}
                </dd>
              </div>
              <div>
                <dt>Uptime</dt>
                <dd>{data.runtime.system.uptimeSeconds}s</dd>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>{data.runtime.system.memoryUsageMb.heapUsed} MB heap</dd>
              </div>
            </dl>
          ) : (
            <p className="inline-warning">
              System information is unavailable while the local service is offline.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
};
