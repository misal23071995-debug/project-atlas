import "server-only";
import { saveCustomerFile, signedLink } from "./attachments";
import { getSupabase } from "./supabase";
import { getSlaTargets } from "./sla";
import { addActivity, addMessage, createTicket, updateTicket } from "./tickets";
import { onTicketCreated, runRules } from "./automation";
import { analyzeWithAI } from "@/app/lib/ai/service";
import { sendEmail, type SendResult } from "@/app/lib/email/provider";
import { subjectWithRef, ticketRef, type InboundEmail } from "@/app/lib/email/parse";
import { DEFAULT_SLA_TARGETS, formatMinutes, isDone } from "@/app/lib/sla";
import type { TicketPriority, TicketStatus } from "@/app/lib/tickets";

// The email channel for one workspace: incoming mail becomes tickets or replies on them,
// and agent replies, acknowledgements and survey links go back out by email.

export interface EmailSettings {
  inboundKey: string;
  fromName: string | null;
  signature: string;
  autoAcknowledge: boolean;
  surveyOnResolve: boolean;
}

type SettingsRow = {
  inbound_key: string;
  from_name: string | null;
  signature: string;
  auto_acknowledge: boolean;
  survey_on_resolve: boolean;
};

const SETTINGS_COLUMNS = "inbound_key, from_name, signature, auto_acknowledge, survey_on_resolve";

const toSettings = (row: SettingsRow): EmailSettings => ({
  inboundKey: row.inbound_key,
  fromName: row.from_name,
  signature: row.signature,
  autoAcknowledge: row.auto_acknowledge,
  surveyOnResolve: row.survey_on_resolve,
});

