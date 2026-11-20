"use server";

import { revalidatePath } from "next/cache";
import { TOO_MANY, allow, visitorId } from "@/app/lib/rate-limit";
import { onTicketCreated } from "@/app/lib/db/automation";
import { askBot, type OrderContext } from "@/app/lib/bot/service";
import { findCustomerOrder } from "@/app/lib/db/orders";
import { findOrderNumbers, orderFactsForBot } from "@/app/lib/orders";
import {
  MAX_CUSTOMER_MESSAGES,
  MAX_MESSAGE_LENGTH,
  type BotChatMessage,
  type HandoffType,
} from "@/app/lib/bot/types";
import {
  addConversationMessage,
  createConversation,
  getConversation,
  getConversationMessages,
  listArticles,
  saveRating,
  updateConversation,
  type BotConversation,
} from "@/app/lib/db/bot";
import { addActivity, addMessage, createTicket, updateTicket } from "@/app/lib/db/tickets";
import { liveMessagesSince, markCustomerLeft, markCustomerSeen, type LiveMessage } from "@/app/lib/db/livechat";
import { getSupabase } from "@/app/lib/db/supabase";
import type { TicketPriority, TicketStatus } from "@/app/lib/tickets";
import { getWorkspaceBySlug } from "@/app/lib/db/workspaces";

// These actions are public: customers use them without signing in.
// The conversation id (a random UUID) is what lets a customer continue their own chat,
// and the conversation's workspace decides which articles the bot reads and where tickets go.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDOVER_MESSAGE = "I've passed our conversation to the support team. An agent will join this chat shortly. If you leave, we'll reply by email.";

export type StartResult =
  | { ok: true; conversationId: string; greeting: BotChatMessage }
  | { ok: false; error: string };

export async function startSupportChatAction(
  workspaceSlug: string,
  name: string,
  email: string
): Promise<StartResult> {
  const customerName = String(name ?? "").trim().slice(0, 100);
  const customerEmail = String(email ?? "").trim().toLowerCase().slice(0, 320);

  if (!(await allow("chatStart", await visitorId()))) return { ok: false, error: TOO_MANY };
  if (!customerName) return { ok: false, error: "Please enter your name." };
  if (!EMAIL_PATTERN.test(customerEmail)) return { ok: false, error: "Please enter a valid email." };

  const workspace = await getWorkspaceBySlug(String(workspaceSlug ?? ""));
  if (!workspace) return { ok: false, error: "This support page doesn't exist." };

  const conversationId = await createConversation(workspace.id, customerName, customerEmail);
  const greeting = `Hi ${customerName.split(" ")[0]}! I'm the ${workspace.name} support assistant. Ask me your question, and if I can't help, I'll pass you to our team.`;
  await addConversationMessage(conversationId, "bot", greeting);

  return { ok: true, conversationId, greeting: { role: "bot", body: greeting } };
}

export type SendResult =
  | { ok: true; reply: BotChatMessage; handedOff: boolean }
  | { ok: false; error: string };

