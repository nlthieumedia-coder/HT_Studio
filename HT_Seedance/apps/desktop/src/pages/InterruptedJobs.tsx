import React, { useCallback, useMemo, useState } from 'react';
import { JobState } from '@ht-dola/shared';
import { RotateCcw, SearchCheck, ShieldX, XCircle } from 'lucide-react';
import { jobService } from '../api/services';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  StatusBadge,
  type Column,
} from '../components/ui';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../components/Toast';
import type { InterruptedJobDetail, JobAttemptItem } from '../types/ui';

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : 'Pending';

export const InterruptedJobsPage: React.FC = () => {
  const { notify } = useToast();
  const load = useCallback(() => jobService.interrupted(), []);
  const { data, loading, error, reload } = useAsyncData(load);
  const [selected, setSelected] = useState<InterruptedJobDetail | null>(null);
  const rows = useMemo(() => data ?? [], [data]);

  const act = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      notify(label);
      setSelected(null);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Recovery action failed.');
    }
  };

  const columns: Column<InterruptedJobDetail>[] = [
    { key: 'scene', header: 'Scene', cell: (row) => `SCENE_${String(row.job.sceneNumber).padStart(4, '0')}` },
    { key: 'project', header: 'Project', cell: (row) => row.job.projectName ?? row.job.projectId },
    { key: 'account', header: 'Account', cell: (row) => row.job.accountName ?? 'Unassigned' },
    { key: 'error', header: 'Error', cell: (row) => row.job.errorCode ?? 'UNKNOWN' },
    { key: 'attempts', header: 'Attempts', cell: (row) => `${row.job.attemptCount}/${row.job.maxAttempts}` },
    {
      key: 'retry',
      header: 'Retry',
      cell: (row) => (row.retry.retryable ? formatDate(row.retry.nextAttemptAt) : row.retry.reason),
    },
    { key: 'status', header: 'Status', cell: () => <StatusBadge status={JobState.INTERRUPTED} /> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="row-actions">
          <button className="table-action" onClick={() => setSelected(row)}>
            <SearchCheck size={14} /> Inspect
          </button>
          <button className="table-action" disabled={!row.retry.retryable} onClick={() => act('Job queued for retry.', () => jobService.retry(row.job.id))}>
            <RotateCcw size={14} /> Retry
          </button>
          <button className="table-action" onClick={() => act('Job marked failed.', () => jobService.markFailed(row.job.id))}>
            <ShieldX size={14} /> Mark Failed
          </button>
          <button className="table-action danger-text" onClick={() => act('Job cancelled.', () => jobService.cancel(row.job.id))}>
            <XCircle size={14} /> Cancel
          </button>
        </div>
      ),
    },
  ];

  const attemptColumns: Column<JobAttemptItem>[] = [
    { key: 'attempt', header: 'Attempt', cell: (row) => row.attemptNumber },
    { key: 'start', header: 'Start', cell: (row) => formatDate(row.startedAt) },
    { key: 'end', header: 'End', cell: (row) => formatDate(row.endedAt) },
    { key: 'account', header: 'Account', cell: (row) => row.accountId ?? 'Unassigned' },
    { key: 'worker', header: 'Worker', cell: (row) => row.workerId ?? 'Unassigned' },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    { key: 'error', header: 'Error', cell: (row) => row.errorCode ?? row.errorMessage ?? 'None' },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Interrupted Jobs"
        description="Inspect crashed or unresolved jobs before choosing a recovery action."
        actions={<button className="button secondary" onClick={reload}>Refresh</button>}
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="section-card flush">
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.job.id}
            pageSize={10}
            empty={<EmptyState title="No interrupted jobs" description="There are no jobs waiting for manual recovery." />}
          />
        </div>
      )}
      <Modal open={Boolean(selected)} title="Attempt History" onClose={() => setSelected(null)}>
        {selected && (
          <div className="page-stack">
            <p className="muted">{selected.retry.reason}</p>
            <DataTable
              rows={selected.attempts}
              columns={attemptColumns}
              rowKey={(row) => row.id}
              pageSize={6}
              empty={<EmptyState title="No attempts" description="This job does not have recorded attempts yet." />}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
