import "server-only";
import { getSupabase } from "./supabase";
import type { Order, OrderItem, OrderStatus } from "@/app/lib/orders";

// Every function takes the workspace id and only touches that workspace's orders

type OrderRow = {
  id: number;
  customer_id: string;
  order_number: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number | string;
  currency: string;
  carrier: string | null;
  tracking_number: string | null;
  ship_city: string | null;
  placed_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  source: Order["source"];
};

export const ORDER_COLUMNS =
  "id, customer_id, order_number, status, items, total, currency, carrier, tracking_number, ship_city, placed_at, shipped_at, delivered_at, closed_at, closed_by, source";

export function toOrder(row: OrderRow): Order {
  return {
    id: String(row.id),
    customerId: row.customer_id,
    orderNumber: row.order_number,
    status: row.status,
    items: row.items ?? [],
    // numeric columns come back as strings
    total: Number(row.total),
    currency: row.currency,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    shipCity: row.ship_city,
    placedAt: row.placed_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    source: row.source,
  };
}

// Newest first. Null until migration 015 has been run.
export async function listCustomerOrders(orgId: string, customerId: string): Promise<Order[] | null> {
  const { data, error } = await getSupabase()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("placed_at", { ascending: false })
    .returns<OrderRow[]>();
  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return data.map(toOrder);
}

// For the chatbot: the order only if it belongs to this email, so nobody can look up someone else's order
export async function findCustomerOrder(orgId: string, orderNumber: string, email: string): Promise<Order | null> {
  const { data, error } = await getSupabase()
    .from("orders")
    .select(`${ORDER_COLUMNS}, customer:customers!inner (email)`)
    .eq("org_id", orgId)
    .eq("order_number", orderNumber)
    .eq("customer.email", email.toLowerCase())
    .returns<OrderRow[]>()
    .maybeSingle();
  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to look up the order: ${error.message}`);
  return data ? toOrder(data) : null;
}

export async function getOrder(orgId: string, id: string): Promise<Order | null> {
  if (!/^\d+$/.test(id)) return null;
  const { data, error } = await getSupabase()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .returns<OrderRow[]>()
    .maybeSingle();
  if (error) throw new Error(`Failed to load the order: ${error.message}`);
  return data ? toOrder(data) : null;
}

// Cancel or refund. Only from a status where it makes sense, checked again in the database update.
export async function closeOrder(orgId: string, id: string, to: "cancelled" | "refunded", by: string) {
  const from = to === "cancelled" ? ["processing"] : ["shipped", "delivered", "returned"];
  const { data, error } = await getSupabase()
    .from("orders")
    .update({ status: to, closed_at: new Date().toISOString(), closed_by: by })
    .eq("org_id", orgId)
    .eq("id", id)
    .in("status", from)
    .select("id");
  if (error) throw new Error(`Failed to update the order: ${error.message}`);
  if (!data.length) throw new Error(to === "cancelled" ? "Only orders that haven't shipped can be cancelled." : "This order can't be refunded.");
}

export interface NewOrder {
  orderNumber: string;
  items: OrderItem[];
  status: OrderStatus;
  carrier: string | null;
  trackingNumber: string | null;
  shipCity: string | null;
}

// Logged by hand, e.g. a phone order, until a shop is connected
export async function createOrder(orgId: string, customerId: string, input: NewOrder) {
  const now = new Date().toISOString();
  const total = input.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const { error } = await getSupabase()
    .from("orders")
    .insert({
      org_id: orgId,
      customer_id: customerId,
      order_number: input.orderNumber,
      status: input.status,
      items: input.items,
      total,
      carrier: input.carrier,
      tracking_number: input.trackingNumber,
      ship_city: input.shipCity,
      placed_at: now,
      shipped_at: ["shipped", "delivered"].includes(input.status) ? now : null,
      delivered_at: input.status === "delivered" ? now : null,
      source: "manual",
    });
  if (error?.code === "23505") throw new Error("An order with that number already exists.");
  if (error) throw new Error(`Failed to add the order: ${error.message}`);
}
