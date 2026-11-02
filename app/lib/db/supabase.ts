import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/app/lib/supabase-config";

let client: SupabaseClient | null = null;

// Server-side client using the secret key. Never import this from a Client Component.
export function getSupabase() {
  if (client) return client;

  const { url, key } = getSupabaseConfig();

  // Safe to log: the project host plus the key's public prefix and length, never the secret part
  console.info(
    `Supabase: ${new URL(url).host}, key ${key.slice(0, 10)}… (${key.length} chars)`
  );

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
