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

// Per conversation, to protect the free Gemini quota from abuse
export const MAX_CUSTOMER_MESSAGES = 20;
export const MAX_MESSAGE_LENGTH = 1000;
