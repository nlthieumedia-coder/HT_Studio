import type { Page } from 'playwright';
import { ProviderError } from '../reliability/ProviderErrors.js';
import { dolaTimeouts } from './DolaTimeouts.js';
export const DOLA_URL = 'https://dola.ai/';
export const openDola = async (page: Page) => {
  try { await page.goto(DOLA_URL, { waitUntil: 'domcontentloaded', timeout: dolaTimeouts.navigation }); await page.waitForLoadState('domcontentloaded'); }
  catch(error){throw new ProviderError(page.isClosed()?'BROWSER_CRASHED':'NAVIGATION_FAILED',error instanceof Error?error.message:'Dola navigation failed.');}
};
