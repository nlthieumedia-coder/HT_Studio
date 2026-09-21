import type { ControlDefinition } from '../../reliability/ControlResolver.js';
export const modelControls = { model: { id: 'model', candidates: [{ strategy: 'testId', value: 'model-selector' }, { strategy: 'role', role: 'button', name: /model/i }, { strategy: 'label', value: /model/i }] } } satisfies Record<string, ControlDefinition>;
