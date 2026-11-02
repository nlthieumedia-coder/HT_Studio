import test from "node:test";
import assert from "node:assert/strict";
import { isGoogleVidsGenerationLimit } from "../src/desktop-service.js";

test("detects Google Vids monthly seconds warning", () => {
  assert.equal(isGoogleVidsGenerationLimit("You have 10 seconds of video generation left this month. Limits reset Dec 1 at 3PM."), true);
});

test("detects explicit generation limit errors", () => {
  assert.equal(isGoogleVidsGenerationLimit("GOOGLE_VIDS_GENERATION_LIMIT: monthly quota"), true);
  assert.equal(isGoogleVidsGenerationLimit("You reached your monthly video generation limit"), true);
});

test("does not confuse ordinary generation progress with a limit", () => {
  assert.equal(isGoogleVidsGenerationLimit("Generating your 10 second video now"), false);
});
