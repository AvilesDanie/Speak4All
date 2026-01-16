import { fetchJSON } from './apiClient';

export interface Profile {
  id: number;
  therapist_id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export function getProfiles(token: string) {
  return fetchJSON<Profile[]>('/profiles/', { token, method: 'GET' });
}

export function createProfile(token: string, name: string, description: string) {
  return fetchJSON<Profile>('/profiles/', {
    token,
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function updateProfile(token: string, profileId: number, name: string, description: string) {
  return fetchJSON<Profile>(`/profiles/${profileId}`, {
    token,
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });
}

export function deleteProfile(token: string, profileId: number) {
  return fetchJSON<void>(`/profiles/${profileId}`, {
    token,
    method: 'DELETE',
    skipJson: true,
  });
}
