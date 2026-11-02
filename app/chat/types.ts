import type { AIAnalysis } from "@/app/lib/ai";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  analysis?: AIAnalysis;
};