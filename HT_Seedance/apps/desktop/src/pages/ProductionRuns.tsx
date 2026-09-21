import React, { useCallback, useState } from 'react';
import { productionRunService } from '../api/services';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '../components/ui';
import { useToast } from '../components/Toast';
export const ProductionRunsPage: React.FC = () => {
  const { notify } = useToast(),
    [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(() => productionRunService.list(), []),
    { data: runs, loading, error, reload } = useAsyncData(load);
  const act = async (action: 'start' | 'pause' | 'resume' | 'stop' | 'complete') => {
    if (!selected) return;
    try {
      if (action === 'start') {
        const p = await productionRunService.preflight(selected);
        if (p.status === 'BLOCKED') {
          notify(
            'Preflight blocked: ' +
              p.checks
                .filter((c) => c.required && c.status === 'FAIL')
                .map((c) => c.key)
                .join(', '),
          );
          return;
        }
      }
      await productionRunService.action(selected, action);
      await reload();
      notify(`Run ${action} accepted.`);
    } catch {
      notify('Production action failed safely.');
    }
  };
  if (loading) return <LoadingState />;
  if (error || !runs) return <ErrorState message="Cannot load production runs." onRetry={reload} />;
  const active = runs.find((r) => r.id === selected);
  return (
    <div className="page-stack">
      <PageHeader
        title="Production Runs"
        description="Controlled Pilot Mode monitoring and recovery"
      />
      <SectionCard title="Run History" description="Operator-triggered production only.">
        {!runs.length ? (
          <EmptyState
            title="No production runs"
            description="Select queued jobs in a Project Workspace and choose Start Production."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Project</th>
                  <th>Provider</th>
                  <th>Jobs</th>
                  <th>Completed</th>
                  <th>Failed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r.id)}>
                    <td className="mono">{r.id.slice(0, 8)}</td>
                    <td>{r.projectId.slice(0, 8)}</td>
                    <td>{r.provider}</td>
                    <td>{r.totalJobs}</td>
                    <td>{r.completedJobs}</td>
                    <td>{r.failedJobs}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      {active && (
        <SectionCard
          title={`Run ${active.id.slice(0, 8)}`}
          description={`${active.workerCount} worker(s) · settings frozen at creation`}
        >
          <div className="toolbar wrap">
            <button className="button primary" onClick={() => void act('start')}>
              Preflight & Start
            </button>
            <button className="button secondary" onClick={() => void act('pause')}>
              Pause After Current
            </button>
            <button className="button secondary" onClick={() => void act('resume')}>
              Resume
            </button>
            <button className="button danger" onClick={() => void act('stop')}>
              Stop Production
            </button>
            <button
              className="button secondary"
              onClick={() => void productionRunService.reports(active.id)}
            >
              Reports
            </button>
            <button
              className="button secondary"
              onClick={() => void productionRunService.support(active.id)}
            >
              Support Bundle
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
};
