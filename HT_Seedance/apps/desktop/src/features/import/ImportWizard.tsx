import React, { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { importService } from '../../api/services';
import { Modal, StatusBadge } from '../../components/ui';
type Session = {
  id: string;
  detectedColumns: string[];
  mapping: Record<string, string>;
  rows: Array<{ row: number; sceneNumber: number; prompt: string; status: string }>;
  issues: Array<{ row: number; code: string; message: string; severity: string }>;
  sheets?: Array<{ name: string; rows: number; columns: string[] }>;
};
export const ImportWizard: React.FC<{
  projectId: string;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}> = ({ projectId, open, onClose, onComplete }) => {
  const [step, setStep] = useState(1),
    [sourceType, setSourceType] = useState('CSV'),
    [sourcePath, setSourcePath] = useState(''),
    [mode, setMode] = useState('STRICT'),
    [session, setSession] = useState<Session | null>(null),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{
      imported: number;
      skipped: number;
      warnings: number;
      errors: number;
      total: number;
    } | null>(null),
    [error, setError] = useState('');
  const analyze = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await importService.analyze(projectId, {
        sourceType,
        sourcePath,
        mode,
        sceneMode: 'APPEND_AFTER_EXISTING',
        textMode: 'LINE',
      });
      setSession(response.data);
      setStep(2);
    } catch {
      setError('Không thể phân tích nguồn. Kiểm tra đường dẫn, định dạng và quyền truy cập.');
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const response = await importService.commit(projectId, session.id);
      setResult(response.data);
      setStep(7);
      onComplete();
    } catch {
      setError('Không thể import: chế độ Strict sẽ chặn khi có lỗi.');
    } finally {
      setBusy(false);
    }
  };
  const errors = session?.issues.filter((item) => item.severity === 'ERROR').length ?? 0;
  return (
    <Modal open={open} title={`Batch Import · Bước ${step}/7`} onClose={onClose}>
      <div className="import-steps">
        {['Nguồn', 'Phân tích', 'Mapping', 'Preview', 'Validation', 'Import', 'Kết quả'].map(
          (label, index) => (
            <span key={label} className={index + 1 <= step ? 'active' : ''}>
              {index + 1}. {label}
            </span>
          ),
        )}
      </div>
      {error && <p className="inline-warning">{error}</p>}
      {step === 1 && (
        <div className="modal-form">
          <label>
            Nguồn
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
              <option>CSV</option>
              <option>XLSX</option>
              <option>TXT</option>
              <option>FOLDER</option>
            </select>
          </label>
          <label>
            Đường dẫn local
            <input
              value={sourcePath}
              onChange={(event) => setSourcePath(event.target.value)}
              placeholder="D:\\Project\\import.csv hoặc thư mục media"
            />
          </label>
          <label>
            Chế độ import
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="STRICT">Strict — dừng khi có lỗi</option>
              <option value="LENIENT">Lenient — bỏ qua dòng lỗi</option>
            </select>
          </label>
          <button
            className="button primary"
            disabled={!sourcePath || busy}
            onClick={() => void analyze()}
          >
            <Upload size={14} /> Phân tích
          </button>
        </div>
      )}
      {step >= 2 && step < 7 && session && (
        <div className="modal-form">
          <p className="muted">
            {session.rows.length} dòng đã phát hiện · {errors} lỗi ·{' '}
            {session.issues.length - errors} cảnh báo
          </p>
          {step === 2 && (
            <>
              <p>Columns: {session.detectedColumns.join(', ') || 'Không có cột'}</p>
              {session.sheets && (
                <p>
                  Sheets:{' '}
                  {session.sheets.map((sheet) => `${sheet.name} (${sheet.rows})`).join(', ')}
                </p>
              )}
            </>
          )}
          {step === 3 && (
            <div className="import-list">
              {Object.entries(session.mapping).map(([source, target]) => (
                <div key={source}>
                  <span>{source}</span>
                  <strong>{target}</strong>
                </div>
              ))}
            </div>
          )}
          {step === 4 && (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Scene</th>
                    <th>Prompt</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {session.rows.slice(0, 100).map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>{row.sceneNumber}</td>
                      <td className="truncate-cell">{row.prompt}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {step === 5 && (
            <div className="import-list">
              {session.issues.slice(0, 100).map((issue, index) => (
                <div key={`${issue.row}-${index}`}>
                  <strong>
                    Row {issue.row} · {issue.code}
                  </strong>
                  <span>{issue.message}</span>
                </div>
              ))}
              {!session.issues.length && <p>Không có lỗi hoặc cảnh báo.</p>}
            </div>
          )}
          {step === 6 && (
            <p>
              {mode === 'STRICT' && errors
                ? 'Không thể xác nhận ở Strict mode khi còn lỗi.'
                : 'Sẵn sàng tạo jobs trong một transaction.'}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 2}
            >
              <ChevronLeft size={14} /> Quay lại
            </button>
            {step < 6 ? (
              <button className="button primary" onClick={() => setStep(step + 1)}>
                <ChevronRight size={14} /> Tiếp
              </button>
            ) : (
              <button
                className="button primary"
                disabled={busy || (mode === 'STRICT' && errors > 0)}
                onClick={() => void commit()}
              >
                <Check size={14} /> Xác nhận import
              </button>
            )}
          </div>
        </div>
      )}
      {step === 7 && result && (
        <div className="modal-form">
          <h3>Import Complete</h3>
          <p>
            Tổng: {result.total} · Imported: {result.imported} · Skipped: {result.skipped}
          </p>
          <p>
            Cảnh báo: {result.warnings} · Lỗi: {result.errors}
          </p>
          <button className="button primary" onClick={onClose}>
            Xem Project
          </button>
        </div>
      )}
    </Modal>
  );
};
