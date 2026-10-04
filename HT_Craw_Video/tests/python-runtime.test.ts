import { describe, expect, it } from 'vitest';
import { detectPythonRuntime, PythonRuntimeError } from '../src/main/services/PythonRuntime';

describe('phát hiện Python runtime', () => {
  it('ưu tiên HT_PYTHON_BIN, sau đó py -3, python và python3', async () => {
    const calls: string[] = [];
    const runtime = await detectPythonRuntime({ HT_PYTHON_BIN: 'C:\\Python310\\python.exe' }, 'win32', async (executable, args) => {
      calls.push(`${executable} ${args.join(' ')}`); return executable === 'python';
    });
    expect(calls.map(value => value.split(' -c')[0])).toEqual(['C:\\Python310\\python.exe', expect.stringContaining('.venv'), 'py -3', 'python']);
    expect(runtime.source).toBe('python');
  });

  it('trả mã PYTHON_RUNTIME_MISSING khi không có runtime', async () => {
    await expect(detectPythonRuntime({}, 'win32', async () => false)).rejects.toMatchObject({ code: 'PYTHON_RUNTIME_MISSING' });
    await expect(detectPythonRuntime({}, 'linux', async () => false)).rejects.toBeInstanceOf(PythonRuntimeError);
  });
});
