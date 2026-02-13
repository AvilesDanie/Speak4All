// Generic API client helpers
// Centraliza la base y manejo de headers usando la API interna de Next.

export const API_BASE = '/api/backend';

export function normalizeBackendUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith(API_BASE)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

export function mediaPathToUrl(mediaPath?: string | null): string | null {
  if (!mediaPath) return null;
  if (mediaPath.startsWith('http')) return mediaPath;
  const normalized = mediaPath.startsWith('/media/')
    ? mediaPath
    : mediaPath.startsWith('/')
    ? `/media${mediaPath}`
    : `/media/${mediaPath}`;
  return normalizeBackendUrl(normalized);
}

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
    // Intentar parsear el mensaje de error del backend
    let errorMessage = text;
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.detail || errorData.message || text;
    } catch {
      // Si no es JSON, usar el texto tal cual
    }
    throw new Error(errorMessage);
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
