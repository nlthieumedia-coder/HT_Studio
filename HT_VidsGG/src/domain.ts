export type AspectRatio = "9:16" | "16:9";
export type AccountStatus =
  | "VERIFIED_PRO"
  | "VERIFIED_ULTRA"
  | "VERIFIED_INELIGIBLE"
  | "UNKNOWN_PLAN"
  | "LOGIN_REQUIRED"
  | "QUOTA_EXHAUSTED"
  | "FEATURE_UNAVAILABLE";

export type JobState =
  | "DRAFT" | "VALIDATED" | "WAITING_ACCOUNT" | "READY"
  | "GENERATING" | "EXTENDING" | "SAVING" | "EXPORTING"
  | "COMPLETED" | "PAUSED" | "BLOCKED" | "FAILED";

export interface ParsedPrompt {
  line: number;
  original: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
}

export interface VidsCapabilities {
  createDurations: number[];
  extendDurations: number[];
  aspectRatios: AspectRatio[];
  extendMode: "cumulative" | "additional" | "unknown";
  discoveredAt: string;
}

export interface SegmentPlan {
  kind: "create" | "extend";
  requestedSeconds: number;
  prompt?: string;
}

export interface Job {
  id: string;
  line: number;
  originalPrompt: string;
  prompt: string;
  targetDurationSeconds: number;
  aspectRatio: AspectRatio;
  profile: string;
  state: JobState;
  plan: SegmentPlan[];
  achievedDurationSeconds: number;
  projectUrl?: string;
  outputPath?: string;
  error?: string;
  updatedAt: string;
}
