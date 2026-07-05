// Reuse the singleton client from supabase.ts to avoid Multiple GoTrueClient warning
import { supabase } from './supabase';

export { supabase };

export const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

// Global business ID para X-Business-ID header
let globalBusinessId: string | null = null;

export function setGlobalBusinessId(id: string | null) {
  globalBusinessId = id;
}

export function getGlobalBusinessId(): string | null {
  return globalBusinessId;
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token;

  if (!token) {
    await new Promise((r) => setTimeout(r, 200));
    const { data: retryData } = await supabase.auth.getSession();
    token = retryData.session?.access_token;
  }

  // Merge headers
  const existingHeaders = init.headers ?? {};
  const existingHeadersObj =
    existingHeaders instanceof Headers
      ? Object.fromEntries(existingHeaders.entries())
      : (existingHeaders as Record<string, string>);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...existingHeadersObj,
  };

  // Agregar X-Business-ID si está configurado
  if (globalBusinessId) {
    headers['X-Business-ID'] = globalBusinessId;
  }

  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`[apiFetch] ${path} → ${res.status}`, text);
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
  }

  if (!text) return null as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Respuesta no es JSON válido: ${text.slice(0, 100)}`);
  }
}
