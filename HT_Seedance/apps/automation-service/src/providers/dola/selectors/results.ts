import type { ControlDefinition } from '../../reliability/ControlResolver.js';
export const resultControls = {
 result: { id: 'result', requireEnabled: false, candidates: [{ strategy: 'testId', value: 'generation-result' }, { strategy: 'css', value: "[data-generation-id] video" }] },
 download: { id: 'download', candidates: [{ strategy: 'testId', value: 'download-result' }, { strategy: 'role', role: 'button', name: /^download( result| video)?$/i }, { strategy: 'role', role: 'link', name: /^download( result| video)?$/i }] },
} satisfies Record<string, ControlDefinition>;
