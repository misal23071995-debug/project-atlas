import { NextResponse, type NextRequest } from "next/server";
import { findOrgByInboundKey, receiveEmail } from "@/app/lib/db/email";
import { normalizeInbound } from "@/app/lib/email/parse";

// Incoming mail webhook. The email provider posts each email here; the secret key in the
// address says which workspace it's for (Settings → Email). No sign-in, so it's public in proxy.ts.

const MAX_BYTES = 2 * 1024 * 1024;
// Reading an email with the AI can take a few seconds
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const org = await findOrgByInboundKey((await params).key);
  if (!org) return NextResponse.json({ ok: false, error: "Unknown address" }, { status: 404 });

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "Email too large" }, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Send the email as JSON" }, { status: 400 });
  }

  const mail = normalizeInbound(payload);
  if (!mail) return NextResponse.json({ ok: false, error: "Need a sender address and some text" }, { status: 400 });

  try {
    const result = await receiveEmail(org, mail);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Inbound email failed:", err);
    // A 500 makes the provider retry later, which is what we want for a passing database error
    return NextResponse.json({ ok: false, error: "Could not save the email" }, { status: 500 });
  }
}
