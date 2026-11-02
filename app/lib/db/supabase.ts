import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Server-side client using the secret key. Never import this from a Client Component.
export function getSupabase() {
  if (client) return client;

  // Trim stray spaces or line breaks picked up when pasting into a hosting dashboard
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local and restart the dev server."
    );
  }

  // Safe to log: the project host plus the key's public prefix and length, never the secret part
  console.info(
    `Supabase: ${new URL(url).host}, key ${key.slice(0, 10)}… (${key.length} chars)`
  );

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
