import { execSync } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

export const LICENSE_SALT = "HT_VIDS_STUDIO_KEY_SALT_2026_V1";

/**
 * Danh sách 10 Key bản quyền vĩnh viễn phát hành sẵn.
 * Mỗi key dùng cho 1 máy duy nhất.
 */
export const PRE_GENERATED_MASTER_KEYS = [
  "HTVIDS-7A9B-4F2C-8E1D-9350",
  "HTVIDS-3C8E-1D9A-5F2B-7461",
  "HTVIDS-9F2B-7A4C-1E8D-5039",
  "HTVIDS-5E1D-9B3A-7F4C-2860",
  "HTVIDS-2B7A-4C9E-8D1F-6351",
  "HTVIDS-8D1F-6351-2B7A-4C9E",
  "HTVIDS-4C9E-8D1F-6351-2B7A",
  "HTVIDS-1F63-512B-7A4C-9E8D",
  "HTVIDS-6351-2B7A-4C9E-8D1F",
  "HTVIDS-512B-7A4C-9E8D-1F63",
] as const;

export interface LicenseRecord {
  key: string;
  hwid: string;
  activatedAt: string;
  type: string;
}

/**
 * Lấy Mã Máy Tính (Hardware ID - HWID) duy nhất cho mỗi máy Windows.
 * Định dạng chuẩn: HT-XXXX-XXXX
 */
export function getMachineId(): string {
  let rawGuid = "";
  if (process.platform === "win32") {
    try {
      const output = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const match = output.match(/MachineGuid\s+REG_SZ\s+([a-f0-9\-]+)/i);
      if (match && match[1]) {
        rawGuid = match[1].trim();
      }
    } catch {
      // Fallback nếu reg query bị hạn chế
    }
  }

  if (!rawGuid) {
    const username = os.userInfo?.()?.username || "default";
    const hostname = os.hostname?.() || "localhost";
    const arch = os.arch?.() || "x64";
    rawGuid = `${username}#${hostname}#${arch}`;
  }

  const hash = createHash("sha256").update(rawGuid + LICENSE_SALT).digest("hex").toUpperCase();
  return `HT-${hash.substring(0, 4)}-${hash.substring(4, 8)}`;
}

/**
 * Sinh mã key bản quyền hợp lệ với chữ ký HMAC.
 */
export function generateLicenseKey(targetMachineId?: string): string {
  const seed = targetMachineId
    ? targetMachineId.replace(/[^A-Z0-9]/g, "").toUpperCase().padEnd(8, "0").substring(0, 8)
    : randomBytes(4).toString("hex").toUpperCase();

  const hmac = createHmac("sha256", LICENSE_SALT).update(seed).digest("hex").toUpperCase();
  const p1 = seed.substring(0, 4);
  const p2 = seed.substring(4, 8);
  const p3 = hmac.substring(0, 4);
  const p4 = hmac.substring(4, 8);
  return `HTVIDS-${p1}-${p2}-${p3}-${p4}`;
}

/**
 * Kiểm tra tính hợp lệ của mã key (Cục bộ).
 */
export function verifyLicenseKey(
  inputKey: string,
  currentMachineId: string
): { valid: boolean; reason?: string; message?: string; type?: "PRE_GENERATED" | "MACHINE_BOUND" | "SIGNATURE_VALID" } {
  if (!inputKey || typeof inputKey !== "string") {
    const reason = "Vui lòng nhập mã bản quyền.";
    return { valid: false, reason, message: reason };
  }

  const cleanKey = inputKey.trim().toUpperCase();
  const pattern = /^HTVIDS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!pattern.test(cleanKey)) {
    const reason = "Định dạng mã key không đúng (Ví dụ: HTVIDS-XXXX-XXXX-XXXX-XXXX).";
    return { valid: false, reason, message: reason };
  }

  // 1. Kiểm tra 10 Key phát hành sẵn
  if ((PRE_GENERATED_MASTER_KEYS as readonly string[]).includes(cleanKey)) {
    return { valid: true, type: "PRE_GENERATED" };
  }

  // 2. Kiểm tra chữ ký HMAC
  const parts = cleanKey.replace("HTVIDS-", "").split("-");
  if (parts.length !== 4 || !parts[0] || !parts[1] || !parts[2] || !parts[3]) {
    const reason = "Mã bản quyền không đúng cấu trúc.";
    return { valid: false, reason, message: reason };
  }
  const seed = parts[0] + parts[1];
  const sig = parts[2] + parts[3];

  const expectedHmac = createHmac("sha256", LICENSE_SALT).update(seed).digest("hex").toUpperCase();
  if (sig === expectedHmac.substring(0, 8)) {
    const cleanMachine = currentMachineId.replace(/[^A-Z0-9]/g, "").toUpperCase().padEnd(8, "0").substring(0, 8);
    if (seed === cleanMachine) {
      return { valid: true, type: "MACHINE_BOUND" };
    }
    return { valid: true, type: "SIGNATURE_VALID" };
  }

  const reason = "Mã bản quyền không đúng hoặc đã bị chỉnh sửa.";
  return { valid: false, reason, message: reason };
}

