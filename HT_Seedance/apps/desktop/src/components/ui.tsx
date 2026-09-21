import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react';
import { JobState } from '@ht-dola/shared';
import { translateStatus } from '../i18n';
import { useTranslation } from 'react-i18next';

export const cx = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');

export const PageHeader: React.FC<{
  title: string;
  description: string;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <header className="page-header">
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
);

export const SectionCard: React.FC<{
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, action, children, className }) => (
  <section className={cx('section-card', className)}>
    {(title || action) && (
      <div className="section-heading">
        <div>
          {title && <h2>{title}</h2>}
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

export const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  meta?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}> = ({ icon, label, value, meta, tone = 'default' }) => (
  <div className={cx('stat-card', `tone-${tone}`)}>
    <span className="stat-icon">{icon}</span>
    <div>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {meta && <small>{meta}</small>}
    </div>
  </div>
);

const statusTone = (status: string): string => {
  if ([JobState.COMPLETED, 'ONLINE', 'AUTHENTICATED', 'ACTIVE', 'ENABLED'].includes(status))
    return 'success';
  if ([JobState.FAILED, JobState.INTERRUPTED, 'OFFLINE', 'ERROR', 'EXPIRED'].includes(status))
    return 'danger';
  if (
    [JobState.QUEUED, JobState.WAITING_FOR_WORKER, 'CONNECTING', 'PAUSED', 'WARN'].includes(status)
  )
    return 'warning';
  if (
    [
      JobState.GENERATING,
      JobState.DOWNLOADING,
      JobState.PROCESSING,
      JobState.SUBMITTING,
      'RUNNING',
      'BUSY',
    ].includes(status)
  )
    return 'info';
  return 'neutral';
};

export const StatusBadge: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  useTranslation();
  return (
    <span
      className={cx('status-badge', `status-${statusTone(status)}`)}
      aria-label={label === '' ? status : undefined}
      title={label === '' ? status : undefined}
    >
      <i />
      {label ?? translateStatus(status)}
    </span>
  );
};
export const ProgressBar: React.FC<{ value: number; label?: string }> = ({ value, label }) => (
  <div className="progress-wrap">
    <div className="progress-track">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
    <small>{label ?? `${value}%`}</small>
  </div>
);

export const SearchInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className,
  ...props
}) => (
  <label className={cx('search-input', className)}>
    <Search size={14} />
    <span className="sr-only">Search</span>
    <input type="search" {...props} />
  </label>
);
export const FilterSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }
> = ({ label, children, ...props }) => (
  <label className="filter-select">
    <span className="sr-only">{label}</span>
    <select aria-label={label} {...props}>
      {children}
    </select>
    <ChevronDown size={13} />
  </label>
);
export const LoadingState: React.FC = () => (
  <div className="state-panel">
    <LoaderCircle className="spin" size={24} />
    <strong>Loading</strong>
    <span>Preparing the latest local data…</span>
  </div>
);
export const ErrorState: React.FC<{
  message?: string | undefined;
  onRetry?: (() => void) | undefined;
}> = ({ message = 'This view could not be loaded.', onRetry }) => (
  <div className="state-panel">
    <AlertTriangle size={24} />
    <strong>Something went wrong</strong>
    <span>{message}</span>
    {onRetry && (
      <button className="button secondary" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);
export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="state-panel">
    <Inbox size={26} />
    <strong>{title}</strong>
    <span>{description}</span>
    {action}
  </div>
);

export const FormField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <label className="form-field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
);

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}
export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  pageSize?: number;
  selectable?: boolean;
  empty?: React.ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  pageSize = 8,
  selectable = false,
  empty,
}: DataTableProps<T>): React.ReactElement {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = column.sortValue?.(a) ?? '';
      const bv = column.sortValue?.(b) ?? '';
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.direction === 'asc' ? 1 : -1);
    });
  }, [rows, columns, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue) return;
    setSort((value) =>
      value?.key === column.key
        ? { key: column.key, direction: value.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, direction: 'asc' },
    );
  };
  if (!rows.length)
    return (
      <>
        {empty ?? (
          <EmptyState title="No results" description="No records match the current filters." />
        )}
      </>
    );
  return (
    <div className="data-table-shell">
      {selected.size > 0 && (
        <div className="bulk-bar">
          <strong>{selected.size} selected</strong>
          <button className="button ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {selectable && (
                <th>
                  <input
                    aria-label="Select visible rows"
                    type="checkbox"
                    checked={
                      visible.length > 0 && visible.every((row) => selected.has(rowKey(row)))
                    }
                    onChange={(event) => {
                      const next = new Set(selected);
                      visible.forEach((row) =>
                        event.target.checked ? next.add(rowKey(row)) : next.delete(rowKey(row)),
                      );
                      setSelected(next);
                    }}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.key} className={column.className}>
                  <button disabled={!column.sortValue} onClick={() => toggleSort(column)}>
                    {column.header}
                    {sort?.key === column.key && (
                      <span>{sort.direction === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={rowKey(row)}>
                {selectable && (
                  <td>
                    <input
                      aria-label={`Select ${rowKey(row)}`}
                      type="checkbox"
                      checked={selected.has(rowKey(row))}
                      onChange={() => {
                        const next = new Set(selected);
                        next.has(rowKey(row)) ? next.delete(rowKey(row)) : next.add(rowKey(row));
                        setSelected(next);
                      }}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="pagination">
          <span>
            {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, rows.length)} of{' '}
            {rows.length}
          </span>
          <button
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            aria-label="Next page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

export const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title, onClose, children }) =>
  open ? (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  ) : null;
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ open, title, description, onConfirm, onClose }) => (
  <Modal open={open} title={title} onClose={onClose}>
    <p className="muted">{description}</p>
    <div className="dialog-actions">
      <button className="button secondary" onClick={onClose}>
        Cancel
      </button>
      <button className="button danger" onClick={onConfirm}>
        Confirm
      </button>
    </div>
  </Modal>
);