// Null until migration 013 has been run. Workspaces created after it get their row on first use.
export async function getEmailSettings(orgId: string): Promise<EmailSettings | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("email_settings")
    .select(SETTINGS_COLUMNS)
    .eq("org_id", orgId)
    .returns<SettingsRow[]>()
    .maybeSingle();

  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load email settings: ${error.message}`);
  if (data) return toSettings(data);

  const { data: created, error: createError } = await supabase
    .from("email_settings")
    .upsert({ org_id: orgId }, { onConflict: "org_id" })
    .select(SETTINGS_COLUMNS)
    .returns<SettingsRow[]>()
    .single();
  if (createError) throw new Error(`Failed to set up email: ${createError.message}`);
  return toSettings(created);
}

export async function saveEmailSettings(orgId: string, settings: Omit<EmailSettings, "inboundKey">) {
  const { error } = await getSupabase()
    .from("email_settings")
    .update({
      from_name: settings.fromName,
      signature: settings.signature,
      auto_acknowledge: settings.autoAcknowledge,
      survey_on_resolve: settings.surveyOnResolve,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);
  if (error) throw new Error(`Failed to save email settings: ${error.message}`);
}

// A new webhook address; the old one stops working at once
export async function regenerateInboundKey(orgId: string) {
  const { error } = await getSupabase()
    .from("email_settings")
    .update({ inbound_key: crypto.randomUUID(), updated_at: new Date().toISOString() })
    .eq("org_id", orgId);
  if (error) throw new Error(`Failed to change the address: ${error.message}`);
}

export async function findOrgByInboundKey(key: string) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) return null;
  const { data, error } = await getSupabase()
    .from("email_settings")
    .select("org:organizations (id, name, slug)")
    .eq("inbound_key", key)
    .returns<{ org: { id: string; name: string; slug: string } | null }[]>()
    .maybeSingle();
  if (error) throw new Error(`Failed to look up the workspace: ${error.message}`);
  return data?.org ?? null;
}

// ---- Incoming ----

// Simple rules on top of the AI's reading, since the AI doesn't set priority
export function emailPriority(text: string, sentiment: string): TicketPriority {
  if (/\b(urgent|asap|immediately|charged twice|double charged|fraud|unauthori[sz]ed|chargeback|lawyer)\b/i.test(text)) {
    return "High";
  }
  if (/angry/i.test(sentiment)) return "High";
  if (/positive/i.test(sentiment)) return "Low";
  return "Medium";
}

type TicketMatch = { id: number; subject: string; status: TicketStatus; customer: { email: string } | null };

async function findThread(orgId: string, mail: InboundEmail): Promise<TicketMatch | null> {
  const supabase = getSupabase();
  const fromSameCustomer = (t: TicketMatch | null) => (t && t.customer?.email === mail.fromEmail ? t : null);

  // The [#5003] tag our emails put in the subject
  const ref = ticketRef(mail.subject);
  if (ref) {
    const { data } = await supabase
      .from("tickets")
      .select("id, subject, status, customer:customers (email)")
      .eq("org_id", orgId)
      .eq("id", ref)
      .returns<TicketMatch[]>()
      .maybeSingle();
    // Only the ticket's own customer can add to it, so a guessed number can't post into someone else's ticket
    if (fromSameCustomer(data)) return data;
  }

  // Or a reply to one of the customer's earlier emails
  if (mail.replyTo.length) {
    const { data } = await supabase
      .from("ticket_messages")
      .select("ticket:tickets!inner (id, subject, status, org_id, customer:customers (email))")
      .in("email_message_id", mail.replyTo)
      .eq("ticket.org_id", orgId)
      .limit(1)
      .returns<{ ticket: TicketMatch }[]>();
    const match = fromSameCustomer(data?.[0]?.ticket ?? null);
    if (match) return match;
  }

  return null;
}

async function alreadyReceived(orgId: string, messageId: string | null) {
  if (!messageId) return null;
  const { data, error } = await getSupabase()
    .from("ticket_messages")
    .select("ticket_id, ticket:tickets!inner (org_id)")
    .eq("email_message_id", messageId)
    .eq("ticket.org_id", orgId)
    .limit(1);
  if (error) throw new Error(`Failed to check the email: ${error.message}`);
  return data[0] ? String(data[0].ticket_id) : null;
}

export interface ReceiveResult {
  ticketId: string;
  outcome: "created" | "replied" | "duplicate";
}

export async function receiveEmail(org: { id: string; name: string }, mail: InboundEmail): Promise<ReceiveResult> {
  const duplicate = await alreadyReceived(org.id, mail.messageId);
  if (duplicate) return { ticketId: duplicate, outcome: "duplicate" };

  const thread = await findThread(org.id, mail);
  if (thread) {
    const ticketId = String(thread.id);
    const messageId = await addMessage(org.id, ticketId, { sender: mail.fromName, role: "customer", message: mail.text }, { emailMessageId: mail.messageId });
    await saveEmailFiles(org.id, ticketId, messageId, mail);
    // A reply brings the ticket back to the queue, which also restarts or resumes its SLA clock
    if (thread.status !== "Open" && thread.status !== "Escalated") {
      await updateTicket(org.id, ticketId, { status: "Open" });
      await addActivity(org.id, ticketId, `Customer replied by email; reopened from ${thread.status}`, "bg-amber-500");
    } else {
      await addActivity(org.id, ticketId, "Customer replied by email", "bg-amber-500");
    }
    await runRules(org.id, ticketId, "customer_replied");
    return { ticketId, outcome: "replied" };
  }

  // A new conversation: the AI reads it the same way it reads chats and phone notes
  const { analysis } = await analyzeWithAI(`${mail.subject}\n\n${mail.text}`);
  const priority = emailPriority(`${mail.subject} ${mail.text}`, analysis.sentiment);
  const ticketId = await createTicket(org.id, {
    customerName: mail.fromName,
    customerEmail: mail.fromEmail,
    subject: mail.subject,
    description: mail.text,
    summary: analysis.summary,
    intent: analysis.intent,
    sentiment: analysis.sentiment,
    confidence: analysis.confidence,
    priority,
    channel: "Email",
    category: analysis.intent,
    tags: [analysis.intent, "Email"],
  });

  if (mail.messageId) {
    await getSupabase()
      .from("ticket_messages")
      .update({ email_message_id: mail.messageId })
      .eq("ticket_id", ticketId)
      .eq("role", "customer");
  }
  if (mail.attachments.length) {
    const { data: first } = await getSupabase().from("ticket_messages").select("id").eq("ticket_id", ticketId).eq("role", "customer").limit(1).maybeSingle();
    await saveEmailFiles(org.id, ticketId, first?.id ?? null, mail);
  }

  await onTicketCreated(org.id, ticketId);

  const settings = await getEmailSettings(org.id);
  if (settings?.autoAcknowledge) {
    const target = ((await getSlaTargets(org.id)) ?? DEFAULT_SLA_TARGETS)[priority];
    const result = await sendEmail({
      to: mail.fromEmail,
      fromName: settings.fromName || `${org.name} Support`,
      subject: subjectWithRef(mail.subject, ticketId),
      inReplyTo: mail.messageId,
      text: [
        `Hi ${mail.fromName.split(" ")[0]},`,
        `Thanks for contacting ${org.name}. We've received your message and opened ticket #${ticketId}.`,
        `A member of the team will reply within ${formatMinutes(target.firstResponseMinutes)}. You can reply to this email to add anything.`,
        settings.signature || `${org.name} Support`,
      ].join("\n\n"),
    });
    await addActivity(org.id, ticketId, `Acknowledgement email ${describe(result)}`, result.status === "sent" ? "bg-green-500" : "bg-zinc-500");
  }
  return { ticketId, outcome: "created" };
}

