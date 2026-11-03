import "server-only";
import { getSupabase } from "./supabase";
import type { BotConversationStatus, KbArticle } from "@/app/lib/bot/types";

type ArticleRow = {
  id: number;
  title: string;
  category: string;
  body: string;
  published: boolean;
  updated_at: string;
};

function toArticle(row: ArticleRow): KbArticle {
  return {
    id: String(row.id),
    title: row.title,
    category: row.category,
    body: row.body,
    published: row.published,
    updatedAt: row.updated_at,
  };
}

// ---- Knowledge base ----

export async function listArticles({ publishedOnly = false } = {}): Promise<KbArticle[]> {
  let query = getSupabase()
    .from("kb_articles")
    .select("id, title, category, body, published, updated_at")
    .order("category")
    .order("title");

  if (publishedOnly) query = query.eq("published", true);

  const { data, error } = await query.returns<ArticleRow[]>();
  if (error) throw new Error(`Failed to load articles: ${error.message}`);
  return data.map(toArticle);
}

export async function getArticle(id: string): Promise<KbArticle | null> {
  if (!/^\d+$/.test(id)) return null;

  const { data, error } = await getSupabase()
    .from("kb_articles")
    .select("id, title, category, body, published, updated_at")
    .eq("id", id)
    .returns<ArticleRow[]>()
    .maybeSingle();

  if (error) throw new Error(`Failed to load article: ${error.message}`);
  return data ? toArticle(data) : null;
}

export type ArticleInput = Pick<KbArticle, "title" | "category" | "body" | "published">;

// Creates the article when id is null, otherwise updates it. Returns the id.
export async function saveArticle(id: string | null, input: ArticleInput): Promise<string> {
  const supabase = getSupabase();
  const values = { ...input, updated_at: new Date().toISOString() };

  const { data, error } = id
    ? await supabase.from("kb_articles").update(values).eq("id", id).select("id").single()
    : await supabase.from("kb_articles").insert(values).select("id").single();

  if (error) throw new Error(`Failed to save article: ${error.message}`);
  return String(data.id);
}

export async function deleteArticle(id: string) {
  const { error } = await getSupabase().from("kb_articles").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete article: ${error.message}`);
}

// ---- Conversations ----

export interface BotConversation {
  id: string;
  customerName: string;
  customerEmail: string;
  status: BotConversationStatus;
  ticketId: string | null;
  customerMessages: number;
}

export async function createConversation(customerName: string, customerEmail: string) {
  const { data, error } = await getSupabase()
    .from("bot_conversations")
    .insert({ customer_name: customerName, customer_email: customerEmail })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to start conversation: ${error.message}`);
  return data.id as string;
}

export async function getConversation(id: string): Promise<BotConversation | null> {
  // Conversation ids are UUIDs; anything else can't exist
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const { data, error } = await getSupabase()
    .from("bot_conversations")
    .select("id, customer_name, customer_email, status, ticket_id, customer_messages")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load conversation: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    status: data.status,
    ticketId: data.ticket_id === null ? null : String(data.ticket_id),
    customerMessages: data.customer_messages,
  };
}

export async function getConversationMessages(id: string) {
  const { data, error } = await getSupabase()
    .from("bot_messages")
    .select("role, body")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load conversation: ${error.message}`);
  return data as { role: "customer" | "bot"; body: string }[];
}

export async function addConversationMessage(id: string, role: "customer" | "bot", body: string) {
  const { error } = await getSupabase()
    .from("bot_messages")
    .insert({ conversation_id: id, role, body });

  if (error) throw new Error(`Failed to save message: ${error.message}`);
}

export async function updateConversation(
  id: string,
  changes: Partial<{
    status: BotConversationStatus;
    topic: string;
    ticketId: string;
    customerMessages: number;
  }>
) {
  const { error } = await getSupabase()
    .from("bot_conversations")
    .update({
      ...(changes.status && { status: changes.status }),
      ...(changes.topic && { topic: changes.topic }),
      ...(changes.ticketId && { ticket_id: changes.ticketId }),
      ...(changes.customerMessages !== undefined && { customer_messages: changes.customerMessages }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to update conversation: ${error.message}`);
}

// ---- Dashboard ----

export interface BotStats {
  conversations: number;
  resolvedByBot: number;
  handedOff: number;
  // Share of conversations the bot handled without an agent, 0-100
  deflectionRate: number;
  topTopics: { topic: string; count: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Last 30 days. Conversations where the customer never wrote anything don't count.
// Returns null until migration 003 has been run.
export async function getBotStats(): Promise<BotStats | null> {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const { data, error } = await getSupabase()
    .from("bot_conversations")
    .select("status, topic")
    .gt("customer_messages", 0)
    .gte("created_at", since);

  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load bot stats: ${error.message}`);

  const conversations = data.length;
  const handedOff = data.filter((c) => c.status === "handed_off").length;
  const resolvedByBot = conversations - handedOff;

  const topics = new Map<string, number>();
  for (const c of data) {
    const topic = c.topic ?? "Other";
    topics.set(topic, (topics.get(topic) ?? 0) + 1);
  }

  return {
    conversations,
    resolvedByBot,
    handedOff,
    deflectionRate: conversations ? Math.round((resolvedByBot / conversations) * 100) : 0,
    topTopics: [...topics]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
