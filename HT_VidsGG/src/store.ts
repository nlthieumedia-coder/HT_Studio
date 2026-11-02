import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Job } from "./domain.js";

export class JsonJobStore {
  constructor(private readonly path: string) {}
  async load(): Promise<Job[]> {
    try { return JSON.parse(await readFile(this.path, "utf8")) as Job[]; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }
  async save(jobs: Job[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    await writeFile(temp, JSON.stringify(jobs, null, 2), "utf8");
    await rename(temp, this.path);
  }
  async upsert(job: Job): Promise<void> {
    const jobs = await this.load();
    const index = jobs.findIndex((candidate) => candidate.id === job.id);
    if (index >= 0) jobs[index] = job; else jobs.push(job);
    await this.save(jobs);
  }
}