export async function sendSupportMessageAction(
  conversationId: string,
  message: string
): Promise<SendResult> {
  const text = String(message ?? "").trim();
  if (!text) return { ok: false, error: "Please type a message." };
  // Each message is an AI call, so this also protects the AI quota
  if (!(await allow("chatMessage", await visitorId()))) return { ok: false, error: TOO_MANY };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Please keep messages under ${MAX_MESSAGE_LENGTH} characters.` };
  }

  const conversation = await getConversation(conversationId);
  if (!conversation) return { ok: false, error: "This chat has expired. Please start a new one." };
  if (conversation.status !== "active") {
    return { ok: false, error: "This chat has ended. Please start a new one if you need more help." };
  }
  if (conversation.customerMessages >= MAX_CUSTOMER_MESSAGES) {
    await handOff(conversation, "The chat reached the message limit.", "upset", "Medium");
    return {
      ok: true,
      handedOff: true,
      reply: { role: "bot", body: HANDOVER_MESSAGE },
    };
  }

  await addConversationMessage(conversation.id, "customer", text);
  await updateConversation(conversation.id, { customerMessages: conversation.customerMessages + 1 });

  const [articles, history] = await Promise.all([
    listArticles(conversation.orgId, { publishedOnly: true }),
    getConversationMessages(conversation.id),
  ]);
  const orders = await orderContext(conversation.orgId, conversation.customerEmail, history);
  const answer = await askBot(articles, history, conversation.customerName, conversation.orgName, orders);

  await addConversationMessage(conversation.id, "bot", answer.reply, answer.sources);
  await updateConversation(conversation.id, { topic: answer.topic });

  if (answer.needsHuman) {
    const priority: TicketPriority =
      answer.sentiment === "Angry" ? "High" : answer.sentiment === "Frustrated" ? "Medium" : "Low";
    await handOff(
      conversation,
      answer.handoffReason || "The assistant could not resolve this.",
      answer.handoffType ?? "not_covered",
      priority,
      answer.topic
    );
  }

  return {
    ok: true,
    handedOff: answer.needsHuman,
    reply: { role: "bot", body: answer.reply, sources: answer.sources },
  };
}

// Order numbers in the customer's recent messages, looked up only under the email this chat started with.
// The email isn't verified, so the number acts as the second key: both must match before the bot shares anything.
async function orderContext(orgId: string, email: string, history: { role: string; body: string }[]): Promise<OrderContext> {
  const recent = history.filter((m) => m.role === "customer").slice(-4).map((m) => m.body).join(" ");
  const numbers = findOrderNumbers(recent);
  const context: OrderContext = { verified: [], unmatched: [] };
  for (const number of numbers) {
    const order = await findCustomerOrder(orgId, number, email);
    if (order) context.verified.push(orderFactsForBot(order));
    else context.unmatched.push(number);
  }
  return context;
}

// Customer clicked "Talk to a person"
export async function requestHumanAction(conversationId: string): Promise<SendResult> {
  const conversation = await getConversation(conversationId);
  if (!conversation) return { ok: false, error: "This chat has expired. Please start a new one." };
  if (conversation.status !== "active") return { ok: false, error: "This chat has already ended." };

  const reply = `No problem. ${HANDOVER_MESSAGE}`;
  await addConversationMessage(conversation.id, "bot", reply);
  await handOff(conversation, "The customer asked to talk to a person.", "customer_request", "Medium");

  return { ok: true, handedOff: true, reply: { role: "bot", body: reply } };
}

// Customer clicked "That solved it"
export async function markResolvedAction(conversationId: string): Promise<SendResult> {
  const conversation = await getConversation(conversationId);
  if (!conversation) return { ok: false, error: "This chat has expired." };
  if (conversation.status !== "active") return { ok: false, error: "This chat has already ended." };

  const reply = "Great, glad that helped! You can close this window, or start a new chat any time.";
  await addConversationMessage(conversation.id, "bot", reply);
  await updateConversation(conversation.id, { status: "resolved" });
  revalidatePath("/");

  return { ok: true, handedOff: false, reply: { role: "bot", body: reply } };
}

// End-of-chat "How did we do?" rating, 1-5 stars with an optional comment
export async function rateChatAction(
  conversationId: string,
  rating: number,
  comment: string
): Promise<{ ok: boolean; error?: string }> {
  const stars = Math.round(Number(rating));
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) return { ok: false, error: "Choose 1 to 5 stars." };
  if (!(await getConversation(conversationId))) return { ok: false, error: "This chat has expired." };

  const saved = await saveRating(conversationId, stars, String(comment ?? "").trim().slice(0, 1000));
  if (!saved) return { ok: false, error: "This chat has already been rated." };

  revalidatePath("/");
  return { ok: true };
}

// Turn the conversation into a ticket with the full transcript, so the agent has all the context
async function handOff(
  conversation: BotConversation,
  reason: string,
  type: HandoffType,
  priority: TicketPriority,
  topic = "Other"
) {
  const history = await getConversationMessages(conversation.id);
  const transcript = history
    .map((m) => `${m.role === "customer" ? conversation.customerName : "Support bot"}: ${m.body}`)
    .join("\n\n");
  const firstQuestion = history.find((m) => m.role === "customer")?.body ?? "Support chat";

  const ticketId = await createTicket(conversation.orgId, {
    customerName: conversation.customerName,
    customerEmail: conversation.customerEmail,
    subject: firstQuestion.length > 80 ? `${firstQuestion.slice(0, 77)}...` : firstQuestion,
    description: transcript,
    summary: reason,
    intent: topic,
    sentiment: priority === "High" ? "Angry" : priority === "Medium" ? "Frustrated" : "Neutral",
    confidence: 0,
    priority,
    channel: "AI Chatbot",
    category: topic,
    tags: ["Bot handover", topic],
  });

  await addActivity(conversation.orgId, ticketId, `Handed over by the AI chatbot: ${reason}`, "bg-amber-500");
  await onTicketCreated(conversation.orgId, ticketId);
  await updateConversation(conversation.id, {
    status: "handed_off",
    ticketId,
    handoffReason: reason,
    handoffType: type,
  });

  revalidatePath("/tickets");
  revalidatePath("/");
}

// ---- Live chat with an agent, after the handover ----

export type LiveStatus = "waiting" | "live" | "closed";
export type PollResult =
  | { ok: true; messages: LiveMessage[]; status: LiveStatus; agentName: string | null }
  | { ok: false; error: string };

async function liveChat(conversationId: string) {
  const conversation = await getConversation(String(conversationId ?? ""));
  if (!conversation || conversation.status !== "handed_off" || !conversation.ticketId) return null;
  const { data: ticket } = await getSupabase()
    .from("tickets")
    .select("status, assigned_to")
    .eq("org_id", conversation.orgId)
    .eq("id", conversation.ticketId)
    .maybeSingle();
  return ticket ? { conversation, ticketId: conversation.ticketId, ticket: ticket as { status: TicketStatus; assigned_to: string } } : null;
}

// The chat window calls this every few seconds: new messages, whether an agent has joined,
// and whether the ticket was solved. It also tells the agent the customer is still there.
export async function pollChatAction(conversationId: string, afterId: number): Promise<PollResult> {
  if (!(await allow("livePoll", await visitorId()))) return { ok: false, error: TOO_MANY };
  const chat = await liveChat(conversationId);
  if (!chat) return { ok: false, error: "This chat has ended." };

  const after = Number.isFinite(Number(afterId)) ? Math.max(0, Math.floor(Number(afterId))) : 0;
  const [messages, lastAgent] = await Promise.all([
    liveMessagesSince(chat.conversation.orgId, chat.ticketId, after),
    // Who last answered; until someone has, the customer is still waiting for an agent
    getSupabase()
      .from("ticket_messages")
      .select("sender")
      .eq("ticket_id", chat.ticketId)
      .eq("role", "agent")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => (r.data?.sender as string | undefined) ?? null),
    markCustomerSeen(chat.conversation.id),
  ]);

  const closed = chat.ticket.status === "Resolved" || chat.ticket.status === "Closed";
  return { ok: true, messages, status: closed ? "closed" : lastAgent ? "live" : "waiting", agentName: lastAgent };
}

export async function sendLiveMessageAction(conversationId: string, message: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const text = String(message ?? "").trim();
  if (!text) return { ok: false, error: "Please type a message." };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Please keep messages under ${MAX_MESSAGE_LENGTH} characters.` };
  if (!(await allow("liveMessage", await visitorId()))) return { ok: false, error: TOO_MANY };

  const chat = await liveChat(conversationId);
  if (!chat) return { ok: false, error: "This chat has ended. Please start a new one if you need more help." };
  const { orgId, customerName } = chat.conversation;
  if (chat.ticket.status === "Closed") return { ok: false, error: "This chat has been closed. Please start a new one if you need more help." };

  const id = await addMessage(orgId, chat.ticketId, { sender: customerName, role: "customer", message: text });
  await markCustomerSeen(chat.conversation.id);
  // A message from the customer puts the ticket back in the queue
  if (chat.ticket.status !== "Open" && chat.ticket.status !== "Escalated") {
    await updateTicket(orgId, chat.ticketId, { status: "Open" });
    await addActivity(orgId, chat.ticketId, `Customer wrote in the chat; reopened from ${chat.ticket.status}`, "bg-amber-500");
  }
  revalidatePath("/tickets");
  return { ok: true, id };
}

// Customer clicked "End chat"
export async function endLiveChatAction(conversationId: string): Promise<{ ok: boolean }> {
  const chat = await liveChat(conversationId);
  if (!chat) return { ok: false };
  await markCustomerLeft(chat.conversation.id);
  await addActivity(chat.conversation.orgId, chat.ticketId, "Customer ended the chat", "bg-zinc-400");
  return { ok: true };
}

export type ResumeResult =
  | { ok: true; messages: BotChatMessage[]; stage: "bot" | "live" | "ended" }
  | { ok: false };

// Reopening the support page picks the chat up again, so a customer who left still sees the agent's reply
export async function resumeChatAction(conversationId: string): Promise<ResumeResult> {
  const conversation = await getConversation(String(conversationId ?? ""));
  if (!conversation || conversation.status === "resolved") return { ok: false };
  const history = await getConversationMessages(conversation.id);
  const messages: BotChatMessage[] = history.map((m) => ({ role: m.role, body: m.body }));
  if (conversation.status === "active") return { ok: true, messages, stage: "bot" };
  const chat = await liveChat(conversation.id);
  return { ok: true, messages, stage: chat && chat.ticket.status !== "Closed" ? "live" : "ended" };
}
