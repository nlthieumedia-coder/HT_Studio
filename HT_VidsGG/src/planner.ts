import type { ParsedPrompt, SegmentPlan, VidsCapabilities } from "./domain.js";

export class PlanningBlockedError extends Error {}

export function planSegments(job: ParsedPrompt, capabilities: VidsCapabilities): SegmentPlan[] {
  if (!capabilities.aspectRatios.includes(job.aspectRatio)) {
    throw new PlanningBlockedError(`UI hiện tại không công bố tỷ lệ ${job.aspectRatio}.`);
  }
  const exactCreate = capabilities.createDurations.includes(job.durationSeconds);
  if (exactCreate) return [{ kind: "create", requestedSeconds: job.durationSeconds }];
  if (capabilities.extendMode === "unknown" || capabilities.extendDurations.length === 0) {
    throw new PlanningBlockedError("Chưa xác minh semantics/thời lượng Extend; không tự giả định kế hoạch.");
  }
  const creates = [...capabilities.createDurations].sort((a, b) => b - a);
  const extendsBy = [...capabilities.extendDurations].sort((a, b) => b - a);
  for (const first of creates) {
    if (first >= job.durationSeconds) continue;
    const remaining = job.durationSeconds - first;
    const plan: SegmentPlan[] = [{ kind: "create", requestedSeconds: first }];
    let rest = remaining;
    while (rest > 0) {
      const step = extendsBy.find((value) => value <= rest);
      if (!step) break;
      plan.push({ kind: "extend", requestedSeconds: step });
      rest -= step;
    }
    if (rest === 0) return plan;
  }
  throw new PlanningBlockedError(`Không lập được kế hoạch chính xác ${job.durationSeconds}s từ capability đã quan sát.`);
}
