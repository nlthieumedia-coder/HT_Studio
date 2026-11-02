import type { AspectRatio, ParsedPrompt } from "./domain.js";

const PREFIX = /^\s*(?:(\d{1,4})\s*(?:s|sec|secs|second|seconds|giây)\s*\|\s*)?(?:(9\s*:\s*16|16\s*:\s*9)\s*\|\s*)?/i;

export interface ParseDefaults {
  durationSeconds?: number;
  aspectRatio?: AspectRatio;
}

export function parsePromptLines(input: string, defaults: ParseDefaults): ParsedPrompt[] {
  return input.split(/\r?\n/).map((original, index) => ({ original, index }))
    .filter(({ original }) => original.trim().length > 0)
    .map(({ original, index }) => {
      const match = original.match(PREFIX)!;
      const explicitDuration = match[1] ? Number(match[1]) : undefined;
      const explicitRatio = match[2]?.replace(/\s/g, "") as AspectRatio | undefined;
      const durationSeconds = explicitDuration ?? defaults.durationSeconds;
      const aspectRatio = explicitRatio ?? defaults.aspectRatio;
      if (!durationSeconds) throw new Error(`Dòng ${index + 1}: thiếu thời lượng; dùng dạng \"20s | 9:16 | ...\" hoặc đặt mặc định.`);
      if (!aspectRatio) throw new Error(`Dòng ${index + 1}: thiếu tỷ lệ; dùng 9:16/16:9 hoặc đặt mặc định.`);
      if (durationSeconds < 1 || durationSeconds > 1800) throw new Error(`Dòng ${index + 1}: thời lượng ngoài phạm vi 1–1800 giây.`);
      const prompt = original.slice(match[0].length).trim();
      if (!prompt) throw new Error(`Dòng ${index + 1}: prompt rỗng.`);
      return { line: index + 1, original, prompt, durationSeconds, aspectRatio };
    });
}
