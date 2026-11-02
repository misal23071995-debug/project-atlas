export const INTENTS = [
  "Ring Sync",
  "Refund",
  "Battery",
  "Order Status",
  "General Support",
] as const;

export const SENTIMENTS = [
  "Positive",
  "Neutral",
  "Frustrated",
  "Angry",
] as const;

export interface AIResponse {
  intent: (typeof INTENTS)[number];
  sentiment: (typeof SENTIMENTS)[number];
  confidence: number;
  summary: string;
  reply: string;
  entities: {
    product?: string;
    platform?: string;
    firmware?: string;
    issue?: string;
  };
}

// JSON Schema passed to Gemini as responseJsonSchema
export const aiResponseJsonSchema = {
  type: "object",
  properties: {
    intent: { type: "string", enum: [...INTENTS] },
    sentiment: { type: "string", enum: [...SENTIMENTS] },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    reply: { type: "string" },
    entities: {
      type: "object",
      properties: {
        product: { type: "string" },
        platform: { type: "string" },
        firmware: { type: "string" },
        issue: { type: "string" },
      },
    },
  },
  required: ["intent", "sentiment", "confidence", "summary", "reply", "entities"],
  propertyOrdering: ["intent", "sentiment", "confidence", "summary", "reply", "entities"],
};
