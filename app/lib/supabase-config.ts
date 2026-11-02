// Shared by proxy.ts and server code. Read on the server only: these
// variables are not exposed to the browser.
export function getSupabaseConfig() {
  // Trim stray spaces or line breaks picked up when pasting into a hosting dashboard
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local and restart the dev server."
    );
  }

  return { url, key };
}
