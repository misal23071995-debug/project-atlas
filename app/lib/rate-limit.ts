import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getSupabase } from "@/app/lib/db/supabase";

// Limits for public pages, counted in the database so they hold across every server instance.
// If the check itself fails (database down, migration 016 not run), requests are allowed:
// a broken limiter shouldn't lock customers out of support.

export const LIMITS = {
  // Customer chat: new chats per visitor per hour, and messages per visitor per 10 minutes
  chatStart: { limit: 10, windowSeconds: 3600 },
  chatMessage: { limit: 40, windowSeconds: 600 },
  // Satisfaction survey submissions per visitor per hour
  survey: { limit: 30, windowSeconds: 3600 },
  // New workspaces per visitor per hour
  signup: { limit: 5, windowSeconds: 3600 },
  // Incoming emails per workspace per hour
  inboundEmail: { limit: 300, windowSeconds: 3600 },
  // Alert emails per distinct error per hour
  errorAlert: { limit: 1, windowSeconds: 3600 },
} as const;

export type LimitName = keyof typeof LIMITS;

// Visitors are counted by a hash of their IP address, so raw addresses are never stored
export async function visitorId() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`atlas:${ip}`).digest("hex").slice(0, 32);
}

// True if this request is within the limit (and counts it)
export async function allow(name: LimitName, who: string) {
  const { limit, windowSeconds } = LIMITS[name];
  try {
    const { data, error } = await getSupabase().rpc("hit_rate_limit", {
      p_key: `${name}:${who}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw new Error(error.message);
    return data !== false;
  } catch (err) {
    console.error("Rate limit check failed, allowing the request:", err);
    return true;
  }
}

export const TOO_MANY = "Too many requests from your connection. Please wait a few minutes and try again.";
