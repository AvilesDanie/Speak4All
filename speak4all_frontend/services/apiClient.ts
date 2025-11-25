// Generic API client helpers
// Centraliza la base y manejo de headers. Usa NEXT_PUBLIC_API_BASE_URL si está definida.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface RequestOptions extends RequestInit {
  token?: string | null;
  skipJson?: boolean; // para endpoints que retornan 204 sin cuerpo
}

export async function fetchJSON<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, skipJson, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });
  if (!res.ok) {
    const text = await safeReadText(res);
    throw new Error(`API ${path} ${res.status}: ${text}`);
  }
  if (skipJson || res.status === 204) {
    // @ts-expect-error intencional para devolver undefined como T
    return undefined;
  }
  return res.json() as Promise<T>;
}

async function safeReadText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return '<no-text>'; }
}

// Helper para construir query strings
export function buildQuery(params: Record<string, any | undefined>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}
