import React, { useCallback } from 'react';
import { Pause, Play, Octagon } from 'lucide-react';
import { jobService, type ApiJob } from '../api/services';
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader, SectionCard, StatusBadge, type Column } from '../components/ui';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../components/Toast';

const scene = (job: ApiJob) => `SCENE_${String(job.sceneNumber).padStart(4, '0')}`;

export const QueuePage: React.FC = () => {
  const { notify } = useToast();
  const load = useCallback(() => jobService.queueSnapshot(), []);
  const { data, loading, error, reload } = useAsyncData(load);
  const act = async (message: string, action: () => Promise<unknown>) => {
    try {
      await action();
      notify(message);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Queue action failed.');
    }
  };
  const columns: Column<ApiJob>[] = [
    { key: 'scene', header: 'Scene', cell: (row) => <strong className="mono accent">{scene(row)}</strong> },
    { key: 'project', header: 'Project', cell: (row) => row.projectName ?? row.projectId },
    { key: 'account', header: 'Account', cell: (row) => row.accountName ?? 'Unassigned' },
    { key: 'priority', header: 'Priority', cell: (row) => row.priority, sortValue: (row) => row.priority },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    { key: 'prompt', header: 'Prompt', cell: (row) => <span className="truncate-cell">{row.prompt}</span> },
  ];
  const waitingColumns: Column<ApiJob>[] = [
    ...columns,
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <button className="table-action danger-text" onClick={() => act('Queued job cancelled.', () => jobService.cancel(row.id))}>
          Cancel
        </button>
      ),
    },
  ];
  const failedColumns: Column<ApiJob>[] = [
    ...columns,
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <button className="table-action" onClick={() => act('Failed job queued for retry.', () => jobService.retryFailed(row.id))}>
          Retry
        </button>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Production Queue"
        description="Run priority-ordered jobs while keeping account selection explicit and recoverable."
        actions={
          <div className="row-actions">
            <button className="button secondary" disabled={data?.state.paused} onClick={() => act('Queue paused.', () => jobService.pauseQueue())}>
              <Pause size={15} /> Pause Queue
            </button>
            <button className="button secondary" disabled={!data?.state.paused && !data?.state.stopAfterCurrent} onClick={() => act('Queue resumed.', () => jobService.resumeQueue())}>
              <Play size={15} /> Resume Queue
            </button>
            <button className="button secondary" disabled={data?.state.stopAfterCurrent} onClick={() => act('Queue will stop after current jobs.', () => jobService.stopAfterCurrent())}>
              <Octagon size={15} /> Stop After Current Jobs
            </button>
          </div>
        }
      />
      {loading ? (
        <LoadingState />
      ) : error || !data ? (
        <ErrorState message={error ?? undefined} onRetry={reload} />
      ) : (
        <>
          <SectionCard title="Running" description="Jobs already claimed by workers.">
            <DataTable rows={data.running} columns={columns} rowKey={(row) => row.id} pageSize={6} empty={<EmptyState title="Nothing running" description="No worker has claimed a job." />} />
          </SectionCard>
          <SectionCard title="Waiting" description="Queued by priority, FIFO within the same priority.">
            <DataTable rows={data.waiting} columns={waitingColumns} rowKey={(row) => row.id} pageSize={8} empty={<EmptyState title="Queue is empty" description="No jobs are waiting." />} />
          </SectionCard>
          <SectionCard title="Failed" description="Retry only jobs with retryable failure classifications.">
            <DataTable rows={data.failed} columns={failedColumns} rowKey={(row) => row.id} pageSize={6} empty={<EmptyState title="No failed jobs" description="There are no failed jobs waiting for retry." />} />
          </SectionCard>
          <SectionCard title="Completed" description="Recently completed queue work.">
            <DataTable rows={data.completed} columns={columns} rowKey={(row) => row.id} pageSize={6} empty={<EmptyState title="No completed jobs" description="Completed jobs will appear here." />} />
          </SectionCard>
        </>
      )}
    </div>
  );
};
