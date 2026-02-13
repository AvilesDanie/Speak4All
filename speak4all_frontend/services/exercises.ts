// Centralized API service for exercise-related endpoints

import { buildQuery, fetchJSON, normalizeBackendUrl } from './apiClient';

// ==== PAGINATION ====
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ExerciseOut {
  id: number;
  name: string;
  prompt?: string | null;
  text: string;
  audio_path: string;
  created_at: string;
  folder_id?: number | null;
}

export interface ExerciseFolder {
  id: number;
  therapist_id: number;
  name: string;
  color?: string | null;
  created_at: string;
}

interface FetchOptions extends RequestInit {
  token: string;
}

// Reutilizamos fetchJSON desde apiClient

export async function getMyExercises(
  token: string,
  page = 1,
  pageSize = 10,
  folderId?: number | null
): Promise<PaginatedResponse<ExerciseOut>> {
  let url = `/exercises/mine?page=${page}&page_size=${pageSize}`;
  if (folderId !== null && folderId !== undefined) {
    url += `&folder_id=${folderId}`;
  }
  return fetchJSON<PaginatedResponse<ExerciseOut>>(url, { token, method: 'GET' });
}

export async function getFolders(token: string): Promise<ExerciseFolder[]> {
  return fetchJSON<ExerciseFolder[]>('/exercise-folders/', { token, method: 'GET' });
}

export async function deleteExercise(exerciseId: number, token: string): Promise<void> {
  await fetchJSON<void>(`/exercises/${exerciseId}`, { token, method: 'DELETE' });
}

export async function assignExerciseFolder(
  exerciseId: number,
  token: string,
  folderId: number | null
): Promise<ExerciseOut> {
  const query = folderId !== null ? buildQuery({ folder_id: folderId }) : '';
  return fetchJSON<ExerciseOut>(`/exercises/${exerciseId}/folder${query}`, {
    token,
    method: 'PATCH',
  });
}

export async function createFolder(
  token: string,
  name: string,
  color: string
): Promise<ExerciseFolder> {
  return fetchJSON<ExerciseFolder>('/exercise-folders/', {
    token,
    method: 'POST',
    body: JSON.stringify({ name, color: color.startsWith('#') ? color : `#${color}` }),
  });
}

export async function deleteFolder(folderId: number, token: string): Promise<void> {
  await fetchJSON<void>(`/exercise-folders/${folderId}`, { token, method: 'DELETE' });
}

// Exercise preview (AI generation)
export interface ExercisePreview {
  text: string;
  marked_text: string;
}

export function generateExercisePreview(token: string, prompt: string, profileId?: number | null) {
  return fetchJSON<ExercisePreview>('/exercises/preview', {
    token,
    method: 'POST',
    body: JSON.stringify({ prompt, profile_id: profileId ?? null }),
  });
}

export function createExercise(
  token: string,
  name: string,
  text: string,
  markedText: string,
  prompt: string,
  profileId?: number | null
) {
  return fetchJSON<ExerciseOut>('/exercises/', {
    token,
    method: 'POST',
    body: JSON.stringify({
      name,
      prompt,
      text,
      marked_text: markedText,
      profile_id: profileId ?? null,
    }),
  });
}

export async function getExerciseAudioUrl(exerciseId: number, token: string): Promise<string> {
  const data = await fetchJSON<{ url: string }>(`/exercises/${exerciseId}/audio-url`, { 
    token, 
    method: 'GET' 
  });
  return normalizeBackendUrl(data.url) || data.url;
}

export async function getSubmissionMediaUrl(submissionId: number, token: string): Promise<string> {
  const data = await fetchJSON<{ url: string }>(`/submissions/${submissionId}/media-url`, { 
    token, 
    method: 'GET' 
  });
  return normalizeBackendUrl(data.url) || data.url;
}

export async function getExercisePdfUrl(exerciseId: number, token: string): Promise<string> {
  const data = await fetchJSON<{ url: string }>(`/exercises/${exerciseId}/pdf-url`, { 
    token, 
    method: 'GET' 
  });
  return normalizeBackendUrl(data.url) || data.url;
}
