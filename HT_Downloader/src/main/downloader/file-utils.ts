import { access, copyFile, mkdir, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

export function sanitizeFilename(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/[. ]+$/g, '').trim();
  return (cleaned || 'video').slice(0, 150);
}
async function exists(file: string): Promise<boolean> { try { await access(file); return true; } catch { return false; } }

export async function moveWithoutOverwrite(source: string, outputDirectory: string, title: string): Promise<string> {
  const normDir = path.resolve(outputDirectory);
  try {
    await mkdir(normDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || !['EPERM', 'EEXIST'].includes(error.code as string)) {
      throw error;
    }
  }
  const extension = path.extname(source) || '.mp4'; const base = sanitizeFilename(title);
  let destination = path.join(normDir, `${base}${extension}`); let suffix = 2;
  while (await exists(destination)) destination = path.join(normDir, `${base} (${suffix++})${extension}`);
  try {
    await rename(source, destination);
  } catch {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    await unlink(source).catch(() => {});
  }
  return destination;
}
