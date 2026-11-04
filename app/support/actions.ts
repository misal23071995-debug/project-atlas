"use server";

import { revalidatePath } from "next/cache";
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
import { addActivity, createTicket } from "@/app/lib/db/tickets";
import type { TicketPriority } from "@/app/lib/tickets";
import { getWorkspaceBySlug } from "@/app/lib/db/workspaces";

// These actions are public: customers use them without signing in.
// The conversation id (a random UUID) is what lets a customer continue their own chat,
// and the conversation's workspace decides which articles the bot reads and where tickets go.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      reply: { role: "bot", body: "I've passed this conversation to our support team. An agent will follow up with you by email." },
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

  const reply = "No problem. I've passed our conversation to the support team, and an agent will follow up with you by email.";
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
