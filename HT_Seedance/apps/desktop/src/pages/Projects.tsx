import React, { useCallback, useMemo, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { projectService } from '../api/services';
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
  ProgressBar,
  SearchInput,
  StatusBadge,
  type Column,
} from '../components/ui';
import type { ProjectListItem } from '../types/ui';

interface FormState {
  name: string;
  description: string;
  outputDirectory: string;
}

const emptyForm: FormState = { name: '', description: '', outputDirectory: '' };

export const ProjectsPage: React.FC = () => {
  const load = useCallback(() => projectService.list(), []);
  const { data, loading, error, reload } = useAsyncData(load);
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectListItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleting, setDeleting] = useState<ProjectListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const rows = useMemo(
    () =>
      (data ?? [])
        .filter(
          (item) =>
            (status === 'ALL' || item.status === status) &&
            `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'name' ? a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt),
        ),
    [data, search, status, sort],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = async (project: ProjectListItem) => {
    try {
      const detail = await projectService.getRaw(project.id);
      setEditing(project);
      setForm({
        name: detail.name,
        description: detail.description,
        outputDirectory: detail.outputDirectory ?? '',
      });
      setModalOpen(true);
    } catch {
      notify('Không thể tải thông tin dự án để chỉnh sửa.');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        outputDirectory: form.outputDirectory.trim() || null,
      };
      if (editing) await projectService.update(editing.id, payload);
      else await projectService.create(payload);
      notify(editing ? 'Đã cập nhật dự án.' : 'Đã tạo dự án mới.');
      setModalOpen(false);
      await reload();
    } catch {
      notify('Không thể lưu dự án. Hãy kiểm tra kết nối backend.');
    } finally {
      setSaving(false);
    }
  };

  const removeProject = async () => {
    if (!deleting || deletingBusy) return;
    setDeletingBusy(true);
    try {
      await projectService.delete(deleting.id, deleting.totalJobs > 0);
      notify('Đã xóa dự án. Các file đã xuất vẫn được giữ lại trên ổ đĩa.');
      setDeleting(null);
      await reload();
    } catch {
      notify('Không thể xóa dự án. Hãy dừng các tác vụ đang chạy rồi thử lại.');
    } finally {
      setDeletingBusy(false);
    }
  };

  const columns: Column<ProjectListItem>[] = [
    {
      key: 'project',
      header: 'Dự án',
      cell: (row) => <Link className="primary-link" to={`/projects/${row.id}`}>{row.name}</Link>,
      sortValue: (row) => row.name,
    },
    { key: 'description', header: 'Mô tả', cell: (row) => <span className="truncate-cell">{row.description}</span> },
    { key: 'jobs', header: 'Tổng job', cell: (row) => row.totalJobs, sortValue: (row) => row.totalJobs },
    { key: 'completed', header: 'Hoàn thành', cell: (row) => row.completedJobs },
    { key: 'failed', header: 'Thất bại', cell: (row) => row.failedJobs },
    { key: 'progress', header: 'Tiến độ', cell: (row) => <ProgressBar value={row.totalJobs ? Math.round((row.completedJobs / row.totalJobs) * 100) : 0} /> },
    { key: 'created', header: 'Ngày tạo', cell: (row) => new Date(row.createdAt).toLocaleDateString(), sortValue: (row) => row.createdAt },
    { key: 'status', header: 'Trạng thái', cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      cell: (row) => (
        <div className="row-actions">
          <Link className="table-action" to={`/projects/${row.id}`}>Mở</Link>
          <button className="table-action" onClick={() => void openEdit(row)}>Sửa</button>
          {row.status === 'ARCHIVED' ? (
            <button className="table-action" onClick={async () => { await projectService.restore(row.id); await reload(); }}>Khôi phục</button>
          ) : (
            <button className="table-action" onClick={async () => { await projectService.archive(row.id); await reload(); }}>Lưu trữ</button>
          )}
          <button className="table-action danger-text" onClick={() => setDeleting(row)}>Xóa</button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader title="Dự án" description="Quản lý các dự án sản xuất, phân cảnh và kết quả." actions={<button className="button primary" onClick={openCreate}><FolderPlus size={15} /> Dự án mới</button>} />
      <div className="toolbar">
        <SearchInput placeholder="Tìm kiếm dự án…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <FilterSelect label="Trạng thái dự án" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Tất cả trạng thái</option><option>ACTIVE</option><option>ARCHIVED</option></FilterSelect>
        <FilterSelect label="Sắp xếp dự án" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Mới nhất trước</option><option value="name">Tên A–Z</option></FilterSelect>
      </div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : <div className="section-card flush"><DataTable rows={rows} columns={columns} rowKey={(row) => row.id} selectable empty={<EmptyState title="Không tìm thấy dự án" description="Điều chỉnh bộ lọc hoặc tạo dự án mới để bắt đầu." />} /></div>}
      <Modal open={modalOpen} title={editing ? 'Sửa dự án' : 'Dự án mới'} onClose={() => setModalOpen(false)}>
        <form className="modal-form" onSubmit={submit}>
          <label>Tên dự án<input autoFocus maxLength={160} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Mô tả<textarea maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label>Thư mục xuất<input maxLength={1000} value={form.outputDirectory} onChange={(event) => setForm({ ...form, outputDirectory: event.target.value })} /></label>
          <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setModalOpen(false)}>Hủy</button><button className="button primary" disabled={saving || !form.name.trim()}>{saving ? 'Đang lưu…' : 'Lưu dự án'}</button></div>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Xóa dự án"
        description={deleting?.totalJobs ? `Xóa “${deleting.name}” cùng ${deleting.totalJobs} job và toàn bộ dữ liệu theo dõi? Các file video đã xuất trên ổ đĩa sẽ không bị xóa.` : `Xóa dự án “${deleting?.name ?? ''}”?`}
        onClose={() => setDeleting(null)}
        onConfirm={() => void removeProject()}
      />
    </div>
  );
};
