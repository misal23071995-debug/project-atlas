// Saved replies and their placeholders. Safe to import from Client Components.

export interface SavedReply {
  id: string;
  title: string;
  category: string;
  body: string;
  updatedAt: string;
}

export const MAX_REPLY_TITLE = 80;
export const MAX_REPLY_BODY = 5000;

export const PLACEHOLDERS = [
  { key: "customer_first_name", label: "Customer's first name" },
  { key: "customer_name", label: "Customer's full name" },
  { key: "agent_name", label: "Your name" },
  { key: "ticket_id", label: "Ticket number" },
  { key: "survey_link", label: "Satisfaction survey link" },
] as const;

export type PlaceholderValues = Partial<Record<(typeof PLACEHOLDERS)[number]["key"], string>>;

// Unknown placeholders and ones without a value are left as they are, so the agent sees what's missing
export function fillPlaceholders(body: string, values: PlaceholderValues) {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => values[key as keyof PlaceholderValues] ?? match);
}

// Offered to a workspace that has no saved replies yet
export const STARTER_REPLIES: Omit<SavedReply, "id" | "updatedAt">[] = [
  {
    title: "Sync troubleshooting",
    category: "Sync & App",
    body: "Hi {{customer_first_name}},\n\nSorry the ring isn't syncing. Please try these steps in order:\n1. Put the ring on its charger for 10 seconds, then take it off.\n2. Check the app has Bluetooth and background refresh allowed.\n3. Pull down on the home screen to sync.\n\nYour data is stored on the ring for up to a week, so nothing is lost. Let me know how it goes.\n\n{{agent_name}}",
  },
  {
    title: "Refund issued",
    category: "Returns & Refunds",
    body: "Hi {{customer_first_name}},\n\nI've issued your refund today. It usually takes 5 to 10 business days to show in your account, depending on your bank.\n\nIf you need anything else, just reply to this message.\n\n{{agent_name}}",
  },
  {
    title: "Size exchange",
    category: "Sizing",
    body: "Hi {{customer_first_name}},\n\nNo problem, size exchanges are free within 30 days of delivery. I've emailed you a prepaid return label, and your new size ships as soon as the courier collects the old one.\n\n{{agent_name}}",
  },
  {
    title: "Need more details",
    category: "Other",
    body: "Hi {{customer_first_name}},\n\nThanks for getting in touch. So I can help, could you send me your order number and the model of your phone?\n\nI'll keep ticket #{{ticket_id}} open for you in the meantime.\n\n{{agent_name}}",
  },
  {
    title: "Closing and survey",
    category: "Other",
    body: "Hi {{customer_first_name}},\n\nGlad that's sorted. I'll close this ticket now, but you can reply any time if something comes up.\n\nWe'd love to know how we did: {{survey_link}}\n\n{{agent_name}}",
  },
];
