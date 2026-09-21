import type { ControlDefinition } from '../../reliability/ControlResolver.js';
export const navigationControls = {
  authenticated: { id: 'authenticated_marker', requireEnabled: false, candidates: [{ strategy: 'testId', value: 'user-menu' }, { strategy: 'css', value: "[aria-label*='account' i]" }] },
  login: { id: 'login_control', candidates: [{ strategy: 'testId', value: 'login-button' }, { strategy: 'role', role: 'button', name: /log\s*in|sign\s*in/i }, { strategy: 'role', role: 'link', name: /log\s*in|sign\s*in/i }] },
  generationLandmark: { id: 'generation_landmark', requireEnabled: false, candidates: [{ strategy: 'testId', value: 'video-generation' }, { strategy: 'css', value: "main[aria-label*='generation' i]" }] },
} satisfies Record<string, ControlDefinition>;
