export interface AIResponse {
  intent: string;
  sentiment: string;
  priority: string;
  confidence: number;
  summary: string;
  reply: string;
  escalate: boolean;
}