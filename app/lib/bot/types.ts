// Shared by the support chat, the Knowledge Base editor and the dashboard

export const KB_CATEGORIES = [
  "Getting Started",
  "Sync & App",
  "Battery & Charging",
  "Sizing",
  "Orders & Shipping",
  "Returns & Refunds",
  "Warranty",
  "Account & Privacy",
  "Other",
] as const;

export type KbCategory = (typeof KB_CATEGORIES)[number];

export interface KbArticle {
  id: string;

  title: string;

  category: string;

  body: string;

  published: boolean;

  // ISO timestamp
  updatedAt: string;
}

export interface BotChatMessage {
  role: "customer" | "bot";

  body: string;

  // Article titles the bot used for this answer
  sources?: string[];
}

export type BotConversationStatus = "active" | "resolved" | "handed_off";

// Why a chat went to an agent. Keep in sync with supabase/migrations/004_handoff_reasons.sql
export const HANDOFF_TYPES = [
  "not_covered",
  "needs_staff",
  "customer_request",
  "upset",
  "unavailable",
] as const;

export type HandoffType = (typeof HANDOFF_TYPES)[number];

export const HANDOFF_LABELS: Record<HandoffType, string> = {
  not_covered: "No article covers it",
  needs_staff: "Needs a staff action",
  customer_request: "Asked for a person",
  upset: "Customer upset",
  unavailable: "AI unavailable",
};

// Per conversation, to protect the free Gemini quota from abuse
export const MAX_CUSTOMER_MESSAGES = 20;
export const MAX_MESSAGE_LENGTH = 1000;
