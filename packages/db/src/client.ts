import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export type TypedSupabaseClient = SupabaseClient<Database>;

// Client pour le serveur (Next.js API Routes / Edge Functions)
export function createServerClient(
  url: string,
  serviceRoleKey: string
): TypedSupabaseClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

// Client pour le navigateur avec persistence
export function createBrowserClient(
  url: string,
  anonKey: string
): TypedSupabaseClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

// Helper pour obtenir l'user courant depuis un session
export async function getCurrentUser(client: TypedSupabaseClient) {
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}

// Helper pour obtenir le tenant_id de l'user courant
export async function getUserTenantId(
  client: TypedSupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await client
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  return data?.tenant_id || null;
}

// Helper pour upload fichier
export async function uploadFile(
  client: TypedSupabaseClient,
  bucket: string,
  path: string,
  file: File | Blob
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) throw error;
  return data.path;
}

// Helper pour download fichier
export async function downloadFile(
  client: TypedSupabaseClient,
  bucket: string,
  path: string
): Promise<Blob> {
  const { data, error } = await client.storage
    .from(bucket)
    .download(path);

  if (error) throw error;
  return data;
}

// Helper pour signed URL
export async function getSignedUrl(
  client: TypedSupabaseClient,
  bucket: string,
  path: string,
  expiresIn: number = 3600 // 1 heure par défaut
): Promise<string> {
  const { data } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (!data?.signedUrl) throw new Error('Failed to create signed URL');
  return data.signedUrl;
}
