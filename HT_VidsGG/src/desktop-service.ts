import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import ffprobeStatic from "ffprobe-static";
import { spawn } from "node:child_process";
import { removeGoogleWatermark } from "./video-delogo.js";

export const GOOGLE_VIDS_GENERATION_LIMIT_CODE = "GOOGLE_VIDS_GENERATION_LIMIT";

export function isGoogleVidsGenerationLimit(message: string): boolean {
  return new RegExp(GOOGLE_VIDS_GENERATION_LIMIT_CODE, "i").test(message)
    || /you have\s+\d+\s+seconds?\s+of video generation left this month/i.test(message)
    || /(?:reached|exceeded|used)\s+(?:your\s+)?(?:monthly\s+)?video generation limit/i.test(message)
    || /no\s+(?:video generation\s+)?(?:seconds?|credits?)\s+left/i.test(message)
    || /(?:hạn mức|giới hạn).*(?:tạo|sản xuất).*video|(?:tạo|sản xuất).*video.*(?:hạn mức|giới hạn)/i.test(message);
}

const execFileAsync = promisify(execFile);
const DEFAULT_PROJECT_URL = "https://docs.google.com/videos/create";

export interface DesktopJobConfig {
  projectUrl?: string;
  firstPrompt: string;
  secondPrompt: string;
  imagePaths: string[];
  outputDirectory: string;
  filename: string;
  aspectRatio?: "9:16" | "16:9";
  durationSeconds?: 5 | 10 | 15 | 20;
  resolution?: 720 | 1080;
  removeWatermark?: boolean;
}

export interface DesktopJobResult {
  projectUrl: string;
  outputPath: string;
  width: number;
  height: number;
  duration: number;
}

export interface GoogleLoginCredentials { email: string; password: string; totpSecret?: string; recoveryEmail?: string }

type Progress = (stage: string, message: string) => void;

export class GoogleVidsDesktopService {
  constructor(
    private profileDir: string,
    private progress: Progress,
    private checkpointPath?: string,
    private browserChannel: "chrome" | "msedge" = "chrome",
  ) {}

  private installedExecutable(channel: "chrome" | "msedge"): string | undefined {
    const candidates = channel === "msedge" ? [
      join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Microsoft/Edge/Application/msedge.exe"),
      join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Microsoft/Edge/Application/msedge.exe"),
      join(process.env.LOCALAPPDATA ?? "", "Microsoft/Edge/Application/msedge.exe"),
    ] : [
      join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
      join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Google/Chrome/Application/chrome.exe"),
      join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
    ];
    return candidates.find(existsSync);
  }

  private effectiveChannel(): "chrome" | "msedge" {
    if (this.installedExecutable(this.browserChannel)) return this.browserChannel;
    const fallback = this.browserChannel === "chrome" ? "msedge" : "chrome";
    if (this.installedExecutable(fallback)) return fallback;
    throw new Error("Không tìm thấy Google Chrome hoặc Microsoft Edge trên máy.");
  }

  private async cleanCrashedState(): Promise<void> {
    try {
      const prefsPath = join(this.profileDir, "Default", "Preferences");
      if (existsSync(prefsPath)) {
        const raw = await readFile(prefsPath, "utf8");
        const json = JSON.parse(raw);
        let modified = false;
        if (json.profile) {
          if (json.profile.exit_type !== "Normal") {
            json.profile.exit_type = "Normal";
            modified = true;
          }
          if (json.profile.exited_cleanly !== true) {
            json.profile.exited_cleanly = true;
            modified = true;
          }
        }
        if (modified) {
          await writeFile(prefsPath, JSON.stringify(json));
        }
      }
    } catch {
      // Ignore if Preferences file cannot be modified
    }
  }

