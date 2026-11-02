import "server-only";
import { ai } from "./provider";
import { analyzeMessage, type AIAnalysis } from "@/app/lib/ai";
import { knowledgeBase } from "@/app/lib/data/articles";
import { buildSupportPrompt } from "@/app/lib/llm/prompts";
import {
  aiResponseJsonSchema,
  INTENTS,
  SENTIMENTS,
  type AIResponse,
} from "@/app/lib/llm/schemas";

const MODEL = "models/gemini-3.5-flash-lite";

export async function generateAIResponse(prompt: string) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  return response.text ?? "";
}

function isAIResponse(value: unknown): value is AIResponse {
  const v = value as AIResponse;
  return (
    typeof v === "object" &&
    v !== null &&
    INTENTS.includes(v.intent) &&
    SENTIMENTS.includes(v.sentiment) &&
    typeof v.confidence === "number" &&
    typeof v.summary === "string" &&
    typeof v.reply === "string"
  );
}

function articlesFor(intent: string) {
  const articles =
    knowledgeBase[intent as keyof typeof knowledgeBase] ??
    knowledgeBase["General Support"];
  return articles.map((article) => article.title);
}

export async function analyzeWithAI(
  message: string
): Promise<{ analysis: AIAnalysis; source: "gemini" | "rules" }> {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: buildSupportPrompt(message),
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: aiResponseJsonSchema,
      },
    });

    const parsed: unknown = JSON.parse(response.text ?? "");
    if (!isAIResponse(parsed)) {
      throw new Error("Gemini response did not match the schema");
    }

    return {
      source: "gemini",
      analysis: {
        summary: parsed.summary,
        intent: parsed.intent,
        sentiment: parsed.sentiment,
        confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence))),
        entities: parsed.entities ?? {},
        suggestedReply: parsed.reply,
        relatedArticles: articlesFor(parsed.intent),
      },
    };
  } catch (error) {
    // Free-tier quota or a malformed response shouldn't break the UI
    console.error("Gemini analysis failed, using rules:", error);
    return { source: "rules", analysis: analyzeMessage(message) };
  }
}
