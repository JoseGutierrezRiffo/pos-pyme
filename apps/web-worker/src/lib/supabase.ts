import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('⚠️ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
}

export const supabase = createClient(url ?? '', anonKey ?? '');

export const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  // Esperar a que haya sesión disponible (sirve para evitar race post-login)
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token;

  if (!token) {
    // Reintentar una vez tras 200ms (cubre el gap post-login)
    await new Promise((r) => setTimeout(r, 200));
    const { data: retryData } = await supabase.auth.getSession();
    token = retryData.session?.access_token;
  }

  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  // Leer el body como texto (puede ser vacío)
  const text = await res.text();

  if (!res.ok) {
    console.error(`[apiFetch] ${path} → ${res.status}`, text);
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
  }

  // Manejar respuestas vacías (204, body vacío)
  if (!text) return null as T;

  // Intentar parsear JSON
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`[apiFetch] ${path} → respuesta no es JSON válido`, text);
    throw new Error(`Respuesta no es JSON válido: ${text.slice(0, 100)}`);
  }
}