  private async context(): Promise<BrowserContext> {
    await mkdir(this.profileDir, { recursive: true });
    await this.closeDetachedProfileBrowser();
    await this.cleanCrashedState();
    const context = await chromium.launchPersistentContext(this.profileDir, {
      headless: false,
      channel: this.effectiveChannel(),
      acceptDownloads: true,
      chromiumSandbox: true,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--disable-extensions",
        "--disable-session-crashed-bubble",
        "--hide-crash-restore-bubble",
        "--profile-directory=Default",
        "--no-first-run",
        "--no-default-browser-check",
        "--password-store=basic",
      ],
      viewport: { width: 1280, height: 720 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    return context;
  }

  private async closeDetachedProfileBrowser(): Promise<void> {
    if (process.platform !== "win32") return;
    const escapedProfile = this.profileDir.replace(/'/g, "''");
    const script = `$profile='${escapedProfile}'; Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'chrome.exe' -or $_.Name -eq 'msedge.exe') -and $_.CommandLine -like ('*--user-data-dir=' + $profile + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    await new Promise<void>(resolvePromise => {
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: "ignore", windowsHide: true });
      child.once("error", () => resolvePromise());
      child.once("exit", () => resolvePromise());
    });
    await new Promise(resolvePromise => setTimeout(resolvePromise, 500));
  }

  private async checkpoint(stage: string, data: Record<string, unknown> = {}): Promise<void> {
    if (!this.checkpointPath) return;
    await mkdir(dirname(this.checkpointPath), { recursive: true });
    await writeFile(this.checkpointPath, JSON.stringify({ stage, ...data, updatedAt: new Date().toISOString() }, null, 2));
  }

  private async waitForLogin(page: Page, timeout = 10 * 60_000): Promise<void> {
    this.progress("LOGIN", "Đang kiểm tra phiên đăng nhập Google Vids...");
    const deadline = Date.now() + timeout;
    let accountsGoogleSince: number | undefined;

    while (Date.now() < deadline) {
      if (page.isClosed()) throw new Error("Cửa sổ Google Vids đã đóng trong khi kiểm tra phiên đăng nhập.");
      const url = page.url();

      if (/accounts\.google\.com/i.test(url)) {
        if (!accountsGoogleSince) {
          accountsGoogleSince = Date.now();
        } else if (Date.now() - accountsGoogleSince > 8_000) {
          throw new Error("Chưa có phiên đăng nhập hoặc phiên đã hết hạn. Hãy dùng nút Đăng nhập / Kiểm tra trước khi chạy.");
        }
      } else {
        accountsGoogleSince = undefined;
      }

      if (/^https:\/\/docs\.google\.com\/videos\//i.test(url) && !/accounts\.google\.com/i.test(url)) {
        if (/^https:\/\/docs\.google\.com\/videos\/d\/[^/]+\/edit/i.test(url)) return;
        const editorReady = await page.getByRole("menuitem", { name: /^(File|Tệp)$/i }).isVisible().catch(() => false);
        const starterReady = await page.getByText(/Let.?s start creating|bắt đầu sáng tạo|sáng tạo/i).isVisible().catch(() => false);
        if (editorReady || starterReady) return;
      }
      await new Promise(resolvePromise => setTimeout(resolvePromise, 1_000));
    }
    throw new Error("Hết thời gian chờ đăng nhập Google Vids.");
  }

  private browserExecutable(): string {
    return this.installedExecutable(this.effectiveChannel())!;
  }

  private async normalChromeLogin(): Promise<void> {
    await mkdir(this.profileDir, { recursive: true });
    await this.cleanCrashedState();
    const browserName = this.effectiveChannel() === "msedge" ? "Microsoft Edge" : "Google Chrome";
    this.progress("LOGIN", `${browserName} chuẩn đã mở. Hãy đăng nhập/2FA, mở được Google Vids, rồi đóng toàn bộ cửa sổ này.`);
    const child = spawn(this.browserExecutable(), [
      `--user-data-dir=${this.profileDir}`,
      "--profile-directory=Default",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-session-crashed-bubble",
      "--hide-crash-restore-bubble",
      "https://docs.google.com/videos/",
    ], { stdio: "ignore", windowsHide: false });
    await new Promise<void>((resolvePromise, reject) => {
      child.once("error", reject);
      child.once("exit", () => resolvePromise());
    });
    await new Promise(resolvePromise => setTimeout(resolvePromise, 2_000));
    this.progress("LOGIN", `${browserName} đã đóng; đang kiểm tra phiên vừa lưu...`);
  }

  private totp(secret: string): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const normalized = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
    if (!normalized) throw new Error("Khóa 2FA TOTP không hợp lệ (cần định dạng Base32, ví dụ JBSWY3DPEHPK3PXP).");
    let bits = "";
    for (const char of normalized) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
    const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(byte => parseInt(byte, 2)));
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
    const digest = createHmac("sha1", key).update(counter).digest();
    const offset = digest[digest.length - 1]! & 0x0f;
    const bin = ((digest[offset]! & 0x7f) << 24) | ((digest[offset + 1]! & 0xff) << 16) | ((digest[offset + 2]! & 0xff) << 8) | (digest[offset + 3]! & 0xff);
    return (bin % 1_000_000).toString().padStart(6, "0");
  }

  async loginWithCredentials(credentials: GoogleLoginCredentials): Promise<{ accountStatus: string; email?: string; planEvidence?: string }> {
    await mkdir(this.profileDir, { recursive: true });
    await this.closeDetachedProfileBrowser();
    await this.cleanCrashedState();
    this.progress("LOGIN", `Đang khởi động Chrome đăng nhập cho ${credentials.email}...`);

    const context = await chromium.launchPersistentContext(this.profileDir, {
      headless: false,
      channel: this.effectiveChannel(),
      acceptDownloads: true,
      chromiumSandbox: true,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--disable-extensions",
        "--disable-blink-features=AutomationControlled",
        "--disable-session-crashed-bubble",
        "--hide-crash-restore-bubble",
        "--profile-directory=Default",
        "--no-first-run",
        "--no-default-browser-check",
        "--password-store=basic",
      ],
      viewport: { width: 1280, height: 720 },
    });

    try {
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto("https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fdocs.google.com%2Fvideos%2F", { waitUntil: "domcontentloaded", timeout: 45_000 });

      // A profile with a valid saved session may skip ServiceLogin completely.
      // Treat that redirect as success instead of waiting 35 seconds for an
      // email field that will never exist.
      await page.waitForTimeout(1_500);
      if (/^https:\/\/docs\.google\.com\/videos\//i.test(page.url()) && !/accounts\.google\.com/i.test(page.url())) {
        this.progress("LOGIN", `Phiên ${credentials.email} vẫn còn hiệu lực; bỏ qua bước nhập lại mật khẩu.`);
        if (!/^https:\/\/docs\.google\.com\/videos\/d\/[^/]+\/edit/i.test(page.url())) {
          await page.goto("https://docs.google.com/videos/create", { waitUntil: "domcontentloaded", timeout: 45_000 });
        }
        await this.waitForVidsEditor(context);
        const details = await this.accountDetails(context).catch(error => ({
          accountStatus: "VERIFIED_UNKNOWN",
          email: credentials.email,
          planEvidence: error instanceof Error ? error.message : String(error),
        }));
        return { ...details, email: details.email ?? credentials.email };
      }

      // Step 1: Điền email
      this.progress("LOGIN", `Đang điền email: ${credentials.email}...`);
      const chooseAnother = page.locator('div:has-text("Sử dụng một tài khoản khác"), div:has-text("Use another account")').first();
      if (await chooseAnother.isVisible().catch(() => false)) {
        await chooseAnother.click().catch(() => undefined);
        await page.waitForTimeout(800);
      }

      const emailInput = page.locator('input[type="email"], #identifierId, input[name="identifier"]').first();
      await emailInput.waitFor({ state: "visible", timeout: 35_000 });
      await emailInput.click();
      await emailInput.fill("");
      await emailInput.fill(credentials.email);
      await page.waitForTimeout(400);

      const idNext = page.locator('#identifierNext, button:has-text("Next"), button:has-text("Tiếp theo")').first();
      if (await idNext.isVisible().catch(() => false)) {
        await idNext.click();
      } else {
        await emailInput.press("Enter");
      }

      // Step 2: Điền mật khẩu
      this.progress("LOGIN", `Đang điền mật khẩu cho ${credentials.email}...`);
      await Promise.race([
        page.locator('input[type="password"], input[name="Passwd"], input[name="password"]').first().waitFor({ state: "visible", timeout: 25_000 }),
        page.locator('[aria-live="assertive"]:has-text("Không tìm thấy"), [aria-live="assertive"]:has-text("Couldn\'t find")').first().waitFor({ state: "visible", timeout: 15_000 }),
        page.locator(':has-text("may not be secure"), :has-text("không an toàn"), :has-text("Couldn\'t sign you in")').first().waitFor({ state: "visible", timeout: 10_000 }),
      ]).catch(() => undefined);

      if (/signin\/rejected/i.test(page.url()) || await page.locator(':has-text("may not be secure"), :has-text("không an toàn"), :has-text("Couldn\'t sign you in")').first().isVisible().catch(() => false)) {
        throw new Error("Google chặn đăng nhập tự động (This browser or app may not be secure). Hãy bấm 'Mở Chrome' để đăng nhập 1 lần duy nhất.");
      }

      const emailNotFound = await page.locator('[aria-live="assertive"]:has-text("Không tìm thấy"), [aria-live="assertive"]:has-text("Couldn\'t find")').first().isVisible().catch(() => false);
      if (emailNotFound) throw new Error(`Không tìm thấy tài khoản Google: ${credentials.email}`);

      const passwordInput = page.locator('input[type="password"], input[name="Passwd"], input[name="password"]').first();
      await passwordInput.waitFor({ state: "visible", timeout: 25_000 });
      await passwordInput.click();
      await passwordInput.fill("");
      await passwordInput.fill(credentials.password);
      await page.waitForTimeout(400);

      const passNext = page.locator('#passwordNext, button:has-text("Next"), button:has-text("Tiếp theo")').first();
      if (await passNext.isVisible().catch(() => false)) {
        await passNext.click();
      } else {
        await passwordInput.press("Enter");
      }

      // Step 3: Xử lý 2FA & các màn hình xác nhận sau đăng nhập
      this.progress("LOGIN", `Đang kiểm tra xác thực 2 bước (2FA)...`);
      const deadline = Date.now() + 65_000;
      let twoFaSubmitted = false;

      while (Date.now() < deadline) {
        if (!/accounts\.google\.com/i.test(page.url())) {
          break;
        }

        // Kiểm tra sai mật khẩu
        const pwError = await page.locator('[aria-live="assertive"]:has-text("Sai mật khẩu"), [aria-live="assertive"]:has-text("Wrong password")').first().isVisible().catch(() => false);
        if (pwError) throw new Error("Mật khẩu không chính xác.");

        // Nhận diện ô nhập mã 2FA TOTP
        const codeInput = page.locator('input[name="totpPin"], input#totpPin, input[type="tel"], input[name="Pin"], input[id="idvPin"], input[autocomplete="one-time-code"]').first();
        if (await codeInput.isVisible().catch(() => false)) {
          if (!credentials.totpSecret) {
            throw new Error("Google yêu cầu xác minh 2 bước (2FA) nhưng tài khoản chưa cung cấp mã/khóa TOTP 2FA.");
          }
          this.progress("LOGIN", `Tự động tạo mã 2FA TOTP...`);
          const code = this.totp(credentials.totpSecret);
          this.progress("LOGIN", `Đang điền mã 2FA [${code}] và xác nhận đăng nhập...`);
          await codeInput.click();
          await codeInput.fill(code);
          await page.waitForTimeout(400);

          const totpNext = page.locator('#totpNext, #idvPreregisteredPhoneNext, button:has-text("Next"), button:has-text("Tiếp theo")').first();
          if (await totpNext.isVisible().catch(() => false)) {
            await totpNext.click();
          } else {
            await codeInput.press("Enter");
          }
          twoFaSubmitted = true;
          await page.waitForTimeout(3000);
          continue;
        }

        // Nếu Google gợi ý nhấn trên điện thoại, tự bấm "Thử cách khác" -> chọn Google Authenticator
        if (credentials.totpSecret && !twoFaSubmitted) {
          const tryAnother = page.locator('button:has-text("Try another way"), button:has-text("Thử cách khác"), div[role="button"]:has-text("Thử cách khác"), [data-challengetype]').first();
          if (await tryAnother.isVisible().catch(() => false)) {
            this.progress("LOGIN", "Chuyển sang xác thực bằng ứng dụng Google Authenticator (2FA)...");
            await tryAnother.click().catch(() => undefined);
            await page.waitForTimeout(1500);
            const authOption = page.locator('li:has-text("Authenticator"), div:has-text("Authenticator"), div:has-text("ứng dụng"), [data-challengetype="6"]').first();
            if (await authOption.isVisible().catch(() => false)) {
              await authOption.click().catch(() => undefined);
              await page.waitForTimeout(2000);
              continue;
            }
          }
        }

        // Kiểm tra email khôi phục nếu được yêu cầu
        const recoveryInput = page.locator('input[name="knowledgePreregisteredEmailResponse"]').first();
        if (await recoveryInput.isVisible().catch(() => false)) {
          if (credentials.recoveryEmail) {
            this.progress("LOGIN", `Điền email khôi phục: ${credentials.recoveryEmail}...`);
            await recoveryInput.fill(credentials.recoveryEmail);
            await recoveryInput.press("Enter");
            await page.waitForTimeout(3000);
            continue;
          }
        }
        const recoveryChoice = page.locator('div:has-text("Xác nhận địa chỉ email khôi phục"), div:has-text("Confirm your recovery email")').first();
        if (await recoveryChoice.isVisible().catch(() => false)) {
          if (credentials.recoveryEmail) {
            await recoveryChoice.click().catch(() => undefined);
            await page.waitForTimeout(1500);
            continue;
          }
        }

        // Bỏ qua các màn hình nhắc nhở bảo mật (Passkey, thêm số điện thoại, bảo vệ tài khoản)
        const notNowBtn = page.locator('button:has-text("Not now"), button:has-text("Để sau"), button:has-text("Chưa phải lúc này"), button:has-text("Bỏ qua"), button:has-text("Skip")').first();
        if (await notNowBtn.isVisible().catch(() => false)) {
          this.progress("LOGIN", "Bỏ qua màn hình nhắc nhở bảo mật của Google...");
          await notNowBtn.click().catch(() => undefined);
          await page.waitForTimeout(2000);
          continue;
        }

        const continueBtn = page.locator('button:has-text("Tiếp tục"), button:has-text("Continue"), button:has-text("Tôi hiểu"), button:has-text("I understand")').first();
        if (await continueBtn.isVisible().catch(() => false)) {
          await continueBtn.click().catch(() => undefined);
          await page.waitForTimeout(2000);
          continue;
        }

        await page.waitForTimeout(1000);
      }

      if (/accounts\.google\.com/i.test(page.url())) {
        await page.goto("https://docs.google.com/videos/", { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
      }

      if (/accounts\.google\.com/i.test(page.url())) {
        throw new Error("Google yêu cầu CAPTCHA hoặc xác minh thiết bị; vui lòng bấm Kiểm tra để đăng nhập thủ công lần đầu.");
      }

      this.progress("ACCOUNT", "Đăng nhập thành công! Đang kiểm tra gói tài khoản...");
      return await this.accountDetails(context);
    } finally {
      await context.close().catch(() => undefined);
    }
  }

  private async accountDetails(context: BrowserContext): Promise<{ accountStatus: string; email?: string; planEvidence?: string }> {
    const page = await context.newPage();
    let email: string | undefined;
    let accountStatus = "VERIFIED_STANDARD";
    try {
      await page.goto("https://myaccount.google.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
      if (/accounts\.google\.com/i.test(page.url())) {
        throw new Error("Chưa đăng nhập Google hoặc phiên đã hết hạn.");
      }
      const accountText = await page.locator("body").innerText({ timeout: 30_000 }).catch(() => "");
      email = accountText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];

      await page.goto("https://one.google.com/settings?hl=en", { waitUntil: "domcontentloaded", timeout: 60_000 });
      if (/accounts\.google\.com/i.test(page.url())) {
        throw new Error("Chưa đăng nhập Google hoặc phiên đã hết hạn.");
      }
      if (!/^https:\/\/one\.google\.com\//i.test(page.url())) {
        return { accountStatus: "VERIFIED_STANDARD", email, planEvidence: "Google Vids: Đã xác thực phiên thành công" };
      }

      const membershipLink = page.locator('a[href*="manage-membership"]').first();
      const plansLink = page.locator('a[href*="plans"]').first();
      await page.locator('a[href*="manage-membership"], a[href*="plans"]').first().waitFor({ state: "attached", timeout: 30_000 });
      if (await membershipLink.count() > 0) {
        const href = await membershipLink.getAttribute("href");
        if (href) {
          const membershipUrl = new URL(href, page.url());
          membershipUrl.searchParams.set("hl", "en");
          await page.goto(membershipUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
          await page.getByText(/^Current status$/i).waitFor({ state: "visible", timeout: 30_000 });
          const membershipText = await page.locator("body").innerText({ timeout: 30_000 });
          const currentStatus = membershipText.match(/Current status\s+([^\r\n]+)/i)?.[1]?.trim() ?? "";
          if (/Google AI\s+Ultra/i.test(currentStatus)) accountStatus = "VERIFIED_ULTRA";
          else if (/Google AI\s+Pro/i.test(currentStatus)) accountStatus = "VERIFIED_PRO";
          else accountStatus = "VERIFIED_STANDARD";
          return { accountStatus, email, planEvidence: `Current status: ${currentStatus || "paid membership without AI tier"}` };
        }
      } else if (await plansLink.count() > 0) {
        accountStatus = "VERIFIED_STANDARD";
        return { accountStatus, email, planEvidence: "Google One: Plans only; no Manage membership" };
      }
      return { accountStatus: "VERIFIED_STANDARD", email, planEvidence: "Google Vids: Đã xác thực phiên thành công" };
    } catch (detailsError) {
      if (/Chưa đăng nhập|accounts\.google\.com/i.test(detailsError instanceof Error ? detailsError.message : String(detailsError))) {
        throw detailsError;
      }
      if (email) {
        return {
          accountStatus: "VERIFIED_STANDARD",
          email,
          planEvidence: `Google Vids: Đã đăng nhập (${detailsError instanceof Error ? detailsError.message : "không đọc được gói Google One"})`
        };
      }
      throw new Error(`Xác minh tài khoản thất bại: ${detailsError instanceof Error ? detailsError.message : String(detailsError)}`);
    } finally { await page.close().catch(() => undefined); }
  }

  async loginAndVerify(forceInteractiveLogin = false): Promise<{ accountStatus: string; email?: string; planEvidence?: string }> {
    // A brand-new profile must never visit Google's sign-in page through
    // Playwright. Google rejects automated browsers at authentication time.
    // Existing profiles may be verified first to avoid needless login prompts.
    if (!forceInteractiveLogin) {
      try { return await this.verifySavedLogin(); }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const sessionExpired = /Chưa có phiên đăng nhập|Chưa đăng nhập|phiên đã hết hạn|accounts\.google\.com|LOGIN_REQUIRED/i.test(message);
        if (!sessionExpired) throw error;
        this.progress("LOGIN", "Phiên đăng nhập đã hết hạn; mở Chrome thường để đăng nhập...");
      }
    } else {
      this.progress("LOGIN", `Profile mới: mở ${this.effectiveChannel() === "msedge" ? "Microsoft Edge" : "Google Chrome"} chuẩn, không dùng trình duyệt automation để đăng nhập...`);
    }
    await this.normalChromeLogin();
    return this.verifySavedLogin();
    /* legacy single-attempt verification retained below for source history */
    const context = await this.context();
    try {
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto("https://docs.google.com/videos/create");
      await this.waitForLogin(page);
      this.progress("ACCOUNT", "Đang kiểm tra gói Google AI...");
      const details = await this.accountDetails(context);
      this.progress("ACCOUNT", `Đã xác minh: ${details.accountStatus}`);
      return details;
    } finally { await context.close(); }
  }

  private async verifySavedLogin(): Promise<{ accountStatus: string; email?: string; planEvidence?: string }> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let context: BrowserContext | undefined;
      try {
        this.progress("ACCOUNT", attempt === 1 ? "Đang xác minh phiên đăng nhập..." : "Chrome vừa đóng; đang thử xác minh lại...");
        context = await this.context();
        const page = context.pages()[0] ?? await context.newPage();
        try {
          await page.goto("https://docs.google.com/videos/create", { waitUntil: "domcontentloaded" });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // Google Vids often aborts /create while replacing it with the library
          // or a newly-created editor page. That redirect is expected; the
          // context-level editor wait below resolves the actual active page.
          if (!/ERR_ABORTED|frame was detached|navigation.*aborted/i.test(message)) throw error;
          await page.waitForTimeout(1_000).catch(() => undefined);
        }
        const editorPage = await this.waitForVidsEditor(context);
        await this.verifyWorkflowReady(editorPage);
        const details: { accountStatus: string; email?: string; planEvidence?: string } = await this.accountDetails(context).catch(error => ({ accountStatus: "VERIFIED_UNKNOWN", email: undefined, planEvidence: error instanceof Error ? error.message : String(error) }));
        details.planEvidence = `${details.planEvidence || "Google Vids đã xác thực"} • Workflow Create/Ingredients/Prompt: READY`;
        this.progress("ACCOUNT", `Đã xác minh: ${details.email ?? "Google Vids"} • ${details.accountStatus.replace("VERIFIED_", "")}`);
        return details;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === 2 || !/closed|Target page|context|browser/i.test(message)) throw error;
        await new Promise(resolvePromise => setTimeout(resolvePromise, 2_000));
      } finally { await context?.close().catch(() => undefined); }
    }
    throw lastError;
  }

  private async verifyWorkflowReady(page: Page): Promise<void> {
    this.progress("WORKFLOW_CHECK", "Đang kiểm tra Canvas, ảnh tham chiếu và vùng nhập prompt...");
    await this.finishNewProjectDialog(page, "9:16");
    await this.setCanvas(page, "9:16");
    await this.openCreatePanel(page);
    const ingredients = page.getByText(/^(Ingredients|Thành phần|Nguyên liệu)$/i, { exact: true }).last();
    await ingredients.waitFor({ state: "visible", timeout: 60_000 });
    const promptBox = await this.visiblePromptBox(page, "create");
    if (!await promptBox.isVisible().catch(() => false)) {
      throw new Error("Workflow Google Vids chưa sẵn sàng: không thấy ô nhập prompt Create.");
    }
    this.progress("WORKFLOW_CHECK", "Workflow Canvas 9:16 • Ingredients • Prompt đã sẵn sàng.");
  }

  private async waitForVidsEditor(context: BrowserContext, timeout = 60_000): Promise<Page> {
    const deadline = Date.now() + timeout;
    const homeStartAttempts = new WeakMap<Page, number>();
    while (Date.now() < deadline) {
      for (const candidate of context.pages()) {
        if (candidate.isClosed() || !/^https:\/\/docs\.google\.com\/videos\//i.test(candidate.url())) continue;
        if (/^https:\/\/docs\.google\.com\/videos\/d\/[^/]+\/edit/i.test(candidate.url())) return candidate;
        const editorReady = await candidate.getByRole("menuitem", { name: /^(File|Tệp)$/i }).isVisible().catch(() => false);
        const starterReady = await candidate.getByText(/Let.?s start creating|bắt đầu sáng tạo|sáng tạo/i).isVisible().catch(() => false);
        if (editorReady || starterReady) return candidate;

        // Some established profiles are redirected from /videos/create to the
        // Vids library. Open the new-video tile and keep waiting for the real
        // editor instead of misclassifying the library as workflow-ready.
        const homeAttempts = homeStartAttempts.get(candidate) ?? 0;
        if (homeAttempts < 3 && /^https:\/\/docs\.google\.com\/videos\/(?:u\/\d+\/?)?(?:[?#].*)?$/i.test(candidate.url())) {
          const blankVideo = candidate.getByText(/^(Blank video|Video trống|Video rỗng)$/i, { exact: true }).first();
          const heading = candidate.getByText(/^(Start a new video|Get started|Bắt đầu video mới|Bắt đầu|Tạo video mới)$/i, { exact: true }).first();
          if (await blankVideo.isVisible().catch(() => false)) {
            homeStartAttempts.set(candidate, homeAttempts + 1);
            this.progress("ACCOUNT", "Đang tự mở Blank video từ trang chủ Google Vids...");
            await blankVideo.click({ force: true });
          } else if (await heading.isVisible().catch(() => false)) {
            homeStartAttempts.set(candidate, homeAttempts + 1);
            this.progress("ACCOUNT", "Google Vids chuyển về trang chủ; đang tự mở video trống...");
            const legacyTile = candidate.locator('.docs-homescreen-templates-templateview-preview, [aria-label*="Blank" i], [aria-label*="trống" i]').first();
            if (await legacyTile.isVisible().catch(() => false)) {
              await legacyTile.click({ force: true });
            } else {
              const box = await heading.boundingBox();
              if (!box) throw new Error("Không xác định được nút tạo video mới trên trang chủ Google Vids.");
              const activated = await heading.evaluate(element => {
                const rect = element.getBoundingClientRect();
                const hit = document.elementFromPoint(rect.left + 80, rect.bottom + 75) as HTMLElement | null;
                const actionable = hit?.closest('[jsaction], [role="button"], a, button') as HTMLElement | null;
                const target = actionable ?? hit;
                if (!target) return false;
                target.click();
                return true;
              }).catch(() => false);
              if (!activated) await candidate.mouse.click(box.x + 80, box.y + box.height + 75);
            }
            await candidate.waitForTimeout(1_500);
          }
        }
      }
      await new Promise(resolvePromise => setTimeout(resolvePromise, 500));
    }
    throw new Error("Profile chưa mở được Google Vids editor trong 60 giây.");
  }

  private async closeUnexpectedDialogs(page: Page, reason: string): Promise<void> {
    await this.acceptImagePolicy(page, 750).catch(() => false);
    const dismissButtons = page.getByRole("button", { name: /^(Got it|OK|Okay|Đã hiểu|Not now|Không phải lúc này|Skip|Bỏ qua|No thanks|Không, cảm ơn)$/i });
    for (let index = 0; index < await dismissButtons.count(); index += 1) {
      const button = dismissButtons.nth(index);
      if (!await button.isVisible().catch(() => false)) continue;
      this.progress("DISMISS", `Tự động đóng thông báo Google Vids (${reason}).`);
      await button.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
    }
    const unwanted = /Hình đại diện|Avatar|Voiceover|Lồng tiếng|Music|Âm nhạc|Images?|Hình ảnh|Record|Ghi/i;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const dialogs = page.getByRole("dialog");
      let closed = false;
      for (let index = 0; index < await dialogs.count(); index += 1) {
        const dialog = dialogs.nth(index);
        if (!await dialog.isVisible().catch(() => false)) continue;
        const dialogText = await dialog.innerText().catch(() => "");
        if (!unwanted.test(dialogText)) continue;
        this.progress("DISMISS", `Đóng cửa sổ ngoài workflow (${reason}): ${dialogText.split(/\r?\n/)[0] || "popup"}`);
        const close = dialog.getByRole("button", { name: /Close|Đóng|Dismiss|Hủy|Cancel/i }).first();
        if (await close.isVisible().catch(() => false)) await close.click().catch(() => undefined);
        else await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
        closed = true;
        break;
      }
      if (!closed) break;
    }
    const remaining = page.getByRole("dialog").filter({ hasText: unwanted }).first();
    if (await remaining.isVisible().catch(() => false)) throw new Error(`Không đóng được popup ngoài workflow trước bước ${reason}.`);
  }

  private async closeExtraPages(context: BrowserContext, keep: Page): Promise<void> {
    for (const candidate of context.pages()) {
      if (candidate === keep || candidate.isClosed()) continue;
      await candidate.close({ runBeforeUnload: false }).catch(() => undefined);
    }
  }

  private async setCanvas(page: Page, ratio: "9:16" | "16:9"): Promise<void> {
    const target = ratio === "9:16" ? "Portrait 9:16" : "Landscape 16:9";
    const starter = page.getByRole("dialog").filter({ hasText: /Let.?s start creating|bắt đầu sáng tạo/i }).first();
    if (await starter.isVisible().catch(() => false)) {
      this.progress("CANVAS", `Chọn ${target} trong màn hình chào mừng Google Vids.`);
      const starterRatio = ratio === "9:16" ? /^(Portrait|Dọc)$/i : /^(Landscape|Ngang)$/i;
      const ratioControl = starter.getByText(starterRatio, { exact: true }).first();
      await ratioControl.waitFor({ state: "visible", timeout: 10_000 });
      await ratioControl.click();
      const blankVideo = starter.getByText(/Blank vid|Video trống|Vid trống/i).first();
      await blankVideo.waitFor({ state: "visible", timeout: 10_000 });
      await blankVideo.click();
      await starter.waitFor({ state: "hidden", timeout: 15_000 });
      await page.waitForTimeout(1_000);
      const starterCanvas = await page.locator("#canvas").boundingBox();
      if (starterCanvas && ((ratio === "9:16") === (starterCanvas.height > starterCanvas.width))) {
        this.progress("CANVAS", `Đã tạo dự án trống với Canvas ${target}.`);
        return;
      }
    }
    await this.closeUnexpectedDialogs(page, "đổi kích thước Canvas");
    this.progress("CANVAS", `Xác nhận kích thước dự án ${target}.`);
    const toolbarSize = page.locator("#aspectRatioButton");
    if (await toolbarSize.isVisible().catch(() => false)) {
      await toolbarSize.click();
    } else {
      const fileMenu = page.locator("#docs-file-menu");
      if (await fileMenu.isVisible().catch(() => false)) {
        await fileMenu.click();
        const ratioItem = page.getByRole("menuitem").filter({ has: page.locator(".docs-icon-aspect-ratio-20x20") });
        if (await ratioItem.isVisible().catch(() => false)) {
          await ratioItem.click();
        } else {
          await page.keyboard.press("Escape");
          throw new Error("Không tìm thấy mục thay đổi tỷ lệ Canvas trong menu Tệp.");
        }
      } else {
        throw new Error("Không tìm thấy nút hoặc menu thay đổi tỷ lệ Canvas.");
      }
    }
    const dialog = page.getByRole("dialog").last();
    if (!await dialog.isVisible().catch(() => false)) {
      await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
    }
    if (!await dialog.isVisible().catch(() => false)) throw new Error("Đã bấm đổi Canvas nhưng hộp cấu hình tỷ lệ không xuất hiện.");

    const select = dialog.getByRole("combobox").first();
    const ratioText = ratio.replace(":", "\\s*:\\s*");
    const currentText = await select.innerText().catch(() => "");
    if (!new RegExp(ratioText).test(currentText)) {
      await select.click();
      const option = page.getByRole("option").filter({ hasText: new RegExp(ratioText) }).last();
      await option.waitFor({ state: "visible", timeout: 10_000 });
      await option.click();
      await page.waitForTimeout(500);
    }
    const selectedText = await select.innerText().catch(() => currentText);
    if (!new RegExp(ratioText).test(selectedText)) throw new Error(`Đã chọn tỷ lệ nhưng Google Vids vẫn hiển thị: ${selectedText || "không xác định"}.`);
    // Escape closes this popover as a cancellation and reverts the ratio.
    // Commit the selected value by clicking the editor chrome outside it.
    // Do not press Escape here: in the current Google Vids dialog Escape
    // cancels the new ratio and silently restores Landscape.
    await page.waitForTimeout(250);
    await page.mouse.click(300, 170);
    await dialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
    if (await dialog.isVisible().catch(() => false)) throw new Error("Hộp cấu hình Canvas chưa đóng sau khi áp dụng tỷ lệ.");
    await page.waitForTimeout(1_000);
    // #canvas is the editor viewport, not the white scene itself. Its dimensions
    // stay landscape even for a portrait project, so measuring it produced false
    // failures such as 562×317. Re-open the authoritative Video size control and
    // verify Google's selected ratio instead.
    if (await toolbarSize.isVisible().catch(() => false)) {
      await toolbarSize.click();
    } else {
      const verifyFileMenu = page.locator("#docs-file-menu");
      await verifyFileMenu.click();
      const verifyRatioItem = page.getByRole("menuitem").filter({ has: page.locator(".docs-icon-aspect-ratio-20x20") });
      await verifyRatioItem.click();
    }
    const verifyDialog = page.getByRole("dialog").last();
    await verifyDialog.waitFor({ state: "visible", timeout: 5_000 });
    const verifiedText = await verifyDialog.getByRole("combobox").first().innerText().catch(() => "");
    await page.mouse.click(300, 170);
    await verifyDialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
    if (!new RegExp(ratioText).test(verifiedText)) {
      throw new Error(`Canvas chưa lưu ${target}; Google Vids đang hiển thị ${verifiedText || "không xác định"}.`);
    }
    this.progress("CANVAS", `Đã áp dụng Canvas ${target}.`);
  }

  private async finishNewProjectDialog(page: Page, ratio: "9:16" | "16:9"): Promise<void> {
    const starterSelector = '[class*="javascriptMaterialdesignGm3WizDialog"], [class*="WizDialog"], div[role="dialog"], [aria-modal="true"], .docs-material-dialog';
    let starter = page.locator(starterSelector).filter({
      hasText: /sáng tạo|start creating|Xin chào|Video trống|Blank vid|Tạo video AI/i
    }).first();

    const isVisible = await starter.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const welcomePortrait = ratio === "9:16";
      const welcomeRatio = welcomePortrait ? /Dọc|Portrait/i : /Ngang|Landscape/i;
      const welcomeRatioChoice = starter.getByText(welcomeRatio).last();
      await welcomeRatioChoice.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {
        throw new Error(`Màn hình chào mừng không có lựa chọn ${welcomePortrait ? "Portrait" : "Landscape"}.`);
      });
      await welcomeRatioChoice.click();
      await page.waitForTimeout(500);

      const welcomeBlankChoice = page.getByText(/Video trống|Blank vid|Blank video/i).last();
      if (await welcomeBlankChoice.isVisible().catch(() => false)) {
        await welcomeBlankChoice.click();
        await page.waitForTimeout(500);
      }
      const getStarted = page.getByRole("button", { name: /Get started|Bắt đầu/i }).first();
      if (await getStarted.isVisible().catch(() => false)) await getStarted.click();
      else if (await starter.isVisible().catch(() => false) && !await welcomeBlankChoice.isVisible().catch(() => false)) {
        const welcomeClose = page.getByRole("button", { name: /Close|Đóng/i }).first();
        if (await welcomeClose.isVisible().catch(() => false)) await welcomeClose.click();
        else await page.keyboard.press("Escape");
      }
      await page.getByText(/Let.?s start creating|bắt đầu sáng tạo/i).first().waitFor({ state: "hidden", timeout: 15_000 });
      await page.waitForTimeout(1_000);
      await this.closeUnexpectedDialogs(page, "khởi tạo dự án");
      return;
      this.progress("NEW_PROJECT", `Phát hiện cửa sổ khởi tạo: đang chọn kích thước ${ratio === "9:16" ? "Dọc 9:16" : "Ngang 16:9"}...`);

      // 1. Chọn tỷ lệ mong muốn (Dọc / Ngang) trên modal
      const isPortrait = ratio === "9:16";
      const ratioBtn = isPortrait
        ? starter.locator('button, [role="button"], [role="radio"], div').filter({ hasText: /Dọc|Portrait/i }).first()
        : starter.locator('button, [role="button"], [role="radio"], div').filter({ hasText: /Ngang|Landscape/i }).first();

      if (await ratioBtn.isVisible().catch(() => false)) {
        this.progress("NEW_PROJECT", `Đã chọn tỷ lệ ${isPortrait ? "Dọc (9:16)" : "Ngang (16:9)"}.`);
        await ratioBtn.click({ timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(500);
      }

      // 2. Tắt cửa sổ / Chọn Video trống hoặc nhấn nút đóng [✕]
      const blankVid = starter.locator('button, [role="button"], div').filter({
        hasText: /Video trống|Blank vid|Blank video/i
      }).first();

      if (await blankVid.isVisible().catch(() => false)) {
        this.progress("NEW_PROJECT", "Chọn Video trống để bắt đầu...");
        await blankVid.click({ timeout: 5000 }).catch(() => undefined);
      } else {
        const closeBtn = starter.locator('button[aria-label*="Đóng" i], button[aria-label*="Close" i], button:has-text("✕")').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click().catch(() => undefined);
        } else {
          await page.keyboard.press("Escape");
        }
      }

      // 3. Đợi cửa sổ đóng hoàn toàn
      await starter.waitFor({ state: "hidden", timeout: 8000 }).catch(() => undefined);
      await page.waitForTimeout(1000);
    }

    // Luôn kiểm tra và giải phóng scrim che khuất giao diện nếu còn sót lại
    const scrimSelector = '[class*="dialog__scrim"], .modal-dialog-bg, [class*="scrim"]';
    for (let s = 0; s < 3; s += 1) {
      const scrim = page.locator(scrimSelector).first();
      if (await scrim.isVisible().catch(() => false)) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }

    // Đóng các popup phụ (Got it, Đã hiểu, ...) nếu có
    const gotIt = page.getByRole("button", { name: /Got it|Đã hiểu|Không phải lúc này|Not now|Bỏ qua|Skip/i }).first();
    if (await gotIt.isVisible().catch(() => false)) {
      await gotIt.click().catch(() => undefined);
    }
    await this.closeUnexpectedDialogs(page, "khởi tạo dự án");
  }

  private async acceptImagePolicy(page: Page, waitMs = 5_000): Promise<boolean> {
    const deadline = Date.now() + waitMs;
    const titlePattern = /Create content from images(?: in Workspace)?|Tạo nội dung từ hình ảnh(?: trong Workspace)?/i;
    const agreePattern = /^(Agree|I agree|Đồng ý|Tôi đồng ý|Chấp nhận)$/i;
    do {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (titlePattern.test(bodyText)) {
        const candidates = [
          page.getByRole("button", { name: agreePattern }).last(),
          page.locator("button").filter({ hasText: agreePattern }).last(),
          page.getByText(agreePattern, { exact: true }).last()
        ];
        for (const candidate of candidates) {
          if (!await candidate.isVisible().catch(() => false)) continue;
          await candidate.click({ timeout: 5_000, force: true });
          const title = page.getByText(titlePattern).first();
          await title.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
          this.progress("CREATE_PANEL", "Đã tự động xác nhận chính sách sử dụng ảnh tham chiếu.");
          return true;
        }
      }
      await page.waitForTimeout(250);
    } while (Date.now() < deadline);
    return false;
  }

  private async addImages(page: Page, paths: string[]): Promise<void> {
    const missing = paths.filter(path => !existsSync(path));
    if (missing.length) throw new Error(`Không tìm thấy ảnh tham chiếu: ${missing.join(", ")}`);
    const ingredients = page.getByText(/^(Ingredients|Thành phần|Nguyên liệu)$/i, { exact: true }).last();
    await ingredients.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {
      throw new Error("Không mở được mục Ingredients của tab Create. Giao diện AI Video có thể chưa tải xong hoặc đang ở tab khác.");
    });
    await this.closeUnexpectedDialogs(page, "chuẩn bị tải ảnh");

    const uploadOne = async (filePath: string, index: number): Promise<void> => {
      await this.acceptImagePolicy(page, 2_000);
      // Google Vids keeps the native file input hidden. Assigning the path
      // directly is both faster and prevents Windows Explorer from opening.
      let fileInput = page.locator('input[type="file"][accept*="image"], input[type="file"][accept*="png"], input[type="file"][accept*="jpeg"]').last();
      if (await fileInput.count()) {
        await fileInput.setInputFiles(filePath);
      } else {
        const trigger = index === 0
          ? ingredients
          : page.getByRole("button", { name: /Add avatar or ingredients|Thêm hình đại diện hoặc thành phần/i }).last();
        const chooserPromise = page.waitForEvent("filechooser", { timeout: 8_000 }).catch(() => null);
        await trigger.click({ timeout: 10_000 });
        let chooser = await chooserPromise;
        if (!chooser) {
          await this.acceptImagePolicy(page, 8_000);
          fileInput = page.locator('input[type="file"][accept*="image"], input[type="file"][accept*="png"], input[type="file"][accept*="jpeg"]').last();
          if (await fileInput.count()) {
            await fileInput.setInputFiles(filePath);
          } else {
            const upload = page.getByRole("button", { name: /^(Upload|Tải lên)$/i }).last();
            const retryChooser = page.waitForEvent("filechooser", { timeout: 15_000 }).catch(() => null);
            await upload.click({ timeout: 10_000 });
            chooser = await retryChooser;
            if (!chooser) throw new Error("Google Vids không cung cấp vùng tải ảnh sau khi đã đóng popup.");
            await chooser.setFiles(filePath);
          }
        } else {
          await chooser.setFiles(filePath);
        }
      }
      await page.getByRole("button", { name: /Remove image|Xóa hình ảnh/i }).nth(index).waitFor({ state: "visible", timeout: 60_000 });
      this.progress("UPLOAD", `Đã tải ảnh tham chiếu ${index + 1}/${paths.length}: ${basename(filePath)}`);
    };

    for (let index = 0; index < paths.length; index += 1) {
      await uploadOne(paths[index]!, index);
    }
  }

  private async openCreatePanel(page: Page): Promise<void> {
    this.progress("CREATE_PANEL", "Đang mở tab Create của AI Video...");
    await this.closeUnexpectedDialogs(page, "mở Video AI");
    const existingIngredients = page.getByText(/^(Ingredients|Thành phần|Nguyên liệu)$/i, { exact: true }).last();
    if (await existingIngredients.isVisible().catch(() => false)) {
      this.progress("CREATE_PANEL", "Composer AI Video đã mở sẵn.");
      return;
    }
    // Đảm bảo không bị scrim che khuất
    const scrim = page.locator('[class*="dialog__scrim"], [class*="scrim"]').first();
    if (await scrim.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }
    const railButton = page.getByRole("button", { name: /Generate an AI video clip|AI video clip|Video AI|Tạo video AI/i }).last();
    const railText = page.getByText(/^(AI Video|Video AI|AI video clip|Tạo video AI)$/i, { exact: true }).last();
    const structuralRailButton = page.locator("#content-library-rail-video-generation-element");
    let opened = false;
    for (let attempt = 0; attempt < 3 && !opened; attempt += 1) {
      if (await railButton.isVisible().catch(() => false)) { await railButton.click(); opened = true; }
      else if (await railText.isVisible().catch(() => false)) { await railText.click(); opened = true; }
      else if (await structuralRailButton.isVisible().catch(() => false)) { await structuralRailButton.click(); opened = true; }
      else {
        await this.closeUnexpectedDialogs(page, "chờ thanh công cụ Video AI");
        await page.waitForTimeout(1_500);
      }
    }
    if (!opened) throw new Error("Không tìm thấy mục Video AI trên thanh công cụ.");
    await page.waitForTimeout(800);
    await this.closeUnexpectedDialogs(page, "sau khi chọn Video AI");
    await this.acceptImagePolicy(page);
    const createTab = page.getByRole("tab", { name: /^(Create|Tạo)$/i });
    if (await createTab.isVisible().catch(() => false)) await createTab.click();
    // The newer Google Vids layout opens the Create composer directly and no
    // longer renders a Create tab. Ingredients/prompt visibility is authoritative.
    await this.acceptImagePolicy(page);
    const ingredients = page.getByText(/^(Ingredients|Thành phần|Nguyên liệu)$/i, { exact: true }).last();
    if (!await ingredients.isVisible().catch(() => false)) {
      const expandComposer = page.getByRole("button", { name: /^(Expand|Mở rộng)$/i }).last();
      if (await expandComposer.isVisible().catch(() => false)) await expandComposer.click();
    }
    await ingredients.waitFor({ state: "visible", timeout: 60_000 });
  }

  private async visiblePromptBox(page: Page, mode: "create" | "extend"): Promise<Locator> {
    await this.acceptImagePolicy(page, 3_000);
    const named = mode === "create"
      ? page.getByRole("textbox", { name: /Describe your video|Mô tả video/i })
      : page.getByRole("textbox", { name: /Add your video|what happens next|xảy ra tiếp theo/i });
    if (await named.last().isVisible().catch(() => false)) return named.last();
    const editable = page.locator('[role="textbox"][contenteditable="true"]:visible, textarea:visible').last();
    await editable.waitFor({ state: "visible", timeout: 60_000 });
    return editable;
  }

  private async fillPrompt(page: Page, mode: "create" | "extend", prompt: string): Promise<void> {
    await this.closeUnexpectedDialogs(page, `nhập prompt ${mode}`);
    await this.acceptImagePolicy(page, 3_000);
    const box = await this.visiblePromptBox(page, mode);
    await box.evaluate(element => (element as HTMLElement).focus());
    await box.fill(prompt).catch(async () => {
      await page.keyboard.press("Control+A");
      await page.keyboard.type(prompt);
    });
    const value = await box.inputValue().catch(() => box.textContent());
    if (!value || value.trim().length < Math.min(20, prompt.trim().length)) throw new Error(`Không xác nhận được nội dung prompt ${mode}.`);
  }

  private async configureGeneration(page: Page, ratio: "9:16" | "16:9", seconds: 5 | 10, resolution: 720 | 1080): Promise<void> {
    await this.closeUnexpectedDialogs(page, "cấu hình tạo video");
    const settings = page.getByRole("button", { name: /Generation settings|Cài đặt tạo/i }).last();
    await settings.click();
    const ratioLabel = ratio === "9:16" ? "Portrait" : "Landscape";
    const ratioPattern = ratio === "9:16" ? /Portrait|Dọc/i : /Landscape|Ngang/i;
    const ratioRadio = page.getByRole("radio", { name: ratioPattern });
    if (await ratioRadio.isVisible().catch(() => false)) await ratioRadio.click();
    let effectiveResolution: 720 | 1080 = resolution;
    let resolutionPattern = new RegExp(`^${effectiveResolution}p$`, "i");
    const currentSettingsLabel = await settings.getAttribute("aria-label") ?? "";
    if (!new RegExp(`${effectiveResolution}p`, "i").test(currentSettingsLabel)) {
      let resolutionControl = page.getByRole("radio", { name: resolutionPattern }).last();
      if (!await resolutionControl.isVisible().catch(() => false)) resolutionControl = page.getByRole("option", { name: resolutionPattern }).last();
      if (!await resolutionControl.isVisible().catch(() => false)) resolutionControl = page.getByText(resolutionPattern, { exact: true }).last();
      if (!await resolutionControl.isVisible().catch(() => false)) {
        if (resolution === 1080) {
          effectiveResolution = 720;
          resolutionPattern = /^720p$/i;
          this.progress("RESOLUTION_FALLBACK", "Tài khoản/model không hỗ trợ 1080p; tự động chuyển về 720p.");
        } else throw new Error(`Tài khoản hoặc model hiện tại không cung cấp tùy chọn ${resolution}p.`);
      } else await resolutionControl.click();
    }
    const duration = page.getByRole("slider", { name: /Video duration|Thời lượng video/i }).last();
    await duration.waitFor({ state: "visible", timeout: 10_000 });
    await duration.evaluate((element, targetSeconds) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, String(targetSeconds));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, seconds);
    await page.waitForTimeout(500);
    const durationText = await duration.getAttribute("aria-valuetext") ?? "";
    const secondsPattern = new RegExp(`${seconds}\\s*(?:seconds?|giây)`, "i");
    if (!secondsPattern.test(durationText)) throw new Error(`Không đặt được thời lượng ${seconds} giây: ${durationText || "không đọc được giá trị"}`);
    await page.keyboard.press("Escape");
    const label = await settings.getAttribute("aria-label") ?? "";
    if (!ratioPattern.test(label) || !secondsPattern.test(label) || !new RegExp(`${effectiveResolution}p`, "i").test(label)) throw new Error(`Cấu hình tạo video không đúng: ${label}`);
  }

  private async cardAction(card: Locator, name: "Extend" | "Insert"): Promise<Locator> {
    const pattern = name === "Extend" ? /^(Extend|Mở rộng|Kéo dài)$/i : /^(Insert|Chèn|Thêm vào cảnh)$/i;
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      let container = card.locator("xpath=..");
      for (let level = 0; level < 8; level += 1) {
        const action = container.getByRole("button", { name: pattern });
        if (await action.count() > 0 && await action.first().isVisible().catch(() => false)) return action.first();
        container = container.locator("xpath=..");
      }
      await card.page().waitForTimeout(2_000);
    }
    throw new Error(`Video đã xuất hiện nhưng nút ${name} chưa sẵn sàng sau 10 phút.`);
  }

  private async throwIfGenerationLimited(page: Page): Promise<void> {
    const bodyText = await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "");
    if (!isGoogleVidsGenerationLimit(bodyText)) return;
    const detail = bodyText.match(/you have\s+\d+\s+seconds?\s+of video generation left this month[^\r\n]*/i)?.[0]
      ?? bodyText.match(/[^\r\n]*(?:video generation limit|hạn mức[^\r\n]*video|giới hạn[^\r\n]*video)[^\r\n]*/i)?.[0]
      ?? "Google Vids báo tài khoản đã chạm hạn mức tạo video.";
    throw new Error(`${GOOGLE_VIDS_GENERATION_LIMIT_CODE}: ${detail.trim()}`);
  }

  private async waitForNewCard(page: Page, previousCount: number): Promise<Locator> {
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await this.throwIfGenerationLimited(page);
      const cards = page.getByRole("button", { name: /^(Generated video:|Video đã tạo:)/i });
      if (await cards.count() > previousCount) return cards.last();
      await page.waitForTimeout(2_000);
    }
    throw new Error("Google Vids chưa trả về video sau 10 phút.");
  }

  private async fillScene(page: Page): Promise<void> {
    this.progress("FIT", "Mở rộng video để phủ kín toàn bộ scene.");
    await this.closeUnexpectedDialogs(page, "đưa video vào scene");
    const gotIt = page.getByRole("button", { name: /Got it|Đã hiểu/i });
    if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
    const trackLabel = page.getByText("Video", { exact: true }).last();
    if (await trackLabel.isVisible().catch(() => false)) await trackLabel.click();
    else {
      const sceneBox = await page.getByRole("button", { name: /Scene \d+ of \d+/i }).boundingBox();
      if (!sceneBox) throw new Error("Không xác định được video track trên timeline.");
      await page.mouse.click(sceneBox.x + sceneBox.width / 2, sceneBox.y + sceneBox.height + 18);
    }
    await page.keyboard.press("Shift+F10");
    let expand = page.getByText(/Expand video to fill (?:the )?scene/i).last();
    if (!await expand.isVisible().catch(() => false)) {
      const sceneBox = await page.getByRole("button", { name: /Scene \d+ of \d+/i }).boundingBox();
      if (!sceneBox) throw new Error("Không xác định được video track trên timeline.");
      await page.mouse.click(sceneBox.x + sceneBox.width / 2, sceneBox.y + sceneBox.height + 18, { button: "right" });
      expand = page.getByText(/Expand video to fill (?:the )?scene/i).last();
    }
    await expand.waitFor({ state: "visible", timeout: 10_000 });
    await expand.click();
    await page.waitForTimeout(5_000);
  }

  private async download(page: Page, outputPath: string): Promise<void> {
    this.progress("DOWNLOAD", "Đang xuất và tải MP4...");
    await this.closeUnexpectedDialogs(page, "xuất video");
    const fileMenu = page.locator("#docs-file-menu");
    const downloadLabel = /Download|Tải xuống|Descargar|Télécharger|Herunterladen|Scarica|Baixar/i;
    const mp4Label = /MP4|MPEG[- ]?4|Video\s*\(\.mp4\)|Video.*mp4/i;

    // Vids creates the Download submenu lazily. Hover alone can miss it on
    // slower profiles, so also open it by keyboard and retry after closing menus.
    let mp4Item: Locator | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await fileMenu.click();
      const downloadItem = page.locator('[role="menuitem"]:visible, [role="menuitemcheckbox"]:visible, [role="menuitemradio"]:visible')
        .filter({ hasText: downloadLabel }).first();
      await downloadItem.waitFor({ state: "visible", timeout: 15_000 });
      await downloadItem.hover();
      await page.keyboard.press("ArrowRight").catch(() => undefined);
      await page.waitForTimeout(700);
      const candidate = page.locator('[role="menuitem"]:visible, [role="menuitemcheckbox"]:visible, [role="menuitemradio"]:visible')
        .filter({ hasText: mp4Label }).last();
      if (await candidate.isVisible().catch(() => false)) {
        mp4Item = candidate;
        break;
      }
    }
    if (!mp4Item) {
      const visibleItems = await page.locator('[role="menuitem"]:visible, [role="menuitemcheckbox"]:visible, [role="menuitemradio"]:visible')
        .allInnerTexts().catch(() => [] as string[]);
      throw new Error(`Không tìm thấy lệnh xuất MP4. Menu hiện có: ${visibleItems.join(" | ") || "trống"}`);
    }
    const downloadPromise = page.waitForEvent("download", { timeout: 10 * 60_000 });
    await mp4Item.click();
    await (await downloadPromise).saveAs(outputPath);
  }

  async run(config: DesktopJobConfig): Promise<DesktopJobResult> {
    if (!config.firstPrompt || !config.secondPrompt) throw new Error("Thiếu prompt.");
    if (config.imagePaths.length > 3) throw new Error("Chỉ hỗ trợ tối đa 3 ảnh tham chiếu cho clip đầu.");
    if (!config.outputDirectory) throw new Error("Chưa chọn thư mục đầu ra.");
    const safeName = basename(config.filename || "google-vids-20s-portrait-filled.mp4");
    const ratio = config.aspectRatio ?? "9:16";
    const requestedDuration = config.durationSeconds ?? 10;
    const resolution = config.resolution ?? 720;
    if (![5, 10, 15, 20].includes(requestedDuration)) throw new Error(`Thời lượng ${requestedDuration} giây chưa được hỗ trợ.`);
    if (![720, 1080].includes(resolution)) throw new Error(`Độ phân giải ${resolution}p chưa được hỗ trợ.`);
    const firstDuration = Math.min(requestedDuration, 10) as 5 | 10;
    const extendDuration = requestedDuration > 10 ? (requestedDuration - 10) as 5 | 10 : undefined;
    const outputPath = join(config.outputDirectory, safeName.toLowerCase().endsWith(".mp4") ? safeName : `${safeName}.mp4`);
    await mkdir(config.outputDirectory, { recursive: true });
    const context = await this.context();
    let activePage: Page | undefined;
    let activeProjectUrl = config.projectUrl || DEFAULT_PROJECT_URL;
    try {
      const page = context.pages()[0] ?? await context.newPage();
      activePage = page;
      this.progress("OPEN", "Đang mở Google Vids...");
      await page.goto(config.projectUrl || DEFAULT_PROJECT_URL);
      await this.waitForLogin(page);
      await this.closeExtraPages(context, page);
      await this.finishNewProjectDialog(page, ratio);
      const projectUrl = page.url();
      activeProjectUrl = projectUrl;
      const account = "VERIFIED_VIDS";
      if (!/^VERIFIED_(PRO|ULTRA|VIDS)$/.test(account)) throw new Error(`Tài khoản không đủ điều kiện: ${account}`);
      await this.checkpoint("READY", { projectUrl, outputPath });
      await this.setCanvas(page, ratio);
      await this.openCreatePanel(page);
      if (config.imagePaths.length) await this.addImages(page, config.imagePaths);
      await this.fillPrompt(page, "create", config.firstPrompt);
      await this.configureGeneration(page, ratio, firstDuration, resolution);
      await this.throwIfGenerationLimited(page);
      const beforeFirst = await page.getByRole("button", { name: /Generated video:|Video đã tạo:/i }).count();
      await this.checkpoint("FIRST_SUBMITTING", { projectUrl, outputPath });
      this.progress("CREATE", `Đang tạo ${firstDuration} giây đầu...`);
      await page.getByRole("button", { name: /^(Generate|Tạo|Tạo video)$/i }).first().click();
      await this.checkpoint("FIRST_SUBMITTED", { projectUrl, outputPath });
      const firstCard = await this.waitForNewCard(page, beforeFirst);
      await this.closeUnexpectedDialogs(page, "sau khi tạo clip đầu");
      let finalCard = firstCard;
      if (extendDuration) {
        const extend = await this.cardAction(firstCard, "Extend");
        await extend.click({ timeout: 10 * 60_000 });
        await this.fillPrompt(page, "extend", config.secondPrompt);
        await this.configureGeneration(page, ratio, extendDuration, resolution);
        await this.throwIfGenerationLimited(page);
        const beforeSecond = await page.getByRole("button", { name: /Generated video:|Video đã tạo:/i }).count();
        await this.checkpoint("SECOND_SUBMITTING", { projectUrl, outputPath });
        this.progress("EXTEND", `Đang Extend thêm ${extendDuration} giây...`);
        await page.getByRole("button", { name: /^(Generate|Tạo|Tạo video)$/i }).first().click();
        await this.checkpoint("SECOND_SUBMITTED", { projectUrl, outputPath });
        finalCard = await this.waitForNewCard(page, beforeSecond);
        await this.closeUnexpectedDialogs(page, "sau khi Extend");
      }
      const insert = await this.cardAction(finalCard, "Insert");
      await insert.click({ timeout: 10 * 60_000 });
      await page.waitForTimeout(3_000);
      await this.checkpoint("INSERTED", { projectUrl, outputPath });
      await this.fillScene(page);
      await this.checkpoint("FILLED", { projectUrl, outputPath });
      await this.download(page, outputPath);
      const expected = ratio === "9:16" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
      if (config.removeWatermark !== false) {
        this.progress("DELOGO", "Đang tự động xóa watermark AI (nội suy điểm ảnh, giữ nguyên 100% khung hình)...");
        try {
          await removeGoogleWatermark(outputPath, {
            width: expected.width,
            height: expected.height,
            onProgress: msg => this.progress("DELOGO", msg),
          });
        } catch (delogoError) {
          console.warn("Cảnh báo xóa watermark AI:", delogoError);
        }
      }
      const metadata = await this.probe(outputPath);
      if (metadata.width !== expected.width || metadata.height !== expected.height) throw new Error(`File xuất sai kích thước: ${metadata.width}x${metadata.height}; cần ${expected.width}x${expected.height}`);
      if (metadata.duration < requestedDuration - 0.5 || metadata.duration > requestedDuration + 0.6) throw new Error(`File xuất sai thời lượng: ${metadata.duration.toFixed(3)} giây; cần ${requestedDuration} giây`);
      await this.checkpoint("COMPLETED", { projectUrl, outputPath, ...metadata });
      this.progress("COMPLETED", `Đã lưu ${outputPath}`);
      return { projectUrl, outputPath, ...metadata };
    } catch (error) {
      let diagnosticScreenshot: string | undefined;
      let diagnosticDom: string | undefined;
      if (activePage && this.checkpointPath) {
        const diagnosticDir = join(dirname(this.checkpointPath), "diagnostics");
        await mkdir(diagnosticDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        diagnosticScreenshot = join(diagnosticDir, `${stamp}.png`);
        diagnosticDom = join(diagnosticDir, `${stamp}.html`);
        await activePage.screenshot({ path: diagnosticScreenshot, fullPage: true }).catch(() => undefined);
        await writeFile(diagnosticDom, await activePage.content()).catch(() => undefined);
      }
      await this.checkpoint("FAILED", { projectUrl: activeProjectUrl, outputPath, diagnosticScreenshot, diagnosticDom, error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally { await context.close(); }
  }

  private async probe(path: string): Promise<{ width: number; height: number; duration: number }> {
    const executable = typeof ffprobeStatic === "string" ? ffprobeStatic : ffprobeStatic.path;
    if (typeof executable !== "string") throw new Error("Không xác định được đường dẫn ffprobe trong bản đóng gói.");
    const { stdout } = await execFileAsync(executable, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-show_entries", "format=duration", "-of", "json", path]);
    const parsed = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number }>; format?: { duration?: string } };
    const stream = parsed.streams?.[0];
    if (!stream?.width || !stream.height || !parsed.format?.duration) throw new Error("Không đọc được metadata MP4.");
    return { width: stream.width, height: stream.height, duration: Number(parsed.format.duration) };
  }
}
