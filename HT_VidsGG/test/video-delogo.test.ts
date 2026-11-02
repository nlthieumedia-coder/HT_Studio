import test from "node:test";
import assert from "node:assert/strict";
import { getDelogoCoordinates, getFfmpegPath } from "../src/video-delogo.js";
import { existsSync } from "node:fs";

test("getDelogoCoordinates - Portrait 9:16 (1080x1920)", () => {
  const coords = getDelogoCoordinates(1080, 1920);
  assert.equal(coords.x, 860);
  assert.equal(coords.y, 1700);
  assert.equal(coords.w, 90);
  assert.equal(coords.h, 90);
  assert.ok(coords.x + coords.w <= 1080);
  assert.ok(coords.y + coords.h <= 1920);
});

test("getDelogoCoordinates - Portrait 9:16 (720x1280 scaled)", () => {
  const coords = getDelogoCoordinates(720, 1280);
  assert.equal(coords.x, 573);
  assert.equal(coords.y, 1133);
  assert.equal(coords.w, 60);
  assert.equal(coords.h, 60);
  assert.ok(coords.x + coords.w <= 720);
  assert.ok(coords.y + coords.h <= 1280);
});

test("getDelogoCoordinates - Landscape 16:9 (1920x1080)", () => {
  const coords = getDelogoCoordinates(1920, 1080);
  assert.equal(coords.x, 1700);
  assert.equal(coords.y, 860);
  assert.equal(coords.w, 90);
  assert.equal(coords.h, 90);
  assert.ok(coords.x + coords.w <= 1920);
  assert.ok(coords.y + coords.h <= 1080);
});

test("getFfmpegPath - locates executable correctly", () => {
  const ffmpeg = getFfmpegPath();
  assert.ok(typeof ffmpeg === "string" && ffmpeg.length > 0);
  if (ffmpeg.includes("ffmpeg.exe")) {
    assert.ok(existsSync(ffmpeg), `FFmpeg executable must exist at: ${ffmpeg}`);
  }
});
