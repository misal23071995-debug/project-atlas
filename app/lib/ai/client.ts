import { analyzeMessage, type AIAnalysis } from "@/app/lib/ai";

export async function fetchAnalysis(message: string): Promise<AIAnalysis> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: message }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error ?? `Request failed: ${res.status}`);
    }

    return data.analysis as AIAnalysis;
  } catch (error) {
    console.error("AI analysis request failed, using rules:", error);
    return analyzeMessage(message);
  }
}
