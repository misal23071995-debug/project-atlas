import "server-only";
import { ai } from "@/app/lib/ai/provider";
import { SENTIMENTS } from "@/app/lib/llm/schemas";
import { KB_CATEGORIES, type KbArticle } from "./types";

const MODEL = "models/gemini-3.5-flash-lite";
const MAX_ARTICLES_IN_PROMPT = 6;
const HISTORY_TURNS = 10;

export interface BotReply {
  reply: string;
  needsHuman: boolean;
  // Why the bot is handing over, shown to the agent on the ticket
  handoffReason: string;
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
    topic: { type: "string", enum: [...KB_CATEGORIES] },
    sentiment: { type: "string", enum: [...SENTIMENTS] },
    sources: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "needs_human", "handoff_reason", "topic", "sentiment", "sources"],
  propertyOrdering: ["reply", "needs_human", "handoff_reason", "topic", "sentiment", "sources"],
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

function buildPrompt(
  articles: KbArticle[],
  history: { role: "customer" | "bot"; body: string }[],
  customerName: string
) {
  const articleText = articles
    .map((a) => `### ${a.title} (${a.category})\n${a.body}`)
    .join("\n\n");

  const transcript = history
    .slice(-HISTORY_TURNS * 2)
    .map((m) => `${m.role === "customer" ? "Customer" : "Assistant"}: ${m.body}`)
    .join("\n");

  return `You are the Atlas Ring support assistant, chatting with a customer named ${customerName}.

Rules:
- Answer ONLY with information from the help articles below. Never invent policies, prices, dates or steps.
- Keep replies short and friendly: at most about 120 words. Use numbered steps for instructions.
- Set needs_human to true, and say a support agent will follow up by email, when:
  * the articles don't cover the question,
  * the customer asks for a person, agent or human,
  * the customer needs something only staff can do (look up a specific order, start a return, approve a refund or warranty claim, change a payment),
  * the customer is angry, or has said twice that the steps didn't help.
- Never promise refunds, replacements, discounts or exceptions.
- Never ask for passwords or full card numbers.
- sources: the exact titles of the articles you used (empty if none).
- handoff_reason: one short sentence for the agent explaining why; empty if needs_human is false.
- topic: the help category that best fits the customer's question.

Help articles:
${articleText || "(none available)"}

Conversation so far:
${transcript}

Write the assistant's next reply.`;
}

function isBotReply(value: unknown): value is {
  reply: string;
  needs_human: boolean;
  handoff_reason: string;
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
    KB_CATEGORIES.includes(v.topic as BotReply["topic"]) &&
    SENTIMENTS.includes(v.sentiment as BotReply["sentiment"]) &&
    Array.isArray(v.sources)
  );
}

export async function askBot(
  allArticles: KbArticle[],
  history: { role: "customer" | "bot"; body: string }[],
  customerName: string
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
      contents: buildPrompt(articles, history, customerName),
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
      topic: "Other",
      sentiment: "Neutral",
      sources: [],
    };
  }
}
