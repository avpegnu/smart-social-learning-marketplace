const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// --- Types ---

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  field?: string;
}

// --- Server-side fetch (Server Components) ---

export async function serverFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refreshToken')?.value;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(refreshToken && { Cookie: `refreshToken=${refreshToken}` }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error: ApiError = await res.json();
    throw error;
  }

  return res.json();
}

// --- Client-side API (Client Components) ---

class ApiClient {
  private accessToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  // Callbacks wired by AuthProvider
  onRefresh?: (token: string) => void;
  onLogout?: () => void;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async fetch<T>(path: string, options?: RequestInit, _isRetry = false): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken && {
          Authorization: `Bearer ${this.accessToken}`,
        }),
        ...options?.headers,
      },
    });

    // 401 → token expired, try refresh once
    if (res.status === 401 && this.accessToken && !_isRetry) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.fetch<T>(path, options, true);
      }
      this.handleLogout();
      throw {
        code: 'TOKEN_EXPIRED',
        statusCode: 401,
        message: 'Session expired',
      } as ApiError;
    }

    if (!res.ok) {
      const error: ApiError = await res.json();
      throw error;
    }

    return res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    // Deduplicate: if already refreshing, wait for that result
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;

      const data = await res.json();
      const newToken = data.data?.accessToken;
      if (!newToken) return false;

      this.accessToken = newToken;
      this.onRefresh?.(newToken);
      return true;
    } catch {
      return false;
    }
  }

  private handleLogout() {
    this.accessToken = null;
    this.onLogout?.();
  }

  // --- Convenience methods ---

  async get<T>(path: string, params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.fetch<T>(`${path}${query}`);
  }

  async post<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown) {
    return this.fetch<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async del<T>(path: string) {
    return this.fetch<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
