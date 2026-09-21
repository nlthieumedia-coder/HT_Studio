import React, { useCallback, useEffect, useState } from 'react';
import { backupService, type BackupRecord } from '../api/services';
import { FormField, SectionCard } from './ui';
import { useToast } from './Toast';

const formatBytes = (size: number) => `${(size / 1024 / 1024).toFixed(1)} MB`;

export const BackupRecovery: React.FC = () => {
  const { notify } = useToast();
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [destination, setDestination] = useState('');
  const [restorePath, setRestorePath] = useState('');
  const [includeProfiles, setIncludeProfiles] = useState(false);
  const [includeOutputs, setIncludeOutputs] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [automatic, setAutomatic] = useState({
    enabled: false,
    destination: '',
    frequency: 'DAILY',
    localTime: '02:00',
    retention: 5,
  });
  const reload = useCallback(
    () =>
      backupService
        .list()
        .then(setHistory)
        .catch(() => setHistory([])),
    [],
  );
  useEffect(() => {
    void reload();
    backupService
      .getSettings()
      .then((value) => {
        setAutomatic(value);
        setDestination(value.destination);
      })
      .catch(() => undefined);
  }, [reload]);
  const create = async () => {
    if (!destination) return notify('Chọn thư mục đích trước khi tạo backup.');
    setBusy(true);
    try {
      const result = await backupService.create({
        destination,
        type: includeProfiles || includeOutputs || includeLogs ? 'FULL' : 'DATA',
        includeProfiles,
        includeOutputs,
        includeLogs,
      });
      notify(`Backup đã hoàn tất: ${result.path}`);
      await reload();
    } catch {
      notify('Không thể tạo backup. Kiểm tra dung lượng, quyền ghi và trạng thái profile.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <SectionCard title="Backup & Recovery">
      <div className="form-grid">
        <FormField label="Backup location">
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="D:\\HTDS Backups"
          />
        </FormField>
        <label className="setting-toggle">
          <span>Include Browser Profiles</span>
          <input
            type="checkbox"
            checked={includeProfiles}
            onChange={(e) => setIncludeProfiles(e.target.checked)}
          />
        </label>
        <label className="setting-toggle">
          <span>Include Generated Outputs</span>
          <input
            type="checkbox"
            checked={includeOutputs}
            onChange={(e) => setIncludeOutputs(e.target.checked)}
          />
        </label>
        <label className="setting-toggle">
          <span>Include Logs</span>
          <input
            type="checkbox"
            checked={includeLogs}
            onChange={(e) => setIncludeLogs(e.target.checked)}
          />
        </label>
        {includeProfiles && (
          <p className="inline-warning">
            Backup này có thể chứa phiên đăng nhập trình duyệt đang hoạt động. Hãy lưu trữ an toàn.
          </p>
        )}
        <button className="button primary" disabled={busy} onClick={create}>
          {busy ? 'Preparing / Snapshot / Verifying…' : 'Create Backup'}
        </button>
        <hr />
        <label className="setting-toggle">
          <span>Enable automatic backup</span>
          <input
            type="checkbox"
            checked={automatic.enabled}
            onChange={(e) => setAutomatic({ ...automatic, enabled: e.target.checked })}
          />
        </label>
        <FormField label="Frequency">
          <select
            value={automatic.frequency}
            onChange={(e) => setAutomatic({ ...automatic, frequency: e.target.value })}
          >
            <option value="DAILY">Daily</option>
            <option value="EVERY_3_DAYS">Every 3 Days</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </FormField>
        <FormField label="Backup time">
          <input
            type="time"
            value={automatic.localTime}
            onChange={(e) => setAutomatic({ ...automatic, localTime: e.target.value })}
          />
        </FormField>
        <FormField label="Retention">
          <select
            value={automatic.retention}
            onChange={(e) => setAutomatic({ ...automatic, retention: Number(e.target.value) })}
          >
            {[3, 5, 7, 10, 20].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </FormField>
        <button
          className="button secondary"
          onClick={async () => {
            await backupService.saveSettings({ ...automatic, destination });
            notify('Đã lưu lịch backup tự động.');
          }}
        >
          Save Automatic Backup
        </button>
        <hr />
        <FormField label="Restore backup path">
          <input
            value={restorePath}
            onChange={(e) => setRestorePath(e.target.value)}
            placeholder="…htbackup"
          />
        </FormField>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              setPreview(await backupService.preview(restorePath));
            } catch {
              notify('Backup không hợp lệ hoặc không tương thích.');
            }
          }}
        >
          Verify & Preview Restore
        </button>
        {preview && <pre>{JSON.stringify(preview, null, 2)}</pre>}
        {preview && (
          <button
            className="button primary"
            onClick={async () => {
              if (
                !confirm(
                  'Dữ liệu hiện tại sẽ được thay bằng backup đã chọn. Một safety backup sẽ được tạo trước. Tiếp tục?',
                )
              )
                return;
              await backupService.restore(restorePath, destination);
              notify(
                'Đã lên lịch restore. Hãy khởi động lại ứng dụng để chạy maintenance restore.',
              );
            }}
          >
            Confirm Restore
          </button>
        )}
        <button
          className="button secondary"
          onClick={async () => notify(JSON.stringify(await backupService.integrity()))}
        >
          Run Full Integrity Check
        </button>
      </div>
      <h3>Backup History</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Version</th>
              <th>Size</th>
              <th>Status</th>
              <th>Verified</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
                <td>{item.backupType}</td>
                <td>{item.appVersion}</td>
                <td>{formatBytes(item.size)}</td>
                <td>{item.status}</td>
                <td>{item.verifiedAt ? 'Yes' : 'No'}</td>
                <td>{item.filePath}</td>
                <td>
                  <button
                    onClick={async () =>
                      notify(
                        (await backupService.verify(item.filePath)).valid
                          ? 'Backup hợp lệ.'
                          : 'Backup hỏng.',
                      )
                    }
                  >
                    Verify
                  </button>
                  <button onClick={() => setRestorePath(item.filePath)}>Restore</button>
                  <button
                    onClick={async () => {
                      if (confirm('Xóa backup này?')) {
                        await backupService.remove(item.id);
                        await reload();
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};
