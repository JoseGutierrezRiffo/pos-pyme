import { apiFetch } from './api-with-business';

export interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'worker';
  is_active: boolean;
}

export async function fetchMyProfile(): Promise<ProfileData> {
  return apiFetch<ProfileData>('/auth/me');
}

export async function updateMyProfile(dto: { full_name?: string }): Promise<ProfileData> {
  return apiFetch<ProfileData>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
