import { randomUUID } from "node:crypto";
import type { VidsAdapter } from "./adapter.js";
import type { Job, ParsedPrompt, SegmentPlan } from "./domain.js";
import { JsonJobStore } from "./store.js";

const ELIGIBLE = new Set(["VERIFIED_PRO", "VERIFIED_ULTRA"]);

export function makeJob(parsed: ParsedPrompt, profile: string, plan: SegmentPlan[]): Job {
  return { id: randomUUID(), line: parsed.line, originalPrompt: parsed.original, prompt: parsed.prompt, targetDurationSeconds: parsed.durationSeconds, aspectRatio: parsed.aspectRatio, profile, state: "VALIDATED", plan, achievedDurationSeconds: 0, updatedAt: new Date().toISOString() };
}

export class JobRunner {
  constructor(private adapter: VidsAdapter, private store: JsonJobStore, private outputDirectory: string) {}
  async run(job: Job): Promise<Job> {
    const account = await this.adapter.accountStatus();
    if (!ELIGIBLE.has(account)) {
      job.state = account === "LOGIN_REQUIRED" ? "WAITING_ACCOUNT" : "BLOCKED";
      job.error = `Account gate: ${account}`;
      return this.persist(job);
    }
    let resultId: string | undefined;
    try {
      for (const step of job.plan) {
        job.state = step.kind === "create" ? "GENERATING" : "EXTENDING";
        await this.persist(job); // checkpoint before a quota-consuming submit
        const result = step.kind === "create"
          ? await this.adapter.create(job.prompt, step.requestedSeconds, job.aspectRatio)
          : await this.adapter.extend(resultId!, step.prompt ?? job.prompt, step.requestedSeconds);
        resultId = result.id;
        job.achievedDurationSeconds = result.durationKind === "cumulative"
          ? result.durationSeconds
          : step.kind === "extend"
            ? job.achievedDurationSeconds + result.durationSeconds
            : result.durationSeconds;
        await this.persist(job);
      }
      job.state = "EXPORTING"; await this.persist(job);
      job.outputPath = await this.adapter.export(resultId!, this.outputDirectory);
      job.state = "COMPLETED"; job.updatedAt = new Date().toISOString();
      return this.persist(job);
    } catch (error) {
      job.state = "FAILED"; job.error = error instanceof Error ? error.message : String(error);
      return this.persist(job);
    }
  }
  private async persist(job: Job): Promise<Job> { job.updatedAt = new Date().toISOString(); await this.store.upsert(job); return job; }
}
