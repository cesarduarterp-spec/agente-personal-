import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Tactica } from './schema';
import { stateSchema, STORAGE_VERSION } from './schema';

/**
 * Integración opcional con Supabase.
 * - workspaces: copia en la nube del portafolio por usuario (RLS por auth.uid()).
 * - shared_snapshots: enlaces cortos públicos de solo lectura (?id=xxxx).
 * Si no hay variables de entorno, la app funciona 100 % local.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const cloudEnabled = supabase !== null;

function need(): SupabaseClient {
  if (!supabase) throw new Error('Supabase no está configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  return supabase;
}

export async function signInWithEmail(email: string) {
  const { error } = await need().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function currentUserEmail(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

export async function signOut() {
  await need().auth.signOut();
}

export async function pushWorkspace(tacticas: Tactica[]) {
  const sb = need();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error('Inicia sesión para sincronizar');
  const { error } = await sb.from('workspaces').upsert({
    user_id: u.user.id,
    v: STORAGE_VERSION,
    data: { tacticas },
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function pullWorkspace(): Promise<{ tacticas: Tactica[]; updatedAt: string } | null> {
  const sb = need();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error('Inicia sesión para sincronizar');
  const { data, error } = await sb.from('workspaces').select('data, updated_at').eq('user_id', u.user.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const parsed = stateSchema.safeParse(data.data);
  if (!parsed.success) throw new Error('Los datos en la nube no tienen un formato válido');
  return { tacticas: parsed.data.tacticas, updatedAt: data.updated_at as string };
}

export async function createShortLink(tacticas: Tactica[]): Promise<string> {
  const sb = need();
  const id = Math.random().toString(36).slice(2, 10);
  const { error } = await sb.from('shared_snapshots').insert({ id, v: STORAGE_VERSION, data: { tacticas } });
  if (error) throw error;
  return id;
}

export async function fetchShortLink(id: string): Promise<Tactica[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('shared_snapshots').select('data').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const parsed = stateSchema.safeParse(data.data);
  return parsed.success ? parsed.data.tacticas : null;
}
