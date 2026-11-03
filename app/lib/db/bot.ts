import "server-only";
import { getSupabase } from "./supabase";
import type { BotConversationStatus, HandoffType, KbArticle } from "@/app/lib/bot/types";

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
// Articles belong to one workspace; every function takes its id.

export async function listArticles(orgId: string, { publishedOnly = false } = {}): Promise<KbArticle[]> {
  let query = getSupabase()
    .from("kb_articles")
    .select("id, title, category, body, published, updated_at")
    .eq("org_id", orgId)
    .order("category")
    .order("title");

  if (publishedOnly) query = query.eq("published", true);

  const { data, error } = await query.returns<ArticleRow[]>();
  if (error) throw new Error(`Failed to load articles: ${error.message}`);
  return data.map(toArticle);
}

export async function getArticle(orgId: string, id: string): Promise<KbArticle | null> {
  if (!/^\d+$/.test(id)) return null;

  const { data, error } = await getSupabase()
    .from("kb_articles")
    .select("id, title, category, body, published, updated_at")
    .eq("id", id)
    .eq("org_id", orgId)
    .returns<ArticleRow[]>()
    .maybeSingle();

  if (error) throw new Error(`Failed to load article: ${error.message}`);
  return data ? toArticle(data) : null;
}

export type ArticleInput = Pick<KbArticle, "title" | "category" | "body" | "published">;

// Creates the article when id is null, otherwise updates it. Returns the id.
export async function saveArticle(orgId: string, id: string | null, input: ArticleInput): Promise<string> {
  const supabase = getSupabase();
  const values = { ...input, updated_at: new Date().toISOString() };

  const { data, error } = id
    ? await supabase.from("kb_articles").update(values).eq("id", id).eq("org_id", orgId).select("id").single()
    : await supabase.from("kb_articles").insert({ ...values, org_id: orgId }).select("id").single();

  if (error) throw new Error(`Failed to save article: ${error.message}`);
  return String(data.id);
}

export async function deleteArticle(orgId: string, id: string) {
  const { error } = await getSupabase().from("kb_articles").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw new Error(`Failed to delete article: ${error.message}`);
}

// ---- Conversations ----
// Customers aren't signed in, so these look conversations up by their random id,
// and the conversation's own org_id says which workspace it belongs to.

export interface BotConversation {
  id: string;
  orgId: string;
  // The company the customer is talking to, for the bot's greeting and prompt
  orgName: string;
  customerName: string;
  customerEmail: string;
  status: BotConversationStatus;
  ticketId: string | null;
  customerMessages: number;
}

export async function createConversation(orgId: string, customerName: string, customerEmail: string) {
  const { data, error } = await getSupabase()
    .from("bot_conversations")
    .insert({ org_id: orgId, customer_name: customerName, customer_email: customerEmail })
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
    .select(
      "id, org_id, customer_name, customer_email, status, ticket_id, customer_messages, organization:organizations (name)"
    )
    .eq("id", id)
    .returns<
      {
        id: string;
        org_id: string;
        customer_name: string;
        customer_email: string;
        status: BotConversationStatus;
        ticket_id: number | null;
        customer_messages: number;
        organization: { name: string } | null;
      }[]
    >()
    .maybeSingle();

  if (error) throw new Error(`Failed to load conversation: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    orgId: data.org_id,
    orgName: data.organization?.name ?? "Support",
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

export async function addConversationMessage(
  id: string,
  role: "customer" | "bot",
  body: string,
  sources: string[] = []
) {
  const { error } = await getSupabase()
    .from("bot_messages")
    .insert({ conversation_id: id, role, body, sources });

  if (error) throw new Error(`Failed to save message: ${error.message}`);
}

export async function updateConversation(
  id: string,
  changes: Partial<{
    status: BotConversationStatus;
    topic: string;
    ticketId: string;
    customerMessages: number;
    handoffReason: string;
    handoffType: HandoffType;
  }>
) {
  const { error } = await getSupabase()
    .from("bot_conversations")
    .update({
      ...(changes.status && { status: changes.status }),
      ...(changes.topic && { topic: changes.topic }),
      ...(changes.ticketId && { ticket_id: changes.ticketId }),
      ...(changes.customerMessages !== undefined && { customer_messages: changes.customerMessages }),
      ...(changes.handoffReason && { handoff_reason: changes.handoffReason }),
      ...(changes.handoffType && { handoff_type: changes.handoffType }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to update conversation: ${error.message}`);
}

