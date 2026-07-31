import { knowledgeBase } from "@/app/lib/data/articles";

export type Sentiment =
  | "Positive"
  | "Neutral"
  | "Frustrated"
  | "Angry";

export interface AIAnalysis {
  summary: string;
  intent: string;
  sentiment: Sentiment;

  confidence: number;

  entities: {
    product?: string;
    platform?: string;
    firmware?: string;
    issue?: string;
  };

  suggestedReply: string;

  relatedArticles: string[];
}

export function analyzeMessage(message: string): AIAnalysis {
  const text = (message ?? "").toLowerCase();

  // --------------------
  // Intent Detection
  // --------------------
  let intent = "General Support";

  if (
  text.includes("sync") ||
  text.includes("not syncing") ||
  text.includes("won't sync") ||
  text.includes("cannot sync") ||
  text.includes("can't sync")
) {
  intent = "Ring Sync";
} else if (text.includes("refund")) {
    intent = "Refund";
  } else if (text.includes("battery")) {
    intent = "Battery";
  } else if (text.includes("order")) {
    intent = "Order Status";
  }

  // --------------------
  // Sentiment
  // --------------------
  let sentiment: Sentiment = "Neutral";

  if (
  text.includes("angry") ||
  text.includes("worst") ||
  text.includes("terrible")
) {
  sentiment = "Angry";
} else if (
  text.includes("not working") ||
  text.includes("issue") ||
  text.includes("problem") ||
  text.includes("failed") ||
  text.includes("not syncing") ||
  text.includes("won't sync") ||
  text.includes("cannot sync") ||
  text.includes("can't sync") ||
  text.includes("not connecting") ||
  text.includes("unable")
) {
  sentiment = "Frustrated";
}

  // --------------------
  // Confidence
  // --------------------
  let confidence = 75;

  if (intent !== "General Support") {
    confidence = 92;
  }

  // --------------------
  // Suggested Reply
  // --------------------
  let suggestedReply =
    "Thank you for contacting us. We're looking into your request.";

  if (intent === "Ring Sync") {
    suggestedReply =
      "Please reinstall the Ultrahuman app, reconnect your Ring, and ensure Bluetooth permissions are enabled. If the issue continues, we'll collect diagnostic logs.";
  }

  if (intent === "Refund") {
    suggestedReply =
      "We'll verify your order details and guide you through the refund process.";
  }

  // --------------------
  // Summary
  // --------------------
  const summary =
    message.length > 120
      ? message.substring(0, 120) + "..."
      : message;


  const articles =
  knowledgeBase[intent as keyof typeof knowledgeBase] ??
  knowledgeBase["General Support"];

  return {
    summary,
    intent,
    sentiment,
    confidence,

    entities: {},

    suggestedReply,

   relatedArticles: articles.map((article) => article.title),
};
}