import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { PythonRuntimeError, type PythonRuntime } from '../src/main/services/PythonRuntime';
import { PythonWorkerBridge } from '../src/main/services/PythonWorkerBridge';

const fixture = resolve('tests/fixtures/mock-worker.cjs');
const bridges: PythonWorkerBridge[] = [];
const runtime = (mode: string): PythonRuntime => ({ executable: process.execPath, prefixArgs: [fixture, mode], source: 'python' });
const bridge = (mode: string, timeout = 500) => { const value = new PythonWorkerBridge('unused.py', async () => runtime(mode), timeout); bridges.push(value); return value; };
afterEach(() => bridges.splice(0).forEach(value => value.stop()));

describe('PythonWorkerBridge JSON Lines', () => {
  it('ping worker thành công và tách log stderr', async () => {
    const worker = bridge('normal'); let log = ''; worker.on('log', value => { log += value; });
    await expect(worker.request('ping')).resolves.toMatchObject({ status: 'ok', protocolVersion: 1 });
    await new Promise(resolve => setTimeout(resolve, 20)); expect(log).toContain('mock log');
  });
  it('báo thiếu Python bằng mã ổn định', async () => {
    const worker = new PythonWorkerBridge('unused.py', async () => { throw new PythonRuntimeError(); }); bridges.push(worker);
    await expect(worker.request('ping')).rejects.toMatchObject({ code: 'PYTHON_RUNTIME_MISSING' });
  });
  it('xử lý timeout và crash', async () => {
    await expect(bridge('timeout', 30).request('ping')).rejects.toMatchObject({ code: 'WORKER_TIMEOUT' });
    await expect(bridge('crash').request('ping')).rejects.toMatchObject({ code: 'WORKER_CRASH' });
  });
  it('từ chối JSONL response sai định dạng', async () => {
    await expect(bridge('invalid').request('ping')).rejects.toMatchObject({ code: 'INVALID_JSONL_RESPONSE' });
  });
  it('hủy tác vụ và đóng worker an toàn', async () => {
    const worker = bridge('timeout', 1000), controller = new AbortController();
    const request = worker.request('ping', '', {}, controller.signal); controller.abort();
    await expect(request).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
