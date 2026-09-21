import React, { useCallback, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { accountService } from '../api/services';
import { ApiError } from '../api/client';
import { formatDate, translateStatus } from '../i18n';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../components/Toast';
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FilterSelect,
  LoadingState,
  Modal,
  PageHeader,
  SearchInput,
  StatusBadge,
  type Column,
} from '../components/ui';
import type { AccountListItem } from '../types/ui';
export const AccountsPage: React.FC = () => {
  const { t } = useTranslation(['accounts', 'common', 'errors']);
  const load = useCallback(() => accountService.list(), []);
  const { data, loading, error, reload } = useAsyncData(load);
  const { notify } = useToast();
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('ALL'),
    [modalOpen, setModalOpen] = useState(false),
    [displayName, setDisplayName] = useState(''),
    [provider, setProvider] = useState('dola'),
    [enabled, setEnabled] = useState(true),
    [deleting, setDeleting] = useState<AccountListItem | null>(null);
  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (item) =>
          (status === 'ALL' || item.loginStatus === status) &&
          `${item.name} ${item.provider} ${item.browserProfile}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data, search, status],
  );
  const message = (error: unknown) =>
    t(`errors:${error instanceof ApiError ? error.code : 'UNKNOWN'}`);
  const execute = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      notify(success);
      await reload();
    } catch (e) {
      notify(message(e));
    }
  };
  const toggle = async (row: AccountListItem, value: boolean) =>
    execute(
      () => accountService.setEnabled(row.id, value),
      value ? t('common:status.IDLE') : t('disable'),
    );
  const columns: Column<AccountListItem>[] = [
    {
      key: 'account',
      header: t('displayName'),
      cell: (r) => <strong>{r.name}</strong>,
      sortValue: (r) => r.name,
    },
    { key: 'provider', header: t('provider'), cell: (r) => r.provider },
    {
      key: 'profile',
      header: t('profile'),
      cell: (r) => <span className="mono">{r.browserProfile}</span>,
    },
    {
      key: 'login',
      header: t('loginStatus'),
      cell: (r) => <StatusBadge status={r.loginStatus} label={translateStatus(r.loginStatus)} />,
    },
    {
      key: 'worker',
      header: t('workerStatus'),
      cell: (r) => <StatusBadge status={r.workerStatus} label={translateStatus(r.workerStatus)} />,
    },
    {
      key: 'checked',
      header: t('lastChecked'),
      cell: (r) => (r.lastChecked ? formatDate(r.lastChecked) : t('never')),
    },
    {
      key: 'enabled',
      header: t('enabled'),
      cell: (r) => (
        <button
          role="switch"
          aria-label={`${r.enabled ? t('disable') : t('enabled')} ${r.name}`}
          aria-checked={r.enabled}
          className={`switch ${r.enabled ? 'on' : ''}`}
          onClick={() => void toggle(r, !r.enabled)}
        >
          <span />
        </button>
      ),
    },
    {
      key: 'actions',
      header: t('common:actions.edit'),
      cell: (r) => (
        <div className="row-actions">
          <button
            className="table-action"
            onClick={() => void execute(() => accountService.openProfile(r.id), t('openProfile'))}
          >
            {t('openProfile')}
          </button>
          <button
            className="table-action"
            onClick={() => void execute(() => accountService.checkSession(r.id), t('checkSession'))}
          >
            {t('checkSession')}
          </button>
          <button className="table-action" onClick={() => void toggle(r, false)}>
            {t('disable')}
          </button>
          <button className="table-action danger-text" onClick={() => setDeleting(r)}>
            {t('remove')}
          </button>
        </div>
      ),
    },
  ];
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) return;
    try {
      await accountService.create({ displayName: displayName.trim(), provider, enabled });
      notify(t('created'));
      setModalOpen(false);
      setDisplayName('');
      await reload();
    } catch (e) {
      notify(message(e));
    }
  };
  return (
    <div className="page-stack">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <button className="button primary" onClick={() => setModalOpen(true)}>
            <UserPlus size={15} />
            {t('add')}
          </button>
        }
      />
      <div className="toolbar">
        <SearchInput
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterSelect
          label={t('loginStatus')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">{t('allStatuses')}</option>
          <option value="AUTHENTICATED">{translateStatus('AUTHENTICATED')}</option>
          <option value="LOGIN_REQUIRED">{translateStatus('LOGIN_REQUIRED')}</option>
          <option value="UNKNOWN">{translateStatus('UNKNOWN')}</option>
          <option value="ERROR">{translateStatus('ERROR')}</option>
        </FilterSelect>
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
            rowKey={(r) => r.id}
            empty={<EmptyState title={t('empty')} description={t('emptyDescription')} />}
          />
        </div>
      )}
      <Modal open={modalOpen} title={t('add')} onClose={() => setModalOpen(false)}>
        <form className="modal-form" onSubmit={submit}>
          <label>
            {t('displayName')}
            <input
              autoFocus
              required
              maxLength={160}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            {t('provider')}
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="dola">Dola</option>
              <option value="mock">Mock</option>
            </select>
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            {t('enabled')}
          </label>
          <p className="muted">{t('information')}</p>
          <div className="dialog-actions">
            <button type="button" className="button secondary" onClick={() => setModalOpen(false)}>
              {t('common:actions.cancel')}
            </button>
            <button className="button primary" disabled={!displayName.trim()}>
              {t('add')}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('removeTitle')}
        description={t('removeDescription')}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await execute(() => accountService.delete(deleting.id), t('removed'));
          setDeleting(null);
        }}
      />
    </div>
  );
};
