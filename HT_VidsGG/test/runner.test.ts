import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JobRunner, makeJob } from "../src/runner.js";
import { JsonJobStore } from "../src/store.js";
import { MockVidsAdapter } from "../src/mock-adapter.js";
test("mock runner checkpoints and completes export", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vids-test-"));
  const job = makeJob({ line: 1, original: "20s | 9:16 | x", prompt: "x", durationSeconds: 20, aspectRatio: "9:16" }, "default", [{ kind: "create", requestedSeconds: 20 }]);
  const result = await new JobRunner(new MockVidsAdapter(), new JsonJobStore(join(dir, "jobs.json")), join(dir, "downloads")).run(job);
  assert.equal(result.state, "COMPLETED"); assert.match(await readFile(result.outputPath!, "utf8"), /"mock": true/);
});
test("runner does not double-count cumulative Extend output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vids-test-"));
  class CumulativeAdapter extends MockVidsAdapter {
    override async create() { return { id: "first", durationSeconds: 4, durationKind: "segment" as const }; }
    override async extend() { return { id: "extended", durationSeconds: 10, durationKind: "cumulative" as const }; }
  }
  const job = makeJob({ line: 1, original: "10s | 9:16 | x", prompt: "x", durationSeconds: 10, aspectRatio: "9:16" }, "default", [{ kind: "create", requestedSeconds: 4 }, { kind: "extend", requestedSeconds: 6 }]);
  const result = await new JobRunner(new CumulativeAdapter(), new JsonJobStore(join(dir, "jobs.json")), join(dir, "downloads")).run(job);
  assert.equal(result.achievedDurationSeconds, 10);
});
