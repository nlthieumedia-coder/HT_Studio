import type { Download, Page } from 'playwright';
import { ControlResolver } from '../reliability/ControlResolver.js';
import { ProviderError } from '../reliability/ProviderErrors.js';
import { observeDolaGeneration } from './DolaMonitoring.js';
import { resultControls } from './selectors/index.js';
import { dolaTimeouts } from './DolaTimeouts.js';

export interface DolaBrowserDownload { download: Download; suggestedFilename: string; url: string; title: string }
export interface DolaResultContext { submittedAt: number; generationId?: string | undefined }

export const captureDolaBrowserDownload = async (page: Page, context: DolaResultContext): Promise<DolaBrowserDownload> => {
  const state = await observeDolaGeneration(page, dolaTimeouts.generation, {
    returnOnGenerating: false,
    submittedAt: context.submittedAt,
    expectedGenerationId: context.generationId,
  });
  if (state === 'SESSION_EXPIRED') throw new ProviderError('SESSION_EXPIRED', 'Session expired before download.');
  if (state !== 'COMPLETED') throw new ProviderError(state === 'FAILED' ? 'GENERATION_FAILED' : 'GENERATION_STATE_UNKNOWN', `Result state is ${state}.`);
  const resolver = new ControlResolver(page);
  const result = await resolver.resolve(resultControls.result);
  const download = await resolver.resolve(resultControls.download);
  if (result.state !== 'FOUND') throw new ProviderError('RESULT_NOT_FOUND', 'A unique current result was not found.', { state: result.state });
  if (download.state === 'AMBIGUOUS') throw new ProviderError('AMBIGUOUS_CONTROL', 'Download action is ambiguous.');
  if (download.state !== 'FOUND' || !download.locator) throw new ProviderError('RESULT_NOT_FOUND', 'Download action was not found.');
  try {
    const [event] = await Promise.all([page.waitForEvent('download', { timeout: dolaTimeouts.download }), download.locator.click()]);
    return { download: event, suggestedFilename: event.suggestedFilename(), url: page.url(), title: await page.title().catch(() => '') };
  } catch (error) {
    throw new ProviderError('DOWNLOAD_FAILED', error instanceof Error ? error.message : 'Download failed.');
  }
};
