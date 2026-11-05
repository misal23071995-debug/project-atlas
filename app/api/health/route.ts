import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/db/supabase";

// For uptime monitors (e.g. UptimeRobot): 200 when the app and database answer, 503 when not.
// Public, and says nothing about any workspace.
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const { error } = await getSupabase().from("organizations").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, database: "up", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, database: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
