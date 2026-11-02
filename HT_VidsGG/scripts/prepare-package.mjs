import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const stagingDir = join(process.env.TEMP || tmpdir(), "ht-vids-studio-pack");
rmSync(stagingDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
mkdirSync(stagingDir, { recursive: true });
console.log(`[PACKAGE] Thư mục tạm: ${stagingDir}`);
