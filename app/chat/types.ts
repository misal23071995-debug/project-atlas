import { analyzeMessage } from "@/app/lib/ai";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  analysis?: ReturnType<typeof analyzeMessage>;
};