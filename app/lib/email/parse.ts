// Turning an email provider's webhook into one shape, and the small text rules around email threads.

export interface InboundEmail {
  fromEmail: string;
  fromName: string;
  subject: string;
  text: string;
  // The email's Message-ID header, for spotting a webhook sent twice
  messageId: string | null;
  // Message-IDs this email replies to (In-Reply-To and References)
  replyTo: string[];
}

export const MAX_EMAIL_TEXT = 20000;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

type Json = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : "");

// "Priya Sharma <priya@example.com>" -> name and address
export function parseAddress(value: string) {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (match ? match[2] : value).trim().toLowerCase();
  return { email, name: (match?.[1] ?? "").trim() };
}

function messageIds(value: string) {
  return value.match(/<[^>]+>/g) ?? (value.trim() ? [value.trim()] : []);
}

// Removes a basic HTML body down to text, for providers that only send HTML
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Accepts Postmark's inbound webhook, or a simple { from, subject, text } shape any provider or script can send
export function normalizeInbound(payload: unknown): InboundEmail | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Json;

  let from: { email: string; name: string };
  let subject: string;
  let text: string;
  let messageId: string | null;
  let replyTo: string[] = [];

  if ("FromFull" in p || "TextBody" in p) {
    // Postmark
    const full = (p.FromFull ?? {}) as Json;
    from = { email: str(full.Email || p.From).toLowerCase(), name: str(full.Name || p.FromName) };
    subject = str(p.Subject);
    text = str(p.StrippedTextReply) || str(p.TextBody) || htmlToText(str(p.HtmlBody));
    const headers = Array.isArray(p.Headers) ? (p.Headers as Json[]) : [];
    const header = (name: string) => str(headers.find((h) => str(h.Name).toLowerCase() === name)?.Value);
    messageId = header("message-id") || str(p.MessageID) || null;
    replyTo = [...messageIds(header("in-reply-to")), ...messageIds(header("references"))];
  } else {
    const raw = p.from;
    from =
      raw && typeof raw === "object"
        ? { email: str((raw as Json).email).toLowerCase(), name: str((raw as Json).name) }
        : parseAddress(str(raw));
    if (str(p.fromName)) from.name = str(p.fromName);
    subject = str(p.subject);
    text = str(p.text) || htmlToText(str(p.html));
    messageId = str(p.messageId) || null;
    replyTo = [...messageIds(str(p.inReplyTo)), ...(Array.isArray(p.references) ? p.references.map(str) : messageIds(str(p.references)))];
  }

  if (!EMAIL.test(from.email)) return null;
  text = stripQuotedReply(text).slice(0, MAX_EMAIL_TEXT);
  if (!text && !subject.trim()) return null;

  return {
    fromEmail: from.email,
    fromName: from.name || from.email.split("@")[0],
    subject: subject.trim().slice(0, 300) || "(no subject)",
    text: text || subject.trim(),
    messageId: messageId?.slice(0, 300) ?? null,
    replyTo: [...new Set(replyTo.filter(Boolean))].slice(0, 20),
  };
}

// Keeps only the new part of a reply: drops "On <date>, X wrote:" and the quoted lines below it
export function stripQuotedReply(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const quoteStarts =
      /^\s*On .+wrote:\s*$/i.test(line) ||
      /^-{2,}\s*Original Message\s*-{2,}/i.test(line) ||
      // Outlook puts the quoted email's headers under the reply
      (out.length > 0 && /^\s*From: .+/.test(line));
    if (quoteStarts) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

// The ticket number in a subject like "Re: Ring not syncing [#5003]"
export function ticketRef(subject: string) {
  return subject.match(/\[#(\d{1,12})\]/)?.[1] ?? null;
}

export function subjectWithRef(subject: string, ticketId: string) {
  const clean = subject.replace(/\s*\[#\d+\]\s*/g, " ").replace(/^\s*((re|fwd?):\s*)+/i, "").trim();
  return `Re: ${clean} [#${ticketId}]`;
}
