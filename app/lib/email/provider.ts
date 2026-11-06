import "server-only";

// Sends email through Resend when RESEND_API_KEY and EMAIL_FROM are set. Without them nothing is sent,
// and each message is recorded as "not sent", so the rest of the email channel works for demos.
// To use another provider, change sendEmail; nothing else needs to know which one it is.

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  fromName?: string | null;
  // Message-ID of the customer's email we're answering, so mail apps thread it
  inReplyTo?: string | null;
  // Files the provider downloads from these links and attaches
  attachments?: { filename: string; url: string }[];
}

export type SendResult = { status: "sent"; id: string | null } | { status: "not_sent" | "failed"; note: string };

export function emailConnection() {
  const from = process.env.EMAIL_FROM?.trim();
  return process.env.RESEND_API_KEY && from ? { provider: "Resend", from } : null;
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const connection = emailConnection();
  if (!connection) return { status: "not_sent", note: "Email sending isn't connected yet" };

  const from = email.fromName ? `${email.fromName.replace(/["<>]/g, "")} <${connection.from}>` : connection.from;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(process.env.EMAIL_REPLY_TO && { reply_to: process.env.EMAIL_REPLY_TO }),
        ...(email.inReplyTo && { headers: { "In-Reply-To": email.inReplyTo, References: email.inReplyTo } }),
        ...(email.attachments?.length && { attachments: email.attachments.map((a) => ({ filename: a.filename, path: a.url })) }),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) return { status: "failed", note: body.message ?? `The email provider said ${response.status}` };
    return { status: "sent", id: body.id ?? null };
  } catch (err) {
    return { status: "failed", note: err instanceof Error ? err.message : "Could not reach the email provider" };
  }
}
