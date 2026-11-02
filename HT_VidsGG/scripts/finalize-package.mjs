import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const projectRoot = resolve(import.meta.dirname, "..");
const stagingDir = join(process.env.TEMP || tmpdir(), "ht-vids-studio-pack");
const outputDir = join(projectRoot, "dist");

if (!existsSync(stagingDir)) {
  throw new Error(`Không tìm thấy thư mục đóng gói tạm: ${stagingDir}`);
}

const artifacts = readdirSync(stagingDir).filter(name => /^HT-Vids-Studio-(?:Setup-)?[\d.]+-Windows-x64\.exe$/i.test(name));
if (artifacts.length !== 1) {
  throw new Error(`Cần đúng 1 file portable, tìm thấy ${artifacts.length}: ${artifacts.join(", ")}`);
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(join(stagingDir, artifacts[0]), join(outputDir, artifacts[0]));
console.log(`[PACKAGE] Đã lưu: ${join(outputDir, artifacts[0])}`);

rmSync(join(projectRoot, "build"), { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });

try {
  rmSync(stagingDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
} catch (error) {
  console.warn(`[PACKAGE] Windows đang giữ file tạm; lần đóng gói sau sẽ dùng lại cùng thư mục: ${error.message}`);
}
