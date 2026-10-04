import type { Page } from 'playwright';
import { ControlResolver } from '../reliability/ControlResolver.js';
import { ProviderError } from '../reliability/ProviderErrors.js';
import { generationControls, navigationControls } from './selectors/index.js';
import { recognizeDolaPage } from './PageRecognition.js';

export type DolaObservableState =
  | 'GENERATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SESSION_EXPIRED'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN';
export interface DolaObserveOptions {
  returnOnGenerating?: boolean | undefined;
  pollMs?: number | undefined;
  expectedGenerationId?: string | undefined;
  submittedAt?: number | undefined;
}

const providerRejection = /video generation currently supports durations|nearest supported duration|unable to generate|cannot generate (?:this|the|your) video/i;

export const observeDolaGeneration = async (
  page: Page,
  timeoutMs = 30 * 60_000,
  options: DolaObserveOptions = {},
): Promise<DolaObservableState> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const recognition = await recognizeDolaPage(page);
    if (recognition.state === 'LOGIN_REQUIRED') return 'SESSION_EXPIRED';
    const rejection = page.getByText(providerRejection).last();
    if (await rejection.isVisible().catch(() => false)) {
      const message = (await rejection.innerText().catch(() => 'Dola rejected the generation request.')).trim();
      throw new ProviderError('GENERATION_FAILED', message);
    }
    const resolver = new ControlResolver(page);
    if ((await resolver.resolve(generationControls.failed)).state === 'FOUND') return 'FAILED';
    if (recognition.state === 'RESULT_READY') {
      const complete = await resolver.resolve(generationControls.completed);
      if (complete.state === 'FOUND' && complete.locator) {
        const id = await complete.locator.getAttribute('data-generation-id');
        const timestamp = Number(await complete.locator.getAttribute('data-created-at'));
        if (options.expectedGenerationId && id && id !== options.expectedGenerationId) return 'UNKNOWN';
        if (options.submittedAt && timestamp && timestamp < options.submittedAt) return 'UNKNOWN';
        return 'COMPLETED';
      }
    }
    if (recognition.state === 'GENERATION_RUNNING' && options.returnOnGenerating !== false)
      return 'GENERATING';
    if ((await resolver.resolve(navigationControls.login)).state === 'FOUND')
      return 'SESSION_EXPIRED';
    await page.waitForTimeout(options.pollMs ?? 1500);
  }
  throw new ProviderError('GENERATION_TIMEOUT', 'Generation monitoring timed out.');
};
