import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parsePromptLines } from "./parser.js";
import { planSegments } from "./planner.js";
import { makeJob, JobRunner } from "./runner.js";
import { JsonJobStore } from "./store.js";
import { MockVidsAdapter } from "./mock-adapter.js";
import { PlaywrightVidsAdapter } from "./playwright-adapter.js";

function arg(name: string, fallback?: string): string | undefined { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; }
async function input(): Promise<string> { const file = arg("--file"); return file ? readFile(resolve(file), "utf8") : (arg("--prompt") ?? "20s | 9:16 | A safe test video prompt"); }

const command = process.argv[2] ?? "preview";
const adapterName = arg("--adapter", "live");
const adapter = adapterName === "mock" ? new MockVidsAdapter() : new PlaywrightVidsAdapter(resolve("data/profile"), arg("--project-url"));
if (command === "survey") console.log(JSON.stringify(await adapter.survey(), null, 2));
else {
  const parsed = parsePromptLines(await input(), { durationSeconds: Number(arg("--duration", "20")), aspectRatio: (arg("--ratio", "9:16") as "9:16" | "16:9") });
  const capabilities = await adapter.survey();
  const jobs = parsed.map((item) => makeJob(item, "default", planSegments(item, capabilities)));
  if (command === "preview") console.log(JSON.stringify(jobs, null, 2));
  else if (command === "run") {
    const runner = new JobRunner(adapter, new JsonJobStore(resolve("data/jobs.json")), resolve("downloads"));
    for (const job of jobs) console.log(JSON.stringify(await runner.run(job), null, 2));
  } else throw new Error(`Lệnh không hỗ trợ: ${command}`);
}
