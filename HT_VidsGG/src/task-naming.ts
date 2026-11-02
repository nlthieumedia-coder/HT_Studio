import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, extname, join } from "node:path";

export interface TaskNamingState {
  tasks: Array<{ taskIndex?: number; config?: { filename?: string } }>;
  videos: Array<{ outputPath?: string }>;
  taskCounter?: number;
}

export function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function generateRandomCode(length = 6): string {
  return randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

export function buildTaskFilename(taskIndex: number, dateStr?: string, randomCode?: string): string {
  const date = dateStr || formatDate();
  const rnd = randomCode || generateRandomCode(6);
  return `task-${taskIndex}-${date}_${rnd}.mp4`;
}

export function getNextTaskIndex(state: TaskNamingState): number {
  if (typeof state.taskCounter === "number" && state.taskCounter > 0) {
    state.taskCounter += 1;
    return state.taskCounter;
  }
  let maxX = 0;
  for (const t of state.tasks) {
    if (typeof t.taskIndex === "number") maxX = Math.max(maxX, t.taskIndex);
    const match = t.config?.filename?.match(/^task-(\d+)-/i);
    if (match && match[1]) maxX = Math.max(maxX, parseInt(match[1], 10));
  }
  for (const v of state.videos) {
    const match = v.outputPath?.match(/task-(\d+)-/i);
    if (match && match[1]) maxX = Math.max(maxX, parseInt(match[1], 10));
  }
  const next = Math.max(maxX, state.tasks.length, state.videos.length) + 1;
  state.taskCounter = next;
  return next;
}

export function ensureUniqueOutputFilename(outputDir: string | undefined, taskFilename: string, taskIndex: number): string {
  const ext = extname(taskFilename) || ".mp4";
  const nameWithoutExt = basename(taskFilename, ext);
  
  const match = nameWithoutExt.match(/^task-(\d+)-(\d{8})_([a-zA-Z0-9]+)$/i);
  const targetX = match && match[1] ? parseInt(match[1], 10) : taskIndex;
  const targetDate = match && match[2] ? match[2] : formatDate();
  
  const currentName = match ? `${nameWithoutExt}${ext}` : buildTaskFilename(targetX, targetDate);
  if (!outputDir) return currentName;

  try {
    const targetPath = join(outputDir, currentName);
    if (!existsSync(targetPath)) {
      return currentName;
    }

    // Nếu đã có file trùng tên trong thư mục: tự động thay đổi mã random để không bao giờ bị trùng tên video
    for (let i = 0; i < 100; i++) {
      const newRandom = generateRandomCode(6);
      const candidateName = `task-${targetX}-${targetDate}_${newRandom}${ext}`;
      if (!existsSync(join(outputDir, candidateName))) {
        return candidateName;
      }
    }
    return `task-${targetX}-${targetDate}_${randomUUID().slice(0, 8)}${ext}`;
  } catch {
    return currentName;
  }
}
