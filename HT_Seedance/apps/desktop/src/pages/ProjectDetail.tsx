import React, { useCallback, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  FilePlus2,
  ListRestart,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  DEFAULT_PROJECT_SETTINGS,
  JobState,
  VIDEO_ASPECT_RATIOS,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
  formatSceneNumber,
} from '@ht-dola/shared';
import {
  jobService,
  projectService,
  importService,
  productionRunService,
  type ApiJob,
  type ApiProject,
} from '../api/services';
import { ImportWizard } from '../features/import/ImportWizard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../components/Toast';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterSelect,
  FormField,
  LoadingState,
  Modal,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '../components/ui';

type JobForm = {
  prompt: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
  image: string;
  video: string;
  audio: string;
};
const emptyForm = (project: ApiProject): JobForm => ({
  prompt: '',
  durationSeconds: project.defaultDurationSeconds ?? DEFAULT_PROJECT_SETTINGS.durationSeconds,
  aspectRatio: project.defaultAspectRatio ?? DEFAULT_PROJECT_SETTINGS.aspectRatio,
  resolution: project.defaultResolution ?? DEFAULT_PROJECT_SETTINGS.resolution,
  image: '',
  video: '',
  audio: '',
});
export const ProjectDetailPage: React.FC = () => {
  const { projectId = '' } = useParams(),
    { notify } = useToast();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [editing, setEditing] = useState<ApiJob | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [deleteIds, setDeleteIds] = useState<string[] | null>(null),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState<JobForm | null>(null);
  const load = useCallback(
    async () => ({
      project: await projectService.getRaw(projectId),
      jobs: await jobService.listRaw(projectId),
    }),
    [projectId],
  );
  const { data, loading, error, reload } = useAsyncData(load);
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      notify(message);
      setSelected([]);
      await reload();
    } catch {
      notify('Thao tác không thành công. Hãy kiểm tra trạng thái job.');
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <LoadingState />;
  if (error || !data)
    return <ErrorState message="Không thể tải workspace dự án." onRetry={reload} />;
  const { project, jobs } = data;
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(project));
    setModal('create');
  };
  const openEdit = (job: ApiJob) => {
    setEditing(job);
    setForm({
      prompt: job.prompt,
      durationSeconds: job.durationSeconds,
      aspectRatio: job.aspectRatio,
      resolution: job.resolution,
      image: job.inputMedia.image ?? '',
      video: job.inputMedia.video ?? '',
      audio: job.inputMedia.audio ?? '',
    });
    setModal('edit');
  };
  const save = () => {
    if (!form) return;
    const input = {
      prompt: form.prompt,
      durationSeconds: Number(form.durationSeconds),
      aspectRatio: form.aspectRatio,
      resolution: form.resolution,
      inputMedia: {
        ...(form.image ? { image: form.image } : {}),
        ...(form.video ? { video: form.video } : {}),
        ...(form.audio ? { audio: form.audio } : {}),
      },
    };
    if (!form.prompt.trim()) {
      notify('Prompt là bắt buộc.');
      return;
    }
    void run(
      () =>
        modal === 'create'
          ? jobService.create({
              projectId: project.id,
              sceneNumber: Math.max(0, ...jobs.map((j) => j.sceneNumber)) + 1,
              provider: project.defaultProvider,
              ...input,
              status: JobState.DRAFT,
              priority: 0,
              maxAttempts: 3,
            })
          : jobService.update(editing!.id, input),
      modal === 'create' ? 'Đã thêm scene ở trạng thái Draft.' : 'Đã cập nhật scene.',
    ).then(() => setModal(null));
  };
  const selectable = jobs.filter((job) =>
    [JobState.DRAFT, JobState.CANCELLED, JobState.FAILED, JobState.QUEUED].includes(job.status),
  );
  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  return (
    <div className="page-stack">
      <Link to="/projects" className="back-link">
        <ArrowLeft size={14} /> Quay lại dự án
      </Link>
      <PageHeader
        title={project.name}
        description={project.description || 'Workspace scenes và hàng đợi cục bộ'}
        actions={
          <div className="row-actions">
            <StatusBadge status={project.status} />
            <button className="button primary" onClick={openCreate}>
              <Plus size={14} /> Thêm scene
            </button>
          </div>
        }
      />
      <div className="stats-grid compact">
        <StatCard icon={<span>Σ</span>} label="Tổng scene" value={project.totalJobs} />
        <StatCard
          icon={<span>◷</span>}
          label="Draft / Queued"
          value={`${project.draftJobs} / ${project.queuedJobs}`}
          tone="warning"
        />
        <StatCard icon={<span>▶</span>} label="Đang chạy" value={project.runningJobs} />
        <StatCard
          icon={<span>✓</span>}
          label="Hoàn tất / Lỗi"
          value={`${project.completedJobs} / ${project.failedJobs}`}
          tone={project.failedJobs ? 'danger' : 'success'}
        />
      </div>
      <SectionCard
        title="Jobs / Scenes"
        description="Dữ liệu lưu SQLite; hàng đợi chỉ thay đổi trạng thái, chưa khởi chạy automation."
      >
        <div className="toolbar wrap">
          <button className="button primary" onClick={() => setImportOpen(true)}>
            <Upload size={14} /> Import Scenes
          </button>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                const csv = await importService.exportCsv(project.id);
                const link = document.createElement('a');
                link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
                link.download = 'jobs.csv';
                link.click();
                URL.revokeObjectURL(link.href);
                notify('CSV exported.');
              } catch {
                notify('CSV export failed.');
              }
            }}
          >
            Export CSV
          </button>
          <button
            className="button secondary"
            onClick={() =>
              void run(() => jobService.renumber(project.id), 'Đã đánh số lại scenes.')
            }
            disabled={busy}
          >
            <ListRestart size={14} /> Đánh số lại
          </button>
          {selected.length > 0 && (
            <>
              <strong className="muted">Đã chọn {selected.length}</strong>
              <button className="button primary" disabled={busy} onClick={()=>void run(async()=>{const eligible=jobs.filter(j=>selected.includes(j.id)&&[JobState.QUEUED,JobState.FAILED].includes(j.status));await productionRunService.create({projectId:project.id,provider:project.defaultProvider,jobIds:eligible.map(j=>j.id),workerCount:1,pilot:{enabled:true,maxBatchSize:10,maxWorkers:1,maxActiveJobs:1}});},'Production Run đã tạo. Mở Production Runs để chạy preflight.')}>Start Production</button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => jobService.bulkQueue(selected),
                    'Đã đưa các scene hợp lệ vào queue.',
                  )
                }
              >
                <Play size={14} /> Queue
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => jobService.bulkUnqueue(selected),
                    'Đã đưa các scene hợp lệ về Draft.',
                  )
                }
              >
                Bỏ queue
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void run(() => jobService.bulkDuplicate(selected), 'Đã nhân bản scenes.')
                }
              >
                <Copy size={14} /> Nhân bản
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => setDeleteIds(selected)}
              >
                <Trash2 size={14} /> Xóa
              </button>
            </>
          )}
        </div>
        {jobs.length === 0 ? (
          <EmptyState
            title="Chưa có scene"
            description="Thêm scene đầu tiên để bắt đầu chuẩn bị hàng đợi."
            action={
              <button className="button primary" onClick={openCreate}>
                Thêm scene
              </button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="Chọn tất cả"
                      type="checkbox"
                      checked={
                        selectable.length > 0 &&
                        selectable.every((job) => selected.includes(job.id))
                      }
                      onChange={(e) =>
                        setSelected(e.target.checked ? selectable.map((job) => job.id) : [])
                      }
                    />
                  </th>
                  <th>Scene</th>
                  <th>Prompt</th>
                  <th>Media</th>
                  <th>Thiết lập</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <input
                        aria-label={`Chọn ${formatSceneNumber(job.sceneNumber)}`}
                        type="checkbox"
                        disabled={!selectable.some((item) => item.id === job.id)}
                        checked={selected.includes(job.id)}
                        onChange={() => toggle(job.id)}
                      />
                    </td>
                    <td className="mono accent">{formatSceneNumber(job.sceneNumber)}</td>
                    <td>
                      <span className="truncate-cell wide" title={job.prompt}>
                        {job.prompt}
                      </span>
                    </td>
                    <td className="muted">
                      {job.inputMedia.image || job.inputMedia.video || job.inputMedia.audio
                        ? 'Đã đính kèm'
                        : '—'}
                    </td>
                    <td>
                      {job.durationSeconds}s · {job.aspectRatio} · {job.resolution}
                    </td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action"
                          onClick={() => openEdit(job)}
                          disabled={!selectable.some((item) => item.id === job.id)}
                        >
                          Sửa
                        </button>
                        <button
                          className="table-action"
                          onClick={() =>
                            void run(() => jobService.duplicate(job.id), 'Đã nhân bản scene.')
                          }
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          className="table-action"
                          onClick={() =>
                            void run(() => jobService.reorder(job.id, 'up'), 'Đã di chuyển scene.')
                          }
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          className="table-action"
                          onClick={() =>
                            void run(
                              () => jobService.reorder(job.id, 'down'),
                              'Đã di chuyển scene.',
                            )
                          }
                        >
                          <ArrowDown size={13} />
                        </button>
                        {job.status === JobState.DRAFT || job.status === JobState.FAILED ? (
                          <button
                            className="table-action"
                            onClick={() =>
                              void run(() => jobService.queue(job.id), 'Đã queue scene.')
                            }
                          >
                            <Play size={13} />
                          </button>
                        ) : job.status === JobState.QUEUED ? (
                          <button
                            className="table-action"
                            onClick={() =>
                              void run(() => jobService.unqueue(job.id), 'Đã bỏ queue scene.')
                            }
                          >
                            Bỏ queue
                          </button>
                        ) : null}
                        <button
                          className="table-action danger-text"
                          disabled={!selectable.some((item) => item.id === job.id)}
                          onClick={() => setDeleteIds([job.id])}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <Modal
        open={modal !== null}
        title={modal === 'create' ? 'Thêm scene' : 'Chỉnh sửa scene'}
        onClose={() => setModal(null)}
      >
        {form && (
          <div className="modal-form">
            <FormField label="Prompt">
              <textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              />
            </FormField>
            <div className="form-grid">
              <FormField label="Duration">
                <FilterSelect
                  label="Duration"
                  value={form.durationSeconds}
                  onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })}
                >
                  {VIDEO_DURATIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </FilterSelect>
              </FormField>
              <FormField label="Aspect ratio">
                <FilterSelect
                  label="Aspect ratio"
                  value={form.aspectRatio}
                  onChange={(e) => setForm({ ...form, aspectRatio: e.target.value })}
                >
                  {VIDEO_ASPECT_RATIOS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </FilterSelect>
              </FormField>
              <FormField label="Resolution">
                <FilterSelect
                  label="Resolution"
                  value={form.resolution}
                  onChange={(e) => setForm({ ...form, resolution: e.target.value })}
                >
                  {VIDEO_RESOLUTIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </FilterSelect>
              </FormField>
            </div>
            <FormField label="Image path (optional)">
              <input
                value={form.image}
                accept="image/*"
                onChange={(e) => setForm({ ...form, image: e.target.value })}
              />
            </FormField>
            <FormField label="Video path (optional)">
              <input
                value={form.video}
                accept="video/*"
                onChange={(e) => setForm({ ...form, video: e.target.value })}
              />
            </FormField>
            <FormField label="Audio path (optional)">
              <input
                value={form.audio}
                accept="audio/*"
                onChange={(e) => setForm({ ...form, audio: e.target.value })}
              />
            </FormField>
            <div className="dialog-actions">
              <button className="button secondary" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button className="button primary" disabled={busy} onClick={save}>
                <FilePlus2 size={14} /> Lưu
              </button>
            </div>
          </div>
        )}
      </Modal>
      <ImportWizard
        projectId={project.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => void reload()}
      />
      <ConfirmDialog
        open={deleteIds !== null}
        title="Xóa scene"
        description="Chỉ các scene Draft, Cancelled hoặc Failed không có output mới được xóa."
        onClose={() => setDeleteIds(null)}
        onConfirm={() => {
          if (deleteIds)
            void run(
              () =>
                deleteIds.length === 1
                  ? jobService.delete(deleteIds[0]!)
                  : jobService.bulkDelete(deleteIds),
              'Đã xóa scene.',
            ).then(() => setDeleteIds(null));
        }}
      />
    </div>
  );
};
