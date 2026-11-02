import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import type { LicenseActivationResult, LicenseStatus } from '../../shared/types';

const LICENSE_SALT = 'HT_DOWNLOADER_KEY_SALT_2026_V1';

export interface LicenseRecord { key: string; hwid: string; activatedAt: string; type: string }

export class LicenseService {
  private readonly licenseFile: string;

  constructor(userDataDirectory: string) {
    this.licenseFile = path.join(userDataDirectory, 'license.secure.json');
  }

  async check(): Promise<LicenseStatus> {
    const hwid = getMachineId();
    try {
      const record = await this.readRecord();
      if (!record?.key) return { licensed: false, hwid };
      if (record.hwid !== hwid) return { licensed: false, hwid, error: 'Mã bản quyền được kích hoạt cho một thiết bị khác.' };
      const result = await requestLicenseServer('check', record.key, hwid, 6000);
      if (!result.ok) return { licensed: false, hwid, error: result.error ?? 'Bản quyền không hợp lệ.' };
      return { licensed: true, hwid, key: record.key, activatedAt: record.activatedAt, type: record.type || 'LIFETIME', online: true };
    } catch (error) {
      return { licensed: false, hwid, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async activate(inputKey: string): Promise<LicenseActivationResult> {
    const hwid = getMachineId();
    const key = inputKey.trim().toUpperCase();
    const local = verifyLicenseKey(key, hwid);
    if (!local.valid) return { ok: false, hwid, error: local.error };
    const result = await requestLicenseServer('activate', key, hwid, 8000);
    if (!result.ok) return { ok: false, hwid, error: result.error ?? 'Không thể kích hoạt mã bản quyền.' };
    const record: LicenseRecord = { key, hwid, activatedAt: new Date().toISOString(), type: result.type ?? 'LIFETIME' };
    await this.writeRecord(record);
    return { ok: true, hwid, type: record.type };
  }

  async deactivate(): Promise<boolean> {
    await rm(this.licenseFile, { force: true });
    return true;
  }

  private async readRecord(): Promise<LicenseRecord | null> {
    try {
      if (!existsSync(this.licenseFile)) return null;
      const value = await readFile(this.licenseFile, 'utf8');
      const json = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(value, 'base64'))
        : value;
      return JSON.parse(json) as LicenseRecord;
    } catch {
      return null;
    }
  }

  private async writeRecord(record: LicenseRecord): Promise<void> {
    await mkdir(path.dirname(this.licenseFile), { recursive: true });
    const json = JSON.stringify(record);
    const value = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(json).toString('base64')
      : json;
    await writeFile(this.licenseFile, value, 'utf8');
  }
}

export function getMachineId(): string {
  let rawGuid = '';
  if (process.platform === 'win32') {
    try {
      const output = execFileSync('reg.exe', ['query', 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      rawGuid = output.match(/MachineGuid\s+REG_SZ\s+([a-f0-9-]+)/i)?.[1]?.trim() ?? '';
    } catch { /* Use the stable host fallback below. */ }
  }
  if (!rawGuid) rawGuid = `${os.userInfo().username}#${os.hostname()}#${os.arch()}`;
  const hash = createHash('sha256').update(rawGuid + LICENSE_SALT).digest('hex').toUpperCase();
  return `HTD-${hash.slice(0, 4)}-${hash.slice(4, 8)}`;
}

export function verifyLicenseKey(key: string, hwid: string): { valid: boolean; error?: string } {
  if (!/^HTDOWN-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(key)) {
    return { valid: false, error: 'Định dạng mã key không đúng (HTDOWN-XXXX-XXXX-XXXX-XXXX).' };
  }
  const [p1, p2, p3, p4] = key.slice('HTDOWN-'.length).split('-');
  const seed = p1 + p2;
  const signature = p3 + p4;
  const expected = createHmac('sha256', LICENSE_SALT).update(seed).digest('hex').toUpperCase().slice(0, 8);
  if (signature !== expected) return { valid: false, error: 'Mã bản quyền không đúng hoặc đã bị chỉnh sửa.' };
  const machineSeed = hwid.replace(/^HTD-/i, '').replace(/[^A-Z0-9]/g, '').toUpperCase().padEnd(8, '0').slice(0, 8);
  return seed === machineSeed ? { valid: true } : { valid: false, error: 'Mã bản quyền không dành cho thiết bị này.' };
}

export function generateMachineLicenseKey(hwid: string): string {
  const seed = hwid.replace(/^HTD-/i, '').replace(/[^A-Z0-9]/g, '').toUpperCase().padEnd(8, '0').slice(0, 8);
  const signature = createHmac('sha256', LICENSE_SALT).update(seed).digest('hex').toUpperCase().slice(0, 8);
  return `HTDOWN-${seed.slice(0, 4)}-${seed.slice(4, 8)}-${signature.slice(0, 4)}-${signature.slice(4, 8)}`;
}

async function requestLicenseServer(action: 'check' | 'activate', key: string, hwid: string, timeoutMs: number): Promise<{ ok: boolean; type?: string; error?: string }> {
  const serverUrl = getLicenseServerUrl();
  if (!serverUrl) return { ok: false, error: 'HT Downloader chưa được cấu hình máy chủ bản quyền riêng.' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(serverUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('key', key);
    url.searchParams.set('hwid', hwid);
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { valid?: boolean; success?: boolean; type?: string; error?: string };
    const ok = action === 'check' ? body.valid !== false && body.success !== false : body.success === true;
    return ok ? { ok: true, type: body.type ?? 'LIFETIME' } : { ok: false, error: body.error ?? 'Máy chủ từ chối mã bản quyền.' };
  } catch {
    return { ok: false, error: 'Không thể kết nối máy chủ bản quyền. Hãy kiểm tra Internet rồi thử lại.' };
  } finally {
    clearTimeout(timeout);
  }
}

function getLicenseServerUrl(): string {
  const environmentUrl = process.env.HT_DOWNLOADER_LICENSE_API_URL?.trim();
  if (environmentUrl) return environmentUrl;
  const candidates = [
    path.join(process.resourcesPath ?? '', 'license-config.json'),
    path.join(process.cwd(), 'resources', 'license-config.json'),
    path.join(__dirname, 'license-config.json')
  ];
  for (const candidate of candidates) {
    try {
      if (!candidate || !existsSync(candidate)) continue;
      const config = JSON.parse(readFileSync(candidate, 'utf8')) as { licenseServerUrl?: string };
      if (config.licenseServerUrl?.trim()) return config.licenseServerUrl.trim();
    } catch { /* Try the next Downloader-specific config location. */ }
  }
  return '';
}
