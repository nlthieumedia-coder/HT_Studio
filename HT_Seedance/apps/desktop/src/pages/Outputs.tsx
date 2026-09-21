import React, { useCallback, useMemo, useState } from 'react';
import { ActivitySquare } from 'lucide-react';
import { outputService } from '../api/services';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../components/Toast';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SearchInput,
  type Column,
} from '../components/ui';
import type { OutputListItem } from '../types/ui';

export const OutputsPage: React.FC = () => {
  const load = useCallback(() => outputService.list(), []);
  const { data, loading, error, reload } = useAsyncData(load);
  const [search, setSearch] = useState('');
  const { notify } = useToast();
  const rows = useMemo(
    () =>
      (data ?? []).filter((item) =>
        `${item.scene} ${item.project} ${item.fileName}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [data, search],
  );
  const run = async (label: string, task: () => Promise<unknown>) => {
    try {
      await task();
      notify(label);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Output action failed.');
    }
  };
  const rename = (row: OutputListItem) => {
    const fileName = window.prompt('New output file name', row.fileName);
    if (fileName && fileName !== row.fileName)
      void run('Output renamed.', () => outputService.rename(row.id, fileName));
  };
  const columns: Column<OutputListItem>[] = [
    { key: 'scene', header: 'Scene', cell: (row) => <strong className="mono accent">{row.scene}</strong>, sortValue: (row) => row.scene },
    { key: 'project', header: 'Path', cell: (row) => <span className="truncate-cell">{row.project}</span> },
    { key: 'file', header: 'Output file', cell: (row) => <span className="mono">{row.fileName}</span> },
    { key: 'duration', header: 'Duration', cell: (row) => `${row.duration}s` },
    { key: 'resolution', header: 'Resolution', cell: (row) => row.resolution },
    { key: 'size', header: 'Size', cell: (row) => row.size },
    { key: 'created', header: 'Created', cell: (row) => new Date(row.createdAt).toLocaleString(), sortValue: (row) => row.createdAt },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="row-actions">
          <button className="table-action" onClick={() => run('Media probed.', () => outputService.probe(row.id))}>Probe</button>
          <button className="table-action" onClick={() => rename(row)}>Rename</button>
          <button className="table-action" onClick={() => run('Folder opened.', () => outputService.openFolder(row.id))}>Open Folder</button>
        </div>
      ),
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        title="Output Library"
        description="Browse completed generation files and production metadata."
        actions={<button className="button secondary" onClick={() => run('Media diagnostics loaded.', () => outputService.diagnostics())}><ActivitySquare size={15} /> Diagnostics</button>}
      />
      <div className="toolbar">
        <SearchInput placeholder="Search outputs..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="section-card flush">
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.id}
            empty={<EmptyState title="No generated outputs" description="Completed video files will appear here when production jobs finish." />}
          />
        </div>
      )}
    </div>
  );
};
