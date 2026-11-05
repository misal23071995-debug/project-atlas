import "server-only";
import { createHash } from "node:crypto";
import { getSupabase } from "@/app/lib/db/supabase";
import { sendEmail } from "@/app/lib/email/provider";
import { allow } from "@/app/lib/rate-limit";

export interface ErrorReport {
  message: string;
  digest?: string | null;
  stack?: string | null;
  method?: string | null;
  path?: string | null;
  kind?: string | null;
  route?: string | null;
}

// Query strings can carry tokens or search terms; keep only the path
const cleanPath = (path?: string | null) => (path ? path.split("?")[0].slice(0, 300) : null);

// Saves the error and, if ALERT_EMAIL is set and email is connected, emails it, at most once an hour per error.
// Never throws: reporting an error must not cause another one.
export async function recordError(report: ErrorReport) {
  try {
    const message = report.message.slice(0, 1000) || "Unknown error";
    await getSupabase().from("error_events").insert({
      message,
      digest: report.digest?.slice(0, 100) ?? null,
      stack: report.stack?.slice(0, 4000) ?? null,
      method: report.method?.slice(0, 10) ?? null,
      path: cleanPath(report.path),
      kind: report.kind?.slice(0, 20) ?? null,
      route: report.route?.slice(0, 200) ?? null,
    });

    const to = process.env.ALERT_EMAIL?.trim();
    if (!to) return;
    const fingerprint = createHash("sha256").update(message).digest("hex").slice(0, 16);
    if (!(await allow("errorAlert", fingerprint))) return;
    await sendEmail({
      to,
      fromName: "Atlas alerts",
      subject: `Atlas error: ${message.slice(0, 80)}`,
      text: [
        `An error happened on the live site.`,
        `Message: ${message}`,
        `Where: ${report.method ?? ""} ${cleanPath(report.path) ?? "unknown"} (${report.kind ?? "unknown"})`,
        report.digest ? `Error id: ${report.digest}` : "",
        `All errors are in the error_events table in Supabase. You'll get at most one email an hour for this error.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  } catch (err) {
    console.error("Could not record the error:", err);
  }
}
