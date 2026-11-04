// Orders as agents and the chatbot see them. Safe to import from Client Components.

export const ORDER_STATUSES = ["processing", "shipped", "delivered", "cancelled", "returned", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  processing: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
  shipped: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/25",
  delivered: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  cancelled: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
  returned: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  refunded: "bg-rose-500/10 text-rose-300 ring-rose-500/25",
};

export interface OrderItem {
  name: string;
  variant?: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customerId: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  currency: string;
  carrier: string | null;
  trackingNumber: string | null;
  shipCity: string | null;
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  source: "manual" | "demo" | "shopify";
}

export function formatMoney(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

// Only orders that haven't shipped can be cancelled; shipped or delivered ones are refunded instead
export const canCancel = (order: Pick<Order, "status">) => order.status === "processing";
export const canRefund = (order: Pick<Order, "status">) => ["shipped", "delivered", "returned"].includes(order.status);

// Counts towards what the customer has spent
export const isPaid = (order: Pick<Order, "status">) => !["cancelled", "refunded"].includes(order.status);

// A short prefix from the company name, e.g. "Atlas Ring" -> "AR"
export function orderPrefix(companyName: string) {
  const letters = companyName.match(/[A-Za-z0-9]+/g)?.map((w) => w[0]).join("").toUpperCase() ?? "";
  return (letters || "OR").slice(0, 3).padEnd(2, "X");
}

// Order numbers someone typed, like "AR-10234", "ar 10234" or "#AR10234", written the standard way
export function findOrderNumbers(text: string) {
  const found = new Set<string>();
  for (const m of text.matchAll(/\b([A-Za-z]{2,3})[\s#-]?(\d{4,8})\b/g)) found.add(`${m[1].toUpperCase()}-${m[2]}`);
  return [...found].slice(0, 3);
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// What the chatbot may tell a customer about their own order. No address, payment or other customers' data.
export function orderFactsForBot(order: Order) {
  const items = order.items.map((i) => `${i.quantity} × ${i.name}${i.variant ? ` (${i.variant})` : ""}`).join(", ");
  const lines = [
    `Order ${order.orderNumber}: ${ORDER_STATUS_LABELS[order.status]}`,
    `Items: ${items || "not listed"}`,
    `Placed: ${day(order.placedAt)}`,
  ];
  if (order.shippedAt) lines.push(`Shipped: ${day(order.shippedAt)}${order.carrier ? ` with ${order.carrier}` : ""}`);
  if (order.trackingNumber) lines.push(`Tracking number: ${order.trackingNumber}`);
  if (order.deliveredAt) lines.push(`Delivered: ${day(order.deliveredAt)}`);
  if (order.status === "processing") lines.push("Not shipped yet. Orders usually ship within 2 business days.");
  if (order.closedAt && (order.status === "cancelled" || order.status === "refunded")) {
    lines.push(`${ORDER_STATUS_LABELS[order.status]} on ${day(order.closedAt)}`);
  }
  return lines.join("\n");
}
