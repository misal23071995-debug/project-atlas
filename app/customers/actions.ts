"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/app/lib/audit";
import { requireSession } from "@/app/lib/auth/session";
import { closeOrder, createOrder, getOrder } from "@/app/lib/db/orders";
import { addActivity, addNote } from "@/app/lib/db/tickets";
import { getSupabase } from "@/app/lib/db/supabase";
import { ORDER_STATUSES, formatMoney, type OrderStatus } from "@/app/lib/orders";

export interface OrderActionResult {
  error?: string;
  success?: string;
}

// Cancel or refund an order from a ticket or the customer's profile. On a ticket, it's logged there too.
export async function closeOrderAction(orderId: string, to: "cancelled" | "refunded", ticketId: string | null): Promise<OrderActionResult> {
  const { agent, org } = await requireSession("tickets.work");
  if (to !== "cancelled" && to !== "refunded") return { error: "Choose cancel or refund." };

  const order = await getOrder(org.id, orderId);
  if (!order) return { error: "Order not found." };

  try {
    await closeOrder(org.id, orderId, to, agent.name);
    await audit(org.id, agent, to === "cancelled" ? "order.cancelled" : "order.refunded", order.orderNumber, { total: order.total, currency: order.currency, ticketId });
    if (ticketId) {
      const verb = to === "cancelled" ? "Cancelled" : "Refunded";
      await addActivity(org.id, ticketId, `${verb} order ${order.orderNumber} (${formatMoney(order.total, order.currency)}) · ${agent.name}`, "bg-rose-500");
      await addNote(org.id, ticketId, agent.name, `${verb} order ${order.orderNumber} for ${formatMoney(order.total, order.currency)}.`);
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update the order." };
  }

  revalidatePath(`/customers/${order.customerId}`);
  if (ticketId) revalidatePath(`/tickets/${ticketId}`);
  return { success: to === "cancelled" ? `Order ${order.orderNumber} cancelled.` : `Order ${order.orderNumber} refunded.` };
}

export async function addOrderAction(customerId: string, _previous: OrderActionResult, formData: FormData): Promise<OrderActionResult> {
  const { org } = await requireSession("tickets.work");
  const field = (name: string) => String(formData.get(name) ?? "").trim();

  const { data: customer } = await getSupabase().from("customers").select("id").eq("org_id", org.id).eq("id", customerId).maybeSingle();
  if (!customer) return { error: "Customer not found." };

  const orderNumber = field("orderNumber").toUpperCase();
  const item = field("item");
  const price = Number(field("price"));
  const status = field("status") as OrderStatus;
  if (!/^[A-Z0-9-]{3,30}$/.test(orderNumber)) return { error: "Enter the order number, e.g. AR-10234." };
  if (!item) return { error: "Enter what they ordered." };
  if (!(price >= 0 && price <= 10_000_000)) return { error: "Enter the price." };
  if (!ORDER_STATUSES.includes(status)) return { error: "Choose a status." };

  try {
    await createOrder(org.id, customerId, {
      orderNumber,
      items: [{ name: item.slice(0, 120), quantity: 1, price }],
      status,
      carrier: field("carrier").slice(0, 60) || null,
      trackingNumber: field("trackingNumber").slice(0, 60) || null,
      shipCity: null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not add the order." };
  }
  revalidatePath(`/customers/${customerId}`);
  return { success: `Order ${orderNumber} added.` };
}
