import type { ControlDefinition } from '../../reliability/ControlResolver.js';
export const generationControls = {
  prompt: { id: 'prompt', candidates: [{ strategy: 'testId', value: 'prompt-input' }, { strategy: 'css', value: "textarea[name='prompt'], [contenteditable='true'][role='textbox']" }, { strategy: 'role', role: 'textbox', name: /describe|prompt/i }, { strategy: 'label', value: /prompt/i }] },
  generate: { id: 'generate', candidates: [{ strategy: 'testId', value: 'generate-button' }, { strategy: 'role', role: 'button', name: /^(generate|create)( video)?$/i }, { strategy: 'css', value: "#flow-end-msg-send, button[data-action='generate']" }] },
  generating: { id: 'generation_progress', requireEnabled: false, candidates: [{ strategy: 'testId', value: 'generation-progress' }, { strategy: 'css', value: "[role='progressbar'][aria-label*='generat' i]" }] },
  completed: { id: 'generation_complete', requireEnabled: false, candidates: [{ strategy: 'testId', value: 'generation-complete' }, { strategy: 'css', value: "[data-state='completed'][data-generation-id]" }] },
  failed: { id: 'generation_error', requireEnabled: false, candidates: [{ strategy: 'testId', value: 'generation-error' }, { strategy: 'css', value: "[role='alert'][data-provider-error]" }] },
} satisfies Record<string, ControlDefinition>;
