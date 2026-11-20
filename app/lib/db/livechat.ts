import "server-only";
import { getSupabase } from "./supabase";
import { signedLink } from "./attachments";
import { getEmailSettings } from "./email";
import { sendEmail } from "@/app/lib/email/provider";
import { subjectWithRef } from "@/app/lib/email/parse";
import { chatPresence } from "@/app/lib/livechat";

// Live chat: once the bot hands a chat over, the ticket's messages are the conversation.
// The customer's chat window checks for new messages every few seconds, which also tells us they're still there.

export interface TicketChat {
  conversationId: string;
  online: boolean;
  // They clicked "End chat"
  left: boolean;
}

export interface LiveMessage {
  id: number;
  role: "customer" | "agent";
  sender: string;
  body: string;
  time: string;
  files: { fileName: string; url: string }[];
}

type ChatRow = { id: string; customer_last_seen_at: string | null; customer_left_at: string | null };

function toChat(row: ChatRow, now: number): TicketChat {
  return { conversationId: row.id, ...chatPresence(row.customer_last_seen_at, row.customer_left_at, now) };
}

// The chat behind a ticket, if it came from the chat window. Null before migration 019 is run.
export async function getTicketChat(orgId: string, ticketId: string): Promise<TicketChat | null> {
  if (!/^\d+$/.test(ticketId)) return null;
  const { data, error } = await getSupabase()
    .from("bot_conversations")
    .select("id, customer_last_seen_at, customer_left_at")
    .eq("org_id", orgId)
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<ChatRow[]>();
  // 42703: the new columns don't exist yet
  if (error) {
    if (error.code === "42703") return null;
    throw new Error(`Failed to load chat: ${error.message}`);
  }
  return data[0] ? toChat(data[0], Date.now()) : null;
}

export async function markCustomerSeen(conversationId: string) {
  await getSupabase().from("bot_conversations").update({ customer_last_seen_at: new Date().toISOString() }).eq("id", conversationId);
}

export async function markCustomerLeft(conversationId: string) {
  await getSupabase().from("bot_conversations").update({ customer_left_at: new Date().toISOString() }).eq("id", conversationId);
}

// Messages on the ticket after `afterId`, for the customer's chat window. The ticket's first message
// is the bot transcript, which the customer has already seen, so it's left out. Internal notes live
// in another table and are never sent.
export async function liveMessagesSince(orgId: string, ticketId: string, afterId: number): Promise<LiveMessage[]> {
  const supabase = getSupabase();
  const { data: first } = await supabase.from("ticket_messages").select("id").eq("ticket_id", ticketId).order("id").limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("ticket_messages")
    .select("id, role, sender, body, created_at")
    .eq("ticket_id", ticketId)
    .gt("id", Math.max(afterId, first?.id ?? 0))
    .order("id")
    .limit(100);
  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  if (!data.length) return [];

  // Files an agent sent, as links that work for an hour
  const { data: files } = await supabase
    .from("ticket_attachments")
    .select("id, message_id")
    .eq("org_id", orgId)
    .eq("ticket_id", ticketId)
    .eq("source", "agent")
    .in("message_id", data.map((m) => m.id));
  const links = await Promise.all(
    (files ?? []).map(async (f) => ({ messageId: f.message_id as number, link: await signedLink(orgId, String(f.id), { seconds: 3600 }) }))
  );

  return data.map((m) => ({
    id: m.id as number,
    role: m.role,
    sender: m.sender,
    body: m.body,
    time: m.created_at,
    files: links.filter((l) => l.messageId === m.id && l.link).map((l) => l.link!),
  }));
}

// An agent's reply on a chat ticket. It always shows in the chat window; if the customer
// isn't there right now, it's also emailed when email sending is connected.
export async function deliverChatReply(orgId: string, orgName: string, ticketId: string, messageId: number, text: string) {
  const chat = await getTicketChat(orgId, ticketId);
  if (!chat) return null;

  let delivery: "chat" | "sent" = "chat";
  let note: string | null = null;
  if (!chat.online) {
    const { data: ticket } = await getSupabase()
      .from("tickets")
      .select("subject, customer:customers (email)")
      .eq("org_id", orgId)
      .eq("id", ticketId)
      .returns<{ subject: string; customer: { email: string } | null }[]>()
      .maybeSingle();
    const settings = await getEmailSettings(orgId).catch(() => null);
    const result = ticket?.customer
      ? await sendEmail({
          to: ticket.customer.email,
          fromName: settings?.fromName || `${orgName} Support`,
          subject: subjectWithRef(ticket.subject, ticketId),
          text: `${text}\n\n${settings?.signature ? `${settings.signature}\n\n` : ""}You can reply to this email to continue.`,
        })
      : null;
    if (result?.status === "sent") delivery = "sent";
    else note = "The customer wasn't in the chat. They'll see it if they open the chat again.";
  }

  await getSupabase()
    .from("ticket_messages")
    .update({ delivery, delivery_note: note })
    .eq("id", messageId)
    .eq("ticket_id", ticketId);
  return { delivery, online: chat.online };
}