// Stores the files that came with a customer's email. A file that can't be stored is noted, not fatal.
async function saveEmailFiles(orgId: string, ticketId: string, messageId: number | null, mail: InboundEmail) {
  let saved = 0;
  const skipped: string[] = [];
  for (const file of mail.attachments) {
    try {
      const ok = await saveCustomerFile(orgId, ticketId, messageId, { name: file.name, contentType: file.contentType, bytes: Buffer.from(file.base64, "base64") }, mail.fromName);
      if (ok) saved += 1;
      else skipped.push(file.name);
    } catch (err) {
      console.error("Email attachment failed:", err);
      skipped.push(file.name);
    }
  }
  if (saved) await addActivity(orgId, ticketId, `${saved} file${saved === 1 ? "" : "s"} attached by the customer`, "bg-sky-500");
  if (skipped.length) await addActivity(orgId, ticketId, `Not attached (type or size not allowed): ${skipped.join(", ").slice(0, 200)}`, "bg-zinc-500");
}

function describe(result: SendResult) {
  return result.status === "sent" ? "sent" : result.status === "failed" ? `failed: ${result.note}` : `not sent (${result.note.toLowerCase()})`;
}

// ---- Outgoing ----

type EmailTicket = {
  id: number;
  subject: string;
  channel: string;
  status: TicketStatus;
  csat_token: string;
  csat_rating: number | null;
  survey_sent_at: string | null;
  customer: { name: string; email: string } | null;
};

async function emailTicket(orgId: string, ticketId: string) {
  const { data, error } = await getSupabase()
    .from("tickets")
    .select("id, subject, channel, status, csat_token, csat_rating, survey_sent_at, customer:customers (name, email)")
    .eq("org_id", orgId)
    .eq("id", ticketId)
    .returns<EmailTicket[]>()
    .maybeSingle();
  if (error) throw new Error(`Failed to load ticket: ${error.message}`);
  return data?.channel === "Email" && data.customer ? data : null;
}

// The latest Message-ID from the customer, so the reply lands in the same thread in their mail app
async function lastCustomerMessageId(ticketId: string) {
  const { data } = await getSupabase()
    .from("ticket_messages")
    .select("email_message_id")
    .eq("ticket_id", ticketId)
    .eq("role", "customer")
    .not("email_message_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.email_message_id as string | undefined) ?? null;
}

// Sends an agent's reply on an email ticket and records whether it went out. Does nothing for other channels.
export async function emailAgentReply(
  orgId: string,
  orgName: string,
  ticketId: string,
  messageId: number,
  text: string,
  files: { id: string; fileName: string }[] = []
) {
  const ticket = await emailTicket(orgId, ticketId);
  if (!ticket) return null;

  // The email provider fetches each file from a link that expires in an hour
  const attachments = (
    await Promise.all(files.map((f) => signedLink(orgId, f.id, { seconds: 3600 }).then((l) => (l ? { filename: f.fileName, url: l.url } : null))))
  ).filter((a): a is { filename: string; url: string } => a !== null);

  const settings = await getEmailSettings(orgId);
  const result = await sendEmail({
    attachments,
    to: ticket.customer!.email,
    fromName: settings?.fromName || `${orgName} Support`,
    subject: subjectWithRef(ticket.subject, ticketId),
    inReplyTo: await lastCustomerMessageId(ticketId),
    text: settings?.signature ? `${text}\n\n${settings.signature}` : text,
  });

  await getSupabase()
    .from("ticket_messages")
    .update({ delivery: result.status, delivery_note: result.status === "sent" ? null : result.note })
    .eq("id", messageId)
    .eq("ticket_id", ticketId);
  return result;
}

// When an email ticket is resolved: send the survey link once, unless the customer already rated
export async function emailSurveyIfDue(orgId: string, orgName: string, ticketId: string, origin: string) {
  const ticket = await emailTicket(orgId, ticketId);
  if (!ticket || !isDone(ticket.status) || ticket.survey_sent_at || ticket.csat_rating) return null;

  const settings = await getEmailSettings(orgId);
  if (!settings?.surveyOnResolve) return null;

  const result = await sendEmail({
    to: ticket.customer!.email,
    fromName: settings.fromName || `${orgName} Support`,
    subject: subjectWithRef(ticket.subject, ticketId),
    inReplyTo: await lastCustomerMessageId(ticketId),
    text: [
      `Hi ${ticket.customer!.name.split(" ")[0]},`,
      `We've marked ticket #${ticketId} as resolved. If anything still isn't right, just reply to this email and it will reopen.`,
      `How did we do? It takes 10 seconds: ${origin}/rate/${ticket.csat_token}`,
      settings.signature || `${orgName} Support`,
    ].join("\n\n"),
  });

  if (result.status === "sent") {
    await getSupabase().from("tickets").update({ survey_sent_at: new Date().toISOString() }).eq("org_id", orgId).eq("id", ticketId);
  }
  await addActivity(orgId, ticketId, `Survey email ${describe(result)}`, result.status === "sent" ? "bg-emerald-500" : "bg-zinc-500");
  return result;
}
