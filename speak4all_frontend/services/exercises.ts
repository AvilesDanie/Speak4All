// Centralized API service for exercise-related endpoints
// Uses NEXT_PUBLIC_API_BASE_URL (defaults to http://localhost:8000)

import { API_BASE, fetchJSON } from './apiClient';

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

export async function getMyExercises(token: string): Promise<ExerciseOut[]> {
  return fetchJSON<ExerciseOut[]>('/exercises/mine', { token, method: 'GET' });
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
  const url = new URL(`${API_BASE}/exercises/${exerciseId}/folder`);
  if (folderId !== null) url.searchParams.set('folder_id', String(folderId));
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API /exercises/${exerciseId}/folder ${res.status}: ${text}`);
  }
  return res.json();
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

export function generateExercisePreview(token: string, prompt: string) {
  return fetchJSON<ExercisePreview>('/exercises/preview', {
    token,
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export function createExercise(token: string, name: string, text: string, markedText: string, prompt?: string | null) {
  return fetchJSON<ExerciseOut>('/exercises/', {
    token,
    method: 'POST',
    body: JSON.stringify({
      name,
      prompt: prompt ?? null,
      text,
      marked_text: markedText,
    }),
  });
}
