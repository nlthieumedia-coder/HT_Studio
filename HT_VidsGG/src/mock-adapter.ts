import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VidsAdapter, GenerationResult } from "./adapter.js";
import type { AccountStatus, AspectRatio, VidsCapabilities } from "./domain.js";

export class MockVidsAdapter implements VidsAdapter {
  async survey(): Promise<VidsCapabilities> { return { createDurations: [8, 10, 15, 20], extendDurations: [10], aspectRatios: ["9:16", "16:9"], extendMode: "additional", discoveredAt: new Date().toISOString() }; }
  async accountStatus(): Promise<AccountStatus> { return "VERIFIED_PRO"; }
  async create(_prompt: string, durationSeconds: number, _ratio: AspectRatio): Promise<GenerationResult> { return { id: crypto.randomUUID(), durationSeconds, durationKind: "segment" }; }
  async extend(_previousId: string, _prompt: string, durationSeconds: number): Promise<GenerationResult> { return { id: crypto.randomUUID(), durationSeconds, durationKind: "segment" }; }
  async export(resultId: string, outputDirectory: string): Promise<string> { await mkdir(outputDirectory, { recursive: true }); const path = join(outputDirectory, `${resultId}.mock.json`); await writeFile(path, JSON.stringify({ resultId, mock: true }, null, 2)); return path; }
}
