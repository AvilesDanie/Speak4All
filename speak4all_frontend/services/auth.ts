import { fetchJSON } from './apiClient';

export type Role = 'THERAPIST' | 'STUDENT';

export interface BackendUser {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  google_sub?: string | null;
}

export interface Token {
  access_token: string;
}

export interface LoginResponse {
  token: Token;
  user: BackendUser;
}

// Email/password login
export async function login(email: string, password: string): Promise<LoginResponse> {
  return fetchJSON('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Email/password registration
export async function register(full_name: string, email: string, password: string, role: Role): Promise<LoginResponse> {
  return fetchJSON('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ full_name, email, password, role }),
  });
}

// Google login (id_token preferred). Provide either id_token OR (google_sub + email + full_name)
export async function loginGoogle(payload: {
  id_token?: string;
  google_sub?: string;
  email?: string;
  full_name?: string;
  role?: Role; // needed when creating a new user
}): Promise<LoginResponse> {
  return fetchJSON('/auth/google', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Check if a Google user exists
export async function checkGoogleUser(google_sub: string): Promise<{ exists: boolean }> {
  return fetchJSON('/auth/check', {
    method: 'POST',
    body: JSON.stringify({ google_sub }),
  });
}

// Get user by google_sub (no auth token required per backend implementation)
export async function getUserByGoogleSub(google_sub: string): Promise<BackendUser> {
  const url = `/auth/me?google_sub=${encodeURIComponent(google_sub)}`;
  return fetchJSON(url, { method: 'GET' });
}

// Helper: persist login response in localStorage
export function persistLogin(response: LoginResponse) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('backend_token', response.token.access_token);
  window.localStorage.setItem('backend_user', JSON.stringify(response.user));
}

// Helper: clear stored session
export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('backend_token');
  window.localStorage.removeItem('backend_user');
}
