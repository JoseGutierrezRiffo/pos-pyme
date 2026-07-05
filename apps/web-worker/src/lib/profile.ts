import { apiFetch } from './supabase';

export interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'worker';
  is_active: boolean;
}

export async function updateMyProfile(dto: { full_name?: string }) {
  return apiFetch<ProfileData>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
