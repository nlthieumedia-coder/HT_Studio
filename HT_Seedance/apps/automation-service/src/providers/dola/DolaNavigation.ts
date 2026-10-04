import type { Page } from 'playwright';
import { ProviderError } from '../reliability/ProviderErrors.js';
import { dolaTimeouts } from './DolaTimeouts.js';

export const DOLA_URL = 'https://www.dola.com/chat/create-image';

export const openDola = async (page: Page) => {
  try {
    await page.goto(DOLA_URL, {
      waitUntil: 'domcontentloaded',
      timeout: dolaTimeouts.navigation,
    });
    await page.waitForLoadState('domcontentloaded');
    await Promise.race([
      page.getByText('AI Creation', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 }),
      page.getByText(/log\s*in to unlock more features/i).waitFor({ state: 'visible', timeout: 15_000 }),
    ]).catch(() => {});
  } catch (error) {
    throw new ProviderError(
      page.isClosed() ? 'BROWSER_CRASHED' : 'NAVIGATION_FAILED',
      error instanceof Error ? error.message : 'Dola navigation failed.',
    );
  }
};

const dismissCookieNotice = async (page: Page) => {
  const okButton = page.getByRole('button', { name: 'OK', exact: true });
  if (await okButton.isVisible().catch(() => false)) await okButton.click().catch(() => {});
};

export const openDolaVideo = async (page: Page) => {
  await openDola(page);
  const loginPrompt = page.getByText(/log\s*in to unlock more features/i);
  if (await loginPrompt.isVisible().catch(() => false)) return;

  await dismissCookieNotice(page);
  const videoTab = page.getByRole('tab', { name: 'Video', exact: true });
  await videoTab.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {
    throw new ProviderError('CONTROL_NOT_FOUND', 'Không tìm thấy tab Video trên trang AI Creation.');
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if ((await videoTab.getAttribute('aria-selected')) === 'true') break;
    await videoTab.click({ force: attempt === 3 });
    await page.waitForTimeout(1_000);
  }

  try {
    if ((await videoTab.getAttribute('aria-selected')) !== 'true') {
      throw new Error('Video tab did not become active.');
    }
    await page.locator('p[data-placeholder*="video" i]').waitFor({ state: 'visible', timeout: 15_000 });
  } catch (error) {
    throw new ProviderError(
      'FORM_CHANGED',
      'Không thể chuyển sang tab Video của Dola sau 3 lần thử. Giao diện Dola có thể chưa tải xong hoặc đã thay đổi.',
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
};
