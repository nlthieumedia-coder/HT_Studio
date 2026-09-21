export type DolaSessionState = 'AUTHENTICATED' | 'LOGIN_REQUIRED' | 'UNKNOWN' | 'ERROR';
export interface DolaSessionResult {
  state: DolaSessionState;
  url: string;
  title: string;
  error?: string;
}