// Saves the end-of-chat rating once. Returns false if the chat is still going or already rated.
export async function saveRating(id: string, rating: number, comment: string) {
  const { data, error } = await getSupabase()
    .from("bot_conversations")
    .update({ csat_rating: rating, csat_comment: comment || null, rated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "active")
    .is("csat_rating", null)
    .select("id");

  if (error) throw new Error(`Failed to save rating: ${error.message}`);
  return data.length > 0;
}

// ---- Dashboard ----

export interface BotStats {
  conversations: number;
  resolvedByBot: number;
  handedOff: number;
  // Share of conversations the bot handled without an agent, 0-100
  deflectionRate: number;
  topTopics: { topic: string; count: number }[];
  csat: {
    responses: number;
    // Share of finished chats that left a rating, 0-100
    responseRate: number;
    // Average stars, 1-5; null with no ratings
    average: number | null;
    // Split by outcome, to see whether handovers hurt satisfaction
    averageResolvedByBot: number | null;
    averageHandedOff: number | null;
  };
}

function averageOf(values: number[]) {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Last 30 days. Conversations where the customer never wrote anything don't count.
// Returns null until migration 003 has been run.
export async function getBotStats(orgId: string): Promise<BotStats | null> {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const { data, error } = await getSupabase()
    .from("bot_conversations")
    .select("status, topic, csat_rating")
    .eq("org_id", orgId)
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

  const finished = data.filter((c) => c.status !== "active");
  const rated = data.filter((c) => typeof c.csat_rating === "number");
  const ratingsWhere = (handed: boolean) =>
    rated.filter((c) => (c.status === "handed_off") === handed).map((c) => c.csat_rating as number);

  return {
    conversations,
    resolvedByBot,
    handedOff,
    deflectionRate: conversations ? Math.round((resolvedByBot / conversations) * 100) : 0,
    topTopics: [...topics]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    csat: {
      responses: rated.length,
      responseRate: finished.length ? Math.round((rated.length / finished.length) * 100) : 0,
      average: averageOf(rated.map((c) => c.csat_rating as number)),
      averageResolvedByBot: averageOf(ratingsWhere(false)),
      averageHandedOff: averageOf(ratingsWhere(true)),
    },
  };
}

// ---- Knowledge gaps ----

export interface HandoffItem {
  conversationId: string;
  question: string;
  reason: string;
  topic: string;
  ticketId: string | null;
  // ISO timestamp
  createdAt: string;
}

export interface KnowledgeGaps {
  totalChats: number;
  handoffs: number;
  // Every handover type, with how many chats it caused
  byType: { type: HandoffType | "unknown"; count: number }[];
  // Questions no article answers, grouped by topic, biggest group first
  missingArticles: { topic: string; items: HandoffItem[] }[];
  // Handovers for other reasons (staff actions, upset customers...), newest first
  otherHandoffs: (HandoffItem & { type: HandoffType | "unknown" })[];
}

type HandoffRow = {
  id: string;
  topic: string | null;
  handoff_type: HandoffType | null;
  handoff_reason: string | null;
  ticket_id: number | null;
  created_at: string;
  bot_messages: { role: "customer" | "bot"; body: string; created_at: string }[];
};

// Last 30 days. Returns null until migration 004 has been run.
export async function getKnowledgeGaps(orgId: string): Promise<KnowledgeGaps | null> {
  const supabase = getSupabase();
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [chatsRes, handoffsRes] = await Promise.all([
    supabase
      .from("bot_conversations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gt("customer_messages", 0)
      .gte("created_at", since),
    supabase
      .from("bot_conversations")
      .select(
        "id, topic, handoff_type, handoff_reason, ticket_id, created_at, bot_messages (role, body, created_at)"
      )
      .eq("org_id", orgId)
      .eq("status", "handed_off")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .returns<HandoffRow[]>(),
  ]);

  // 42703: column missing (migration 004 not run); PGRST205: table missing
  if (handoffsRes.error && ["42703", "PGRST205"].includes(handoffsRes.error.code)) return null;
  if (handoffsRes.error) throw new Error(`Failed to load knowledge gaps: ${handoffsRes.error.message}`);
  if (chatsRes.error) throw new Error(`Failed to load knowledge gaps: ${chatsRes.error.message}`);

  const items = handoffsRes.data.map((row) => {
    const firstQuestion = [...row.bot_messages]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .find((m) => m.role === "customer");

    return {
      conversationId: row.id,
      question: firstQuestion?.body ?? "(no question)",
      reason: row.handoff_reason ?? "",
      topic: row.topic ?? "Other",
      ticketId: row.ticket_id === null ? null : String(row.ticket_id),
      createdAt: row.created_at,
      type: (row.handoff_type ?? "unknown") as HandoffType | "unknown",
    };
  });

  const typeCounts = new Map<HandoffType | "unknown", number>();
  for (const item of items) typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);

  const gapsByTopic = new Map<string, HandoffItem[]>();
  for (const item of items.filter((i) => i.type === "not_covered")) {
    gapsByTopic.set(item.topic, [...(gapsByTopic.get(item.topic) ?? []), item]);
  }

  return {
    totalChats: chatsRes.count ?? 0,
    handoffs: items.length,
    byType: [...typeCounts]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    missingArticles: [...gapsByTopic]
      .map(([topic, topicItems]) => ({ topic, items: topicItems }))
      .sort((a, b) => b.items.length - a.items.length),
    otherHandoffs: items.filter((i) => i.type !== "not_covered"),
  };
}
