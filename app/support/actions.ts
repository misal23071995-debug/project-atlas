"use server";

import { revalidatePath } from "next/cache";
import { askBot } from "@/app/lib/bot/service";
import {
  MAX_CUSTOMER_MESSAGES,
  MAX_MESSAGE_LENGTH,
  type BotChatMessage,
} from "@/app/lib/bot/types";
import {
  addConversationMessage,
  createConversation,
  getConversation,
  getConversationMessages,
  listArticles,
  updateConversation,
  type BotConversation,
} from "@/app/lib/db/bot";
import { addActivity, createTicket } from "@/app/lib/db/tickets";
import type { TicketPriority } from "@/app/lib/tickets";

// These actions are public: customers use them without signing in.
// The conversation id (a random UUID) is what lets a customer continue their own chat.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StartResult =
  | { ok: true; conversationId: string; greeting: BotChatMessage }
  | { ok: false; error: string };

export async function startSupportChatAction(name: string, email: string): Promise<StartResult> {
  const customerName = String(name ?? "").trim().slice(0, 100);
  const customerEmail = String(email ?? "").trim().toLowerCase().slice(0, 320);

  if (!customerName) return { ok: false, error: "Please enter your name." };
  if (!EMAIL_PATTERN.test(customerEmail)) return { ok: false, error: "Please enter a valid email." };

  const conversationId = await createConversation(customerName, customerEmail);
  const greeting = `Hi ${customerName.split(" ")[0]}! I'm the Atlas Ring assistant. Ask me about setup, syncing, battery, sizing, orders, returns or warranty. If I can't help, I'll pass you to our team.`;
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
    await handOff(conversation, "The chat reached the message limit.", "Medium");
    return {
      ok: true,
      handedOff: true,
      reply: { role: "bot", body: "I've passed this conversation to our support team. An agent will follow up with you by email." },
    };
  }

  await addConversationMessage(conversation.id, "customer", text);
  await updateConversation(conversation.id, { customerMessages: conversation.customerMessages + 1 });

  const [articles, history] = await Promise.all([
    listArticles({ publishedOnly: true }),
    getConversationMessages(conversation.id),
  ]);
  const answer = await askBot(articles, history, conversation.customerName);

  await addConversationMessage(conversation.id, "bot", answer.reply);
  await updateConversation(conversation.id, { topic: answer.topic });

  if (answer.needsHuman) {
    const priority: TicketPriority =
      answer.sentiment === "Angry" ? "High" : answer.sentiment === "Frustrated" ? "Medium" : "Low";
    await handOff(conversation, answer.handoffReason || "The assistant could not resolve this.", priority, answer.topic);
  }

  return {
    ok: true,
    handedOff: answer.needsHuman,
    reply: { role: "bot", body: answer.reply, sources: answer.sources },
  };
}

// Customer clicked "Talk to a person"
export async function requestHumanAction(conversationId: string): Promise<SendResult> {
  const conversation = await getConversation(conversationId);
  if (!conversation) return { ok: false, error: "This chat has expired. Please start a new one." };
  if (conversation.status !== "active") return { ok: false, error: "This chat has already ended." };

  const reply = "No problem. I've passed our conversation to the support team, and an agent will follow up with you by email.";
  await addConversationMessage(conversation.id, "bot", reply);
  await handOff(conversation, "The customer asked to talk to a person.", "Medium");

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

// Turn the conversation into a ticket with the full transcript, so the agent has all the context
async function handOff(
  conversation: BotConversation,
  reason: string,
  priority: TicketPriority,
  topic = "Other"
) {
  const history = await getConversationMessages(conversation.id);
  const transcript = history
    .map((m) => `${m.role === "customer" ? conversation.customerName : "Atlas Bot"}: ${m.body}`)
    .join("\n\n");
  const firstQuestion = history.find((m) => m.role === "customer")?.body ?? "Support chat";

  const ticketId = await createTicket({
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

  await addActivity(ticketId, `Handed over by the AI chatbot: ${reason}`, "bg-amber-500");
  await updateConversation(conversation.id, { status: "handed_off", ticketId });

  revalidatePath("/tickets");
  revalidatePath("/");
}
