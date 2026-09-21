import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { logService } from '../api/services';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterSelect,
  LoadingState,
  PageHeader,
  SearchInput,
  StatusBadge,
  type Column,
} from '../components/ui';
import type { LogListItem } from '../types/ui';

export const LogsPage: React.FC = () => {
  const load = useCallback(() => logService.list(), []);
  const { data, loading, error, reload } = useAsyncData(load);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('ALL');
  const [module, setModule] = useState('ALL');
  const [job, setJob] = useState('ALL');
  const [worker, setWorker] = useState('ALL');
  const [account, setAccount] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(reload, 5000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, reload]);
  const values = (key: keyof Pick<LogListItem, 'module' | 'job' | 'worker' | 'account'>) =>
    [...new Set((data ?? []).map((item) => item[key]).filter(Boolean))] as string[];
  const rows = useMemo(
    () =>
      hidden
        ? []
        : (data ?? []).filter(
            (item) =>
              (level === 'ALL' || item.level === level) &&
              (module === 'ALL' || item.module === module) &&
              (job === 'ALL' || item.job === job) &&
              (worker === 'ALL' || item.worker === worker) &&
              (account === 'ALL' || item.account === account) &&
              `${item.message} ${item.job} ${item.worker} ${item.account ?? ''}`.toLowerCase().includes(search.toLowerCase()),
          ),
    [data, hidden, search, level, module, job, worker, account],
  );
  const columns: Column<LogListItem>[] = [
    { key: 'time', header: 'Time', cell: (row) => <span className="mono muted">{new Date(row.timestamp).toLocaleTimeString()}</span>, sortValue: (row) => row.timestamp },
    { key: 'level', header: 'Level', cell: (row) => <StatusBadge status={row.level} /> },
    { key: 'module', header: 'Module', cell: (row) => row.module },
    { key: 'job', header: 'Job', cell: (row) => <span className="mono">{row.job}</span> },
    { key: 'worker', header: 'Worker', cell: (row) => <span className="mono">{row.worker}</span> },
    { key: 'account', header: 'Account', cell: (row) => <span className="mono">{row.account ?? '—'}</span> },
    { key: 'message', header: 'Message', cell: (row) => <span className={`log-message level-${row.level.toLowerCase()}`}>{row.message}</span> },
  ];
  return (
    <div className="page-stack">
      <PageHeader title="Application Logs" description="Live structured logs from the local service, workers, and queue." />
      <div className="toolbar wrap">
        <SearchInput placeholder="Search messages..." value={search} onChange={(event) => { setSearch(event.target.value); setHidden(false); }} />
        <FilterSelect label="Log level" value={level} onChange={(event) => setLevel(event.target.value)}><option value="ALL">All levels</option><option>DEBUG</option><option>INFO</option><option>WARN</option><option>ERROR</option></FilterSelect>
        {(['module', 'job', 'worker', 'account'] as const).map((key) => <FilterSelect key={key} label={key} value={{ module, job, worker, account }[key]} onChange={(event) => ({ module: setModule, job: setJob, worker: setWorker, account: setAccount }[key](event.target.value))}><option value="ALL">All {key}s</option>{values(key).map((value) => <option key={value}>{value}</option>)}</FilterSelect>)}
        <label className="toggle-label"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /> Live</label>
        <button className="button secondary" onClick={() => setHidden(true)}><Trash2 size={14} /> Clear View</button>
      </div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : <div className="section-card flush log-table"><DataTable rows={rows} columns={columns} rowKey={(row) => row.id} pageSize={12} empty={<EmptyState title="Log view is empty" description="Persistent logs were not deleted. Change filters or reload to display them again." action={hidden ? <button className="button secondary" onClick={() => setHidden(false)}>Restore View</button> : undefined} />} /></div>}
    </div>
  );
};
