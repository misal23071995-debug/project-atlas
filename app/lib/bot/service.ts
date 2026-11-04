import "server-only";
import { ai } from "@/app/lib/ai/provider";
import { SENTIMENTS } from "@/app/lib/llm/schemas";
import { HANDOFF_TYPES, KB_CATEGORIES, type HandoffType, type KbArticle } from "./types";

const MODEL = "models/gemini-3.5-flash-lite";
const MAX_ARTICLES_IN_PROMPT = 6;
const HISTORY_TURNS = 10;

export interface BotReply {
  reply: string;
  needsHuman: boolean;
  // Why the bot is handing over, shown to the agent on the ticket
  handoffReason: string;
  handoffType: HandoffType | null;
  topic: (typeof KB_CATEGORIES)[number];
  sentiment: (typeof SENTIMENTS)[number];
  sources: string[];
}

const botReplyJsonSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    needs_human: { type: "boolean" },
    handoff_reason: { type: "string" },
    handoff_type: { type: "string", enum: [...HANDOFF_TYPES, "none"] },
    topic: { type: "string", enum: [...KB_CATEGORIES] },
    sentiment: { type: "string", enum: [...SENTIMENTS] },
    sources: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "needs_human", "handoff_reason", "handoff_type", "topic", "sentiment", "sources"],
  propertyOrdering: ["reply", "needs_human", "handoff_reason", "handoff_type", "topic", "sentiment", "sources"],
};

const words = (text: string) => text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];

// Simple keyword ranking so only the most relevant articles go into the prompt.
// Good enough for dozens of articles; switch to embeddings for hundreds.
function pickArticles(articles: KbArticle[], query: string) {
  const queryWords = new Set(words(query));

  return articles
    .map((article) => {
      const titleWords = words(`${article.title} ${article.category}`);
      const bodyWords = words(article.body);
      const score =
        titleWords.filter((w) => queryWords.has(w)).length * 3 +
        bodyWords.filter((w) => queryWords.has(w)).length;
      return { article, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ARTICLES_IN_PROMPT)
    .map(({ article }) => article);
}

// Orders the customer quoted: ones that belong to the email they started the chat with, and ones that don't
export interface OrderContext {
  verified: string[];
  unmatched: string[];
}

function buildPrompt(
  articles: KbArticle[],
  history: { role: "customer" | "bot"; body: string }[],
  customerName: string,
  brandName: string,
  orders: OrderContext
) {
  const articleText = articles
    .map((a) => `### ${a.title} (${a.category})\n${a.body}`)
    .join("\n\n");

  const transcript = history
    .slice(-HISTORY_TURNS * 2)
    .map((m) => `${m.role === "customer" ? "Customer" : "Assistant"}: ${m.body}`)
    .join("\n");

  const orderText = orders.verified.length
    ? `Order details (checked against this customer's email; you may share these with them):\n${orders.verified.join("\n\n")}`
    : "(no order details)";
  const unmatchedText = orders.unmatched.length
    ? `The customer quoted ${orders.unmatched.join(", ")}, but no order with that number belongs to the email they used in this chat.`
    : "";

  return `You are the ${brandName} support assistant, chatting with a customer named ${customerName}.

Rules:
- Answer ONLY with information from the help articles below. Never invent policies, prices, dates or steps.
- Keep replies short and friendly: at most about 120 words. Use numbered steps for instructions.
- Set needs_human to true, and say a support agent will follow up by email, when:
  * the articles don't cover the question,
  * the customer asks for a person, agent or human,
  * the customer needs something only staff can do (cancel an order, change a delivery address, start a return, approve a refund or warranty claim, change a payment),
  * the customer is angry, or has said twice that the steps didn't help.
- Orders:
  * If order details are given below, answer questions about that order's status, items, shipping, carrier, tracking number and delivery from them, without handing over. Never mention any other order or customer.
  * If the customer asks about a specific order but no order details are given, ask for their order number (it's in their order confirmation email), and don't hand over yet.
  * If the order number they gave isn't found for their email, say you couldn't find that order under the email they used in this chat, and ask them to check the number. If they can't, hand over as "needs_staff".
  * Never reveal whether an order exists under someone else's email.
- Never promise refunds, replacements, discounts or exceptions.
- Never ask for passwords or full card numbers.
- sources: the exact titles of the articles you used (empty if none).
- handoff_reason: one short sentence for the agent explaining why; empty if needs_human is false.
- handoff_type: "none" if needs_human is false. Otherwise pick the main reason:
  "not_covered" (no article answers the question), "needs_staff" (only staff can do it),
  "customer_request" (they asked for a person), or "upset" (angry, or the steps didn't help).
- topic: the help category that best fits the customer's question.

Help articles:
${articleText || "(none available)"}

${orderText}
${unmatchedText}

Conversation so far:
${transcript}

Write the assistant's next reply.`;
}

function isBotReply(value: unknown): value is {
  reply: string;
  needs_human: boolean;
  handoff_reason: string;
  handoff_type: HandoffType | "none";
  topic: BotReply["topic"];
  sentiment: BotReply["sentiment"];
  sources: string[];
} {
  const v = value as Record<string, unknown>;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.reply === "string" &&
    v.reply.trim() !== "" &&
    typeof v.needs_human === "boolean" &&
    typeof v.handoff_reason === "string" &&
    (v.handoff_type === "none" || HANDOFF_TYPES.includes(v.handoff_type as HandoffType)) &&
    KB_CATEGORIES.includes(v.topic as BotReply["topic"]) &&
    SENTIMENTS.includes(v.sentiment as BotReply["sentiment"]) &&
    Array.isArray(v.sources)
  );
}

export async function askBot(
  allArticles: KbArticle[],
  history: { role: "customer" | "bot"; body: string }[],
  customerName: string,
  // The workspace (company) name the bot speaks for
  brandName: string,
  orders: OrderContext = { verified: [], unmatched: [] }
): Promise<BotReply> {
  const recentCustomerText = history
    .filter((m) => m.role === "customer")
    .slice(-3)
    .map((m) => m.body)
    .join(" ");
  const articles = pickArticles(allArticles, recentCustomerText);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(articles, history, customerName, brandName, orders),
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: botReplyJsonSchema,
      },
    });

    const parsed: unknown = JSON.parse(response.text ?? "");
    if (!isBotReply(parsed)) throw new Error("Gemini response did not match the schema");

    // Only keep sources that are real article titles
    const titles = new Set(articles.map((a) => a.title));

    return {
      reply: parsed.reply.trim(),
      needsHuman: parsed.needs_human,
      handoffReason: parsed.handoff_reason.trim(),
      // If the model says "none" but still needs a human, treat it as a gap so it gets reviewed
      handoffType: parsed.needs_human
        ? parsed.handoff_type === "none"
          ? "not_covered"
          : parsed.handoff_type
        : null,
      topic: parsed.topic,
      sentiment: parsed.sentiment,
      sources: parsed.sources.filter((title) => titles.has(title)),
    };
  } catch (error) {
    // Free-tier quota or a bad response: hand over rather than leave the customer stuck
    console.error("Support bot failed, handing over:", error);
    return {
      reply:
        "Sorry, I'm having trouble answering right now. I've passed your question to our support team, and an agent will follow up with you by email.",
      needsHuman: true,
      handoffReason: "The AI assistant was unavailable.",
      handoffType: "unavailable",
      topic: "Other",
      sentiment: "Neutral",
      sources: [],
    };
  }
}
