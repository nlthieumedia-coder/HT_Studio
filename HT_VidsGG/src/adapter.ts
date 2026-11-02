import type { AccountStatus, AspectRatio, VidsCapabilities } from "./domain.js";

export interface GenerationResult {
  id: string;
  durationSeconds: number;
  durationKind: "segment" | "cumulative";
}
export interface VidsAdapter {
  survey(): Promise<VidsCapabilities>;
  accountStatus(): Promise<AccountStatus>;
  create(prompt: string, durationSeconds: number, ratio: AspectRatio): Promise<GenerationResult>;
  extend(previousId: string, prompt: string, durationSeconds: number): Promise<GenerationResult>;
  export(resultId: string, outputDirectory: string): Promise<string>;
}
