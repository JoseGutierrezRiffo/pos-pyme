import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { atom, useAtom } from 'jotai';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient = createClient(url ?? '', anonKey ?? '');

export const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

// Atom para negocio seleccionado (importado desde auth.ts)
// Re-export para方便
export { selectedBusinessAtom } from '@/atoms/auth';

// Función apiFetch con soporte automático para X-Business-ID
// Usa window.__selectedBusiness para obtener el negocio seleccionado
// (Se actualiza desde AuthGate)
let globalBusinessId: string | null = null;

export function setGlobalBusinessId(id: string | null) {
  globalBusinessId = id;
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token;

  if (!token) {
    console.log('[apiFetch] No token initially, waiting...');
    await new Promise((r) => setTimeout(r, 500));
    const { data: retryData } = await supabase.auth.getSession();
    token = retryData.session?.access_token;
    console.log('[apiFetch] Token after retry:', token ? 'found' : 'still missing');
  }

  // Merge headers: soportar both Record<string, string> y Headers object
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

  // Agregar X-Business-ID si está configurado globalmente
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
