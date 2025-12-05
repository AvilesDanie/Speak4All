import { API_BASE, fetchJSON } from './apiClient';

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: 'THERAPIST' | 'STUDENT';
  created_at: string;
  avatar_path?: string | null;
  has_password?: boolean; // Indica si el usuario tiene contraseña configurada
}

export interface ProfileUpdateData {
  full_name?: string;
  email?: string;
}

export interface ChangePasswordData {
  current_password?: string; // Opcional para usuarios sin contraseña previa
  new_password: string;
}

/**
 * Obtener perfil del usuario actual
 */
export async function getMyProfile(token: string): Promise<UserProfile> {
  return fetchJSON<UserProfile>('/users/me', { token });
}

/**
 * Actualizar perfil del usuario actual
 */
export async function updateMyProfile(
  token: string,
  data: ProfileUpdateData
): Promise<UserProfile> {
  return fetchJSON<UserProfile>('/users/me', {
    method: 'PUT',
    token,
    body: JSON.stringify(data),
  });
}

/**
 * Subir avatar del usuario
 */
export async function uploadAvatar(token: string, file: File): Promise<UserProfile> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/users/me/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Eliminar avatar del usuario
 */
export async function deleteAvatar(token: string): Promise<UserProfile> {
  return fetchJSON<UserProfile>('/users/me/avatar', {
    method: 'DELETE',
    token,
  });
}

/**
 * Obtener URL del avatar del usuario
 */
export async function getMyAvatarUrl(token: string): Promise<{ url: string | null }> {
  return fetchJSON<{ url: string | null }>('/users/me/avatar-url', { token });
}

/**
 * Cambiar contraseña del usuario
 */
export async function changePassword(
  token: string,
  data: ChangePasswordData
): Promise<{ message: string }> {
  return fetchJSON<{ message: string }>('/users/me/change-password', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}
