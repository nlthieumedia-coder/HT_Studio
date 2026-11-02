import test from "node:test";
import assert from "node:assert/strict";
import { planSegments, PlanningBlockedError } from "../src/planner.js";
import type { ParsedPrompt, VidsCapabilities } from "../src/domain.js";
const job: ParsedPrompt = { line: 1, original: "20s | 9:16 | x", prompt: "x", durationSeconds: 20, aspectRatio: "9:16" };
test("uses exact live capability when available", () => assert.deepEqual(planSegments(job, { createDurations: [8, 10, 20], extendDurations: [], aspectRatios: ["9:16"], extendMode: "unknown", discoveredAt: "now" }), [{ kind: "create", requestedSeconds: 20 }]));
test("does not invent Extend behavior", () => assert.throws(() => planSegments(job, { createDurations: [10], extendDurations: [], aspectRatios: ["9:16"], extendMode: "unknown", discoveredAt: "now" }), PlanningBlockedError));
test("plans only from observed additional durations", () => assert.deepEqual(planSegments(job, { createDurations: [10], extendDurations: [5, 10], aspectRatios: ["9:16"], extendMode: "additional", discoveredAt: "now" }), [{ kind: "create", requestedSeconds: 10 }, { kind: "extend", requestedSeconds: 10 }]));
