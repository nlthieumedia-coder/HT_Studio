import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { join } from 'node:path';
import { IPC, IPC_ALLOWLIST } from '../../shared/constants/ipc';
import { controlSchema, exportSchema, feedbackSchema, idSchema, searchSchema, settingsSchema } from '../../shared/schemas';
import type { Repositories } from '../database/repositories';
import type { DatasetService } from '../services/DatasetService';
import type { SearchJobService } from '../services/SearchJobService';
import type { SettingsService } from '../services/SettingsService';
import type { ExportService } from '../services/ExportService';
import type { FFmpegService } from '../services/FFmpegService';
import type { PythonWorkerBridge } from '../services/PythonWorkerBridge';
import { openExternal, openLocal } from '../security/ipcSecurity';
import { FacebookConnector } from '../connectors/FacebookConnector';
import { InstagramConnector } from '../connectors/InstagramConnector';

export function registerHandlers(ctx: { window: BrowserWindow; repo: Repositories; datasets: DatasetService; search: SearchJobService; settings: SettingsService; exports: ExportService; ffmpeg: FFmpegService; worker: PythonWorkerBridge; storageRoot: string }) {
  const handle = (name: string, fn: (...args: any[]) => any) => {
    if (!IPC_ALLOWLIST.has(name as typeof IPC[keyof typeof IPC])) throw new Error(`Kênh IPC không được phép: ${name}`);
    ipcMain.handle(name, (_event, ...args) => fn(...args));
  };
  ctx.search.on('progress', event => ctx.window.webContents.send(IPC.PROGRESS, event));
  handle(IPC.STATUS, async () => { const dashboard = await ctx.repo.dashboard(); return { ...dashboard, storageBytes: 0, ffmpeg: await ctx.ffmpeg.available() ? 'ready' : 'missing', python: await ctx.worker.available() ? 'ready' : 'missing', vectorIndex: 'fallback', connectors: [new FacebookConnector(), new InstagramConnector()].map(x => ({ name: x.name, status: x.status })) }; });
  handle(IPC.DATASETS_LIST, () => ctx.repo.listDatasets());
  handle(IPC.DATASETS_IMPORT_FOLDER, async () => { const result = await dialog.showOpenDialog(ctx.window, { title: 'Chọn thư mục video', buttonLabel: 'Nhập thư mục', properties: ['openDirectory'] }); return result.canceled ? null : ctx.datasets.import(result.filePaths[0], 'folder'); });
  handle(IPC.DATASETS_IMPORT_MANIFEST, async () => { const result = await dialog.showOpenDialog(ctx.window, { title: 'Chọn tệp danh sách kho dữ liệu', buttonLabel: 'Nhập dữ liệu', properties: ['openFile'], filters: [{ name: 'Danh sách kho dữ liệu', extensions: ['csv', 'json'] }] }); return result.canceled ? null : ctx.datasets.import(result.filePaths[0], 'manifest'); });
  handle(IPC.DATASETS_CONTROL, value => { const input = controlSchema.parse(value); return ctx.datasets.control(input.id, input.action); });
  handle(IPC.SEARCH_CHOOSE, async () => { const result = await dialog.showOpenDialog(ctx.window, { title: 'Chọn video mẫu', buttonLabel: 'Chọn video', properties: ['openFile'], filters: [{ name: 'Tệp video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] }] }); return result.canceled ? null : result.filePaths[0]; });
  handle(IPC.SEARCH_START, value => ctx.search.start(searchSchema.parse(value)));
  handle(IPC.SEARCH_LIST, () => ctx.repo.listJobs());
  handle(IPC.SEARCH_RESULTS, id => ctx.repo.results(idSchema.parse(id)).then(rows => rows.map(({ result, item }) => ({ ...result, evidence: JSON.parse(result.evidenceJson), item }))));
  handle(IPC.SEARCH_CANCEL, id => ctx.search.cancel(idSchema.parse(id)));
  handle(IPC.SEARCH_FEEDBACK, value => { const input = feedbackSchema.parse(value); return ctx.repo.feedback(input.resultId, input.value); });
  handle(IPC.SEARCH_EXPORT, async value => { const input = exportSchema.parse(value); const result = await dialog.showSaveDialog(ctx.window, { title: 'Xuất kết quả tìm kiếm', buttonLabel: 'Xuất tệp', defaultPath: join(ctx.storageRoot, `ket-qua-${input.jobId}.${input.format}`) }); return result.canceled || !result.filePath ? null : ctx.exports.export(input.jobId, result.filePath, input.format); });
  handle(IPC.SETTINGS_GET, () => ctx.settings.get());
  handle(IPC.SETTINGS_SAVE, value => ctx.settings.save(settingsSchema.parse(value)));
  handle(IPC.SYSTEM_OPEN_PATH, path => openLocal(String(path)));
  handle(IPC.SYSTEM_OPEN_URL, url => openExternal(String(url)));
}
