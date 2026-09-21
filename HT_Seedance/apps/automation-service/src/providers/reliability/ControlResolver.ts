import type { Locator, Page } from 'playwright';

export type ControlResolutionState = 'FOUND' | 'NOT_FOUND' | 'AMBIGUOUS' | 'DISABLED' | 'HIDDEN';
export type SelectorCandidate =
  | { strategy: 'testId'; value: string }
  | { strategy: 'role'; role: 'button' | 'textbox' | 'link' | 'option' | 'dialog'; name?: string | RegExp; exact?: boolean }
  | { strategy: 'label'; value: string | RegExp; exact?: boolean }
  | { strategy: 'text'; value: string | RegExp; exact?: boolean }
  | { strategy: 'css'; value: string };

export interface ControlDefinition { id: string; candidates: readonly SelectorCandidate[]; requireEnabled?: boolean }
export interface ControlResolution {
  state: ControlResolutionState;
  controlId: string;
  selectedStrategy?: SelectorCandidate['strategy'];
  selectedCandidate?: number;
  matchCount: number;
  tried: Array<{ strategy: SelectorCandidate['strategy']; matches: number; visible: number }>;
  locator?: Locator;
}

const candidateLocator = (page: Page, candidate: SelectorCandidate): Locator => {
  switch (candidate.strategy) {
    case 'testId': return page.getByTestId(candidate.value);
    case 'role': return page.getByRole(candidate.role, { ...(candidate.name ? { name: candidate.name } : {}), ...(candidate.exact === undefined ? {} : { exact: candidate.exact }) });
    case 'label': return page.getByLabel(candidate.value, candidate.exact === undefined ? {} : { exact: candidate.exact });
    case 'text': return page.getByText(candidate.value, candidate.exact === undefined ? {} : { exact: candidate.exact });
    case 'css': return page.locator(candidate.value);
  }
};

export class ControlResolver {
  constructor(private readonly page: Page) {}

  async resolve(definition: ControlDefinition): Promise<ControlResolution> {
    const tried: ControlResolution['tried'] = [];
    for (let index = 0; index < definition.candidates.length; index += 1) {
      const candidate = definition.candidates[index]!;
      const locator = candidateLocator(this.page, candidate);
      const count = await locator.count();
      const visible: Locator[] = [];
      for (let match = 0; match < count; match += 1) {
        const item = locator.nth(match);
        if (await item.isVisible().catch(() => false)) visible.push(item);
      }
      tried.push({ strategy: candidate.strategy, matches: count, visible: visible.length });
      if (visible.length > 1) return { state: 'AMBIGUOUS', controlId: definition.id, selectedStrategy: candidate.strategy, selectedCandidate: index, matchCount: visible.length, tried };
      if (visible.length === 1) {
        const selected = visible[0]!;
        if (definition.requireEnabled !== false && !(await selected.isEnabled().catch(() => false)))
          return { state: 'DISABLED', controlId: definition.id, selectedStrategy: candidate.strategy, selectedCandidate: index, matchCount: 1, tried, locator: selected };
        return { state: 'FOUND', controlId: definition.id, selectedStrategy: candidate.strategy, selectedCandidate: index, matchCount: 1, tried, locator: selected };
      }
    }
    const total = tried.reduce((sum, item) => sum + item.matches, 0);
    return { state: total ? 'HIDDEN' : 'NOT_FOUND', controlId: definition.id, matchCount: total, tried };
  }
}
