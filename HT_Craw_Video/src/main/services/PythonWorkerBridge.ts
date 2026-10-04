import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { WorkerRequest, WorkerResponse } from '../../shared/types';
import { detectPythonRuntime, PythonRuntimeError, type PythonRuntime } from './PythonRuntime';

export type WorkerErrorCode = 'PYTHON_RUNTIME_MISSING'|'DEPENDENCY_MISSING'|'WORKER_TIMEOUT'|'WORKER_CRASH'|'INVALID_JSONL_RESPONSE'|'CANCELLED'|'WORKER_ERROR';
export class WorkerBridgeError extends Error {
  constructor(readonly code: WorkerErrorCode, message: string) { super(message); this.name = 'WorkerBridgeError'; }
}
type Pending = { resolve:(value:Record<string,unknown>)=>void; reject:(error:Error)=>void; timer:NodeJS.Timeout };

export class PythonWorkerBridge extends EventEmitter {
  private child?: ChildProcessWithoutNullStreams;
  private pending = new Map<string, Pending>();
  private buffer = '';
  constructor(private script:string, private runtimeResolver:()=>Promise<PythonRuntime> = () => detectPythonRuntime(), private timeoutMs = 180000) { super(); }

  async available() { try { await this.request('ping', '', {}, undefined, 5000); return true; } catch { return false; } }

  private async start() {
    if (this.child && !this.child.killed) return;
    const runtime = await this.runtimeResolver().catch(error => { throw error instanceof PythonRuntimeError ? error : new PythonRuntimeError(); });
    await new Promise<void>((resolve, reject) => {
      const child = spawn(runtime.executable, [...runtime.prefixArgs, '-u', this.script], { stdio:['pipe','pipe','pipe'], windowsHide:true, shell:false });
      this.child = child;
      const fail = () => { this.child = undefined; reject(new WorkerBridgeError('PYTHON_RUNTIME_MISSING', `Không thể khởi động Python: ${runtime.executable}`)); };
      child.once('error', fail);
      child.once('spawn', () => { child.off('error', fail); resolve(); });
      child.stdout.on('data', data => this.consume(String(data)));
      child.stderr.on('data', data => this.emit('log', String(data)));
      child.on('exit', code => this.handleExit(code));
    });
  }

  private handleExit(code:number|null) {
    if (!this.child) return;
    this.child = undefined;
    this.rejectAll(new WorkerBridgeError('WORKER_CRASH', `Tiến trình Python đã dừng bất thường (mã ${code ?? 'không xác định'})`));
  }
  private rejectAll(error:Error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear(); this.buffer = '';
  }
  private consume(data:string) {
    this.buffer += data;
    for (;;) {
      const newline = this.buffer.indexOf('\n'); if (newline < 0) break;
      const line = this.buffer.slice(0, newline).trim(); this.buffer = this.buffer.slice(newline + 1); if (!line) continue;
      let response: WorkerResponse;
      try { response = JSON.parse(line) as WorkerResponse; }
      catch { this.rejectAll(new WorkerBridgeError('INVALID_JSONL_RESPONSE', 'Worker trả về JSON Lines không hợp lệ')); continue; }
      const pending = this.pending.get(response.requestId); if (!pending) continue;
      clearTimeout(pending.timer); this.pending.delete(response.requestId);
      if (response.success) pending.resolve(response.data);
      else pending.reject(new WorkerBridgeError((response.error?.code as WorkerErrorCode) ?? 'WORKER_ERROR', response.error?.message ?? 'Worker trả về lỗi'));
    }
  }

  async request(operation:WorkerRequest['operation'], inputPath='', options:Record<string,unknown>={}, signal?:AbortSignal, timeoutMs=this.timeoutMs) {
    if (signal?.aborted) throw new WorkerBridgeError('CANCELLED', 'Tác vụ đã bị hủy');
    await this.start();
    if (signal?.aborted) { this.restart(new WorkerBridgeError('CANCELLED', 'Tác vụ đã bị hủy')); throw new WorkerBridgeError('CANCELLED', 'Tác vụ đã bị hủy'); }
    const requestId = randomUUID(), payload:WorkerRequest = { requestId, operation, inputPath, options };
    return new Promise<Record<string,unknown>>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new WorkerBridgeError('WORKER_TIMEOUT', `Worker quá thời gian chờ cho tác vụ ${operation}`)); this.restart(new WorkerBridgeError('WORKER_CRASH', 'Worker được khởi động lại sau khi quá thời gian chờ')); }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      signal?.addEventListener('abort', () => { clearTimeout(timer); this.pending.delete(requestId); reject(new WorkerBridgeError('CANCELLED', 'Tác vụ đã bị hủy')); this.restart(new WorkerBridgeError('CANCELLED', 'Worker được dừng để hủy tác vụ')); }, { once:true });
      this.child!.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }
  private restart(error?:Error) { if (error) this.rejectAll(error); const child = this.child; this.child = undefined; child?.kill(); }
  stop() { this.rejectAll(new WorkerBridgeError('CANCELLED', 'Ứng dụng đang đóng')); this.restart(); }
}
