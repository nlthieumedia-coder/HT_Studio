import test from "node:test";
import assert from "node:assert/strict";
import { parsePromptLines } from "../src/parser.js";

test("parses explicit duration and ratio without confusing ages", () => {
  const [job] = parsePromptLines("20s | 9:16 | A 25-year-old walks for story year 2026", {});
  assert.equal(job?.durationSeconds, 20); assert.equal(job?.aspectRatio, "9:16");
});
test("uses defaults and preserves intentional duplicates", () => {
  const jobs = parsePromptLines("same\nsame", { durationSeconds: 15, aspectRatio: "16:9" });
  assert.equal(jobs.length, 2); assert.equal(jobs[1]?.prompt, "same");
});
test("rejects missing defaults", () => assert.throws(() => parsePromptLines("a 20-year-old person", {}), /thiếu thời lượng/));
