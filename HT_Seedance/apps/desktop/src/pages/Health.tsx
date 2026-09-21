import React, { useCallback } from 'react';
import { Download } from 'lucide-react';
import { systemService } from '../api/services';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../components/Toast';
import { ErrorState, LoadingState, PageHeader, SectionCard, StatusBadge } from '../components/ui';

export const HealthPage: React.FC = () => {
  const { notify } = useToast();
  const load = useCallback(() => systemService.health(), []);
  const { data, loading, error, reload } = useAsyncData(load);
  const exportDiagnostics = async () => {
    try {
      const result = await systemService.exportDiagnostics();
      notify(`Diagnostics exported: ${result.data.path}`);
    } catch {
      notify('Diagnostics export failed.');
    }
  };
  const entries = data ? Object.entries(data) : [];
  return (
    <div className="page-stack">
      <PageHeader
        title="System Health"
        description="Database, backend, browser, media tooling, storage, and worker diagnostics."
        actions={<button className="button primary" onClick={exportDiagnostics}><Download size={15} /> Export Diagnostics</button>}
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="settings-grid">
          {entries.map(([key, value]) => {
            const ok = typeof value === 'object' && value !== null && 'ok' in value ? Boolean((value as { ok?: unknown }).ok) : true;
            return (
              <SectionCard key={key} title={key} action={<StatusBadge status={ok ? 'ONLINE' : 'ERROR'} />}>
                <pre className="mono muted">{JSON.stringify(value, null, 2)}</pre>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
