import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import type { VidsAdapter, GenerationResult } from "./adapter.js";
import type { AccountStatus, AspectRatio, VidsCapabilities } from "./domain.js";

export class PlaywrightVidsAdapter implements VidsAdapter {
  private context?: BrowserContext;
  private page?: Page;
  constructor(private readonly profileDir: string, private readonly projectUrl = "https://docs.google.com/videos/create") {}
  private async getPage(): Promise<Page> {
    if (this.page) return this.page;
    await mkdir(this.profileDir, { recursive: true });
    this.context = await chromium.launchPersistentContext(this.profileDir, {
      headless: false,
      channel: "chrome",
      acceptDownloads: true,
      chromiumSandbox: true,
      ignoreDefaultArgs: ["--enable-automation"],
    });
    this.page = this.context.pages()[0] ?? await this.context.newPage();
    await this.page.goto(this.projectUrl);
    return this.page;
  }
  private async waitForVidsLogin(page: Page, timeoutMs = 10 * 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let announced = false;
    while (Date.now() < deadline) {
      const url = page.url();
      const isVids = /^https:\/\/docs\.google\.com\/videos\//i.test(url);
      const isLoginPage = /accounts\.google\.com|ServiceLogin|AccountChooser/i.test(url);
      const hasLoginControl = await page.getByText(/Sign in|Đăng nhập/i).count().catch(() => 0) > 0;
      if (isVids && !isLoginPage && !hasLoginControl) {
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        return;
      }
      if (!announced) {
        console.log("LOGIN_REQUIRED: Chrome profile rieng dang mo. Hay tu dang nhap/2FA; survey se tu tiep tuc (toi da 10 phut).");
        announced = true;
      }
      await page.waitForTimeout(1_000);
    }
    throw new Error("LOGIN_TIMEOUT: khong thay Google Vids sau 10 phut. Profile da duoc luu; chay lai `npm.cmd run survey`.");
  }
  async survey(): Promise<VidsCapabilities> {
    const page = await this.getPage();
    await this.waitForVidsLogin(page);
    const aiVideo = page.getByRole("button", { name: /Generate an AI video clip|AI Video/i });
    if (await aiVideo.count()) await aiVideo.first().click();
    const settings = page.getByRole("button", { name: /Generation settings/i });
    if (await settings.count()) {
      await settings.first().click();
      await page.waitForTimeout(300);
    }
    const body = await page.locator("body").innerText();
    const controlLabels = await page.locator("[role=menuitem]:visible, [role=option]:visible, [role=radio]:visible").evaluateAll((nodes) =>
      nodes.flatMap((node) => [node.getAttribute("aria-label") ?? "", node.textContent ?? ""]),
    );
    const settingsLabel = await settings.first().getAttribute("aria-label").catch(() => "") ?? "";
    const observedText = [body, settingsLabel, ...controlLabels].join("\n");
    const durationText = [settingsLabel, ...controlLabels].join("\n");
    const durations = [...durationText.matchAll(/(\d{1,3})\s*(?:s(?:ec(?:ond)?s?)?|giây)/gi)].map((m) => Number(m[1]));
    const unique = [...new Set(durations)].filter((n) => n > 0 && n <= 120).sort((a, b) => a - b);
    const aspectRatios: AspectRatio[] = [];
    if (/Portrait|9\s*:\s*16/i.test(observedText)) aspectRatios.push("9:16");
    if (/Landscape|16\s*:\s*9/i.test(observedText)) aspectRatios.push("16:9");
    if (await settings.count()) await page.keyboard.press("Escape");
    return { createDurations: unique, extendDurations: [], aspectRatios, extendMode: "unknown", discoveredAt: new Date().toISOString() };
  }
  async accountStatus(): Promise<AccountStatus> {
    await this.getPage();
    const proofPage = await this.context!.newPage();
    try {
      await proofPage.goto("https://one.google.com/", { waitUntil: "domcontentloaded" });
      await proofPage.getByText(/Current plan/i).waitFor({ timeout: 30_000 });
      const text = await proofPage.locator("body").innerText();
      if (/Current plan[\s\S]{0,120}Google AI[\s\S]{0,40}Ultra/i.test(text)) return "VERIFIED_ULTRA";
      if (/Current plan[\s\S]{0,120}Google AI[\s\S]{0,40}Pro/i.test(text)) return "VERIFIED_PRO";
      if (/Current plan/i.test(text)) return "VERIFIED_INELIGIBLE";
      return "UNKNOWN_PLAN";
    } catch {
      return "UNKNOWN_PLAN";
    } finally {
      await proofPage.close();
    }
  }
  async create(_prompt: string, _durationSeconds: number, _ratio: AspectRatio): Promise<GenerationResult> { throw new Error("LIVE_CREATE_BLOCKED: selectors and account-plan evidence require a completed survey fixture."); }
  async extend(_previousId: string, _prompt: string, _durationSeconds: number): Promise<GenerationResult> { throw new Error("LIVE_EXTEND_BLOCKED: Extend semantics have not been observed end-to-end."); }
  async export(_resultId: string, _outputDirectory: string): Promise<string> { throw new Error("LIVE_EXPORT_BLOCKED: download path has not been verified."); }
}
