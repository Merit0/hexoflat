import { getAuthToken } from './auth-token';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Nest's ZodValidationPipe rejects with `{ statusCode, error, message }`
// where `message` is the raw array of zod issues (see zod-validation.pipe.ts).
export type ApiValidationIssue = { message?: string; path?: Array<string | number> };
export type ApiErrorBody = {
  statusCode?: number;
  error?: string;
  message?: string | ApiValidationIssue[];
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const raw = await response.text();
    let body: ApiErrorBody | undefined;
    try {
      body = raw ? (JSON.parse(raw) as ApiErrorBody) : undefined;
    } catch {
      // Not a JSON error body — fall through and use the raw text below.
    }
    throw new ApiError(response.status, raw || response.statusText, body);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};
