import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatDate,
  generateRandomCode,
  buildTaskFilename,
  getNextTaskIndex,
  ensureUniqueOutputFilename
} from "../src/task-naming.js";

test("formatDate trả về chuỗi 8 chữ số YYYYMMDD", () => {
  const date = new Date(2026, 9, 28); // 28/10/2026 (tháng 9 là October 0-indexed)
  assert.equal(formatDate(date), "20261028");
});

test("buildTaskFilename tạo đúng cấu trúc task-X-ngàytạo video_mã random cho video.mp4", () => {
  const filename = buildTaskFilename(1, "20261028", "a8b2c4");
  assert.equal(filename, "task-1-20261028_a8b2c4.mp4");

  const autoFilename = buildTaskFilename(5);
  const pattern = /^task-5-\d{8}_[a-zA-Z0-9]{6}\.mp4$/;
  assert.match(autoFilename, pattern);
});

test("generateRandomCode sinh chuỗi ký tự ngẫu nhiên duy nhất", () => {
  const code1 = generateRandomCode(6);
  const code2 = generateRandomCode(6);
  assert.equal(code1.length, 6);
  assert.equal(code2.length, 6);
  assert.notEqual(code1, code2);
});

test("getNextTaskIndex tự động tăng dần X và tiếp tục từ task/video cao nhất", () => {
  const emptyState: any = { tasks: [], videos: [] };
  assert.equal(getNextTaskIndex(emptyState), 1);
  assert.equal(getNextTaskIndex(emptyState), 2);
  assert.equal(getNextTaskIndex(emptyState), 3);

  const existingState: any = {
    tasks: [
      { id: "t1", taskIndex: 4, config: { filename: "task-4-20261028_112233.mp4" } },
      { id: "t2", config: { filename: "task-7-20261028_445566.mp4" } },
    ],
    videos: [
      { id: "v1", outputPath: "C:\\Videos\\task-9-20261028_778899.mp4" }
    ]
  };
  assert.equal(getNextTaskIndex(existingState), 10);
  assert.equal(getNextTaskIndex(existingState), 11);
});

test("ensureUniqueOutputFilename giữ nguyên tên nếu chưa có file trong thư mục", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "vids-test-"));
  try {
    const filename = "task-1-20261028_unique.mp4";
    const result = ensureUniqueOutputFilename(tempDir, filename, 1);
    assert.equal(result, filename);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ensureUniqueOutputFilename tự động đổi mã random mới nếu file đã tồn tại trong thư mục để tránh trùng tên", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "vids-test-"));
  try {
    const original = "task-2-20261028_dup001.mp4";
    // Giả lập file đã tồn tại trong thư mục
    writeFileSync(join(tempDir, original), "fake video content");

    const result = ensureUniqueOutputFilename(tempDir, original, 2);
    // Phải khác tên file đã có
    assert.notEqual(result, original);
    // Vẫn phải đảm bảo đúng cấu trúc: task-2-20261028_xxxxxx.mp4
    assert.match(result, /^task-2-20261028_[a-zA-Z0-9]+\.mp4$/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
