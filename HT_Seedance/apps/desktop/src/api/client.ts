const SERVICE_BASE_URL = 'http://127.0.0.1:3001';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'UNKNOWN',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private token = '';

  setToken(token: string): void {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    method: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
    if (this.token) headers.set('x-auth-token', this.token);
    const options: RequestInit = { headers, method };
    if (body !== undefined) options.body = JSON.stringify(body);
    if (signal) options.signal = signal;
    const response = await fetch(`${SERVICE_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
      const payload=await response.json().catch(()=>null) as {error?:{code?:string;message?:string}}|null;
      throw new ApiError(response.status,payload?.error?.message??`The local service returned ${response.status}.`,payload?.error?.code??'UNKNOWN');
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
  get<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, 'GET', undefined, signal);
  }
  async getText(endpoint: string): Promise<string> {
    const headers = new Headers();
    if (this.token) headers.set('x-auth-token', this.token);
    const response = await fetch(`${SERVICE_BASE_URL}${endpoint}`, { headers });
    if (!response.ok)
      throw new ApiError(response.status, `The local service returned ${response.status}.`);
    return response.text();
  }
  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, 'POST', body);
  }
  patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, 'PATCH', body);
  }
  put<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, 'PUT', body);
  }
  delete(endpoint: string): Promise<void> {
    return this.request<void>(endpoint, 'DELETE');
  }
}

export const apiClient = new ApiClient();

export const initializeApiClient = async (): Promise<void> => {
  const developmentToken = import.meta.env.VITE_HT_DOLA_AUTH_TOKEN;
  if (developmentToken) {
    apiClient.setToken(developmentToken);
    return;
  }
  if (!('__TAURI_INTERNALS__' in window)) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const token = await invoke<string>('get_automation_service_token');
    apiClient.setToken(token);
  } catch {
    // Browser-only development and a service that has not started both degrade safely.
  }
};