export interface ServerLicenseResult {
  ok: boolean;
  online: boolean;
  message?: string;
  error?: string;
  type?: string;
}

/**
 * Lấy URL Google Sheets Web App từ file cấu hình hoặc biến môi trường.
 */
export function getLicenseServerUrl(): string {
  if (process.env.HT_LICENSE_API_URL) return process.env.HT_LICENSE_API_URL.trim();
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, "license-config.json"),
      join(here, "../src/license-config.json"),
      join(process.cwd(), "src/license-config.json"),
      join(process.cwd(), "license-config.json"),
    ];
    for (const configPath of candidates) {
      if (existsSync(configPath)) {
        const data = JSON.parse(readFileSync(configPath, "utf8")) as { licenseServerUrl?: string };
        if (data && typeof data.licenseServerUrl === "string" && data.licenseServerUrl.trim()) {
          return data.licenseServerUrl.trim();
        }
      }
    }
  } catch {
    // Bỏ qua nếu chưa có file cấu hình
  }
  return "";
}

/**
 * Kiểm tra bản quyền trực tuyến với Google Sheets (có fallback ngoại tuyến an toàn).
 */
export async function checkLicenseOnline(key: string, hwid: string): Promise<ServerLicenseResult> {
  const url = getLicenseServerUrl();
  if (!url) {
    return {
      ok: false,
      online: false,
      error: "Ứng dụng chưa được cấu hình máy chủ bản quyền."
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const reqUrl = new URL(url);
    reqUrl.searchParams.set("action", "check");
    reqUrl.searchParams.set("key", key);
    reqUrl.searchParams.set("hwid", hwid);

    const res = await fetch(reqUrl.toString(), {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { valid?: boolean; success?: boolean; error?: string };

    if (json.valid === false || json.success === false) {
      return {
        ok: false,
        online: true,
        error: json.error || "Bản quyền đã bị khóa bởi người quản trị."
      };
    }

    return {
      ok: true,
      online: true,
      type: "LIFETIME"
    };
  } catch {
    return {
      ok: false,
      online: false,
      error: "Không thể kết nối máy chủ bản quyền. Hãy kiểm tra Internet rồi thử lại."
    };
  }
}

/**
 * Kích hoạt bản quyền trực tuyến với Google Sheets (tự động ghi nhận HWID lên Sheet).
 */
export async function activateLicenseOnline(key: string, hwid: string): Promise<ServerLicenseResult> {
  // 1. Kiểm tra format và chữ ký cục bộ trước
  const local = verifyLicenseKey(key, hwid);
  if (!local.valid) {
    return { ok: false, online: false, error: local.reason };
  }

  const url = getLicenseServerUrl();
  if (!url) {
    return { ok: false, online: false, error: "Ứng dụng chưa được cấu hình máy chủ bản quyền." };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const reqUrl = new URL(url);
    reqUrl.searchParams.set("action", "activate");
    reqUrl.searchParams.set("key", key);
    reqUrl.searchParams.set("hwid", hwid);

    const res = await fetch(reqUrl.toString(), {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { success?: boolean; message?: string; error?: string };

    if (json.success) {
      return {
        ok: true,
        online: true,
        message: json.message || "Kích hoạt bản quyền trực tuyến thành công!",
        type: "LIFETIME"
      };
    } else {
      return {
        ok: false,
        online: true,
        error: json.error || "Không thể kích hoạt key trên máy chủ."
      };
    }
  } catch {
    return {
      ok: false,
      online: false,
      error: "Không thể kết nối máy chủ bản quyền. Hãy kiểm tra Internet rồi kích hoạt lại."
    };
  }
}
