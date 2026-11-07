import Link from "next/link";
import { notFound } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard-layout";
import { ChannelLabel, PriorityBadge, StatusBadge } from "@/app/components/ui/Badges";
import OrdersPanel, { OrderStatusBadge } from "@/app/components/ui/OrdersPanel";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { initials } from "@/app/lib/auth/agent";
import { getCustomerProfile, type TimelineEvent } from "@/app/lib/db/customers";
import { formatMoney, orderPrefix } from "@/app/lib/orders";
import { formatDateTime } from "@/app/lib/tickets";
import AddOrderForm from "./AddOrderForm";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900 tabular">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

const DOT: Record<TimelineEvent["kind"], string> = { ticket: "bg-indigo-400", chat: "bg-violet-400", order: "bg-emerald-400" };

function Event({ event }: { event: TimelineEvent }) {
  return (
    <li className="relative pb-5 pl-6 last:pb-0">
      <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${DOT[event.kind]}`} aria-hidden />
      <p className="text-xs text-zinc-500">{formatDateTime(event.at)}</p>
      {event.kind === "ticket" && (
        <Link href={`/tickets/${event.ticket.id}`} className="mt-1 block rounded-lg border border-zinc-200 bg-zinc-50 p-3 hover:border-zinc-300">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-xs text-indigo-700">#{event.ticket.id}</span>
            <span className="font-medium text-zinc-900">{event.ticket.subject}</span>
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge status={event.ticket.status} />
            <PriorityBadge priority={event.ticket.priority} />
            <ChannelLabel channel={event.ticket.channel} />
            <span className="text-xs text-zinc-500">{event.ticket.assignedTo}</span>
            {event.ticket.csatRating && <span className="text-xs text-amber-700">{"★".repeat(event.ticket.csatRating)}</span>}
          </span>
        </Link>
      )}
      {event.kind === "chat" && (
        <p className="mt-1 text-sm text-zinc-700">
          Chatted with the AI assistant{event.chat.topic ? ` about ${event.chat.topic.toLowerCase()}` : ""}
          {event.chat.status === "resolved" ? ", solved without an agent" : ""}
          {event.chat.csatRating ? <span className="ml-2 text-xs text-amber-700">{"★".repeat(event.chat.csatRating)}</span> : null}
        </p>
      )}
      {event.kind === "order" && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
          Ordered <span className="font-mono text-zinc-900">{event.order.orderNumber}</span>
          <span className="text-zinc-500">· {formatMoney(event.order.total, event.order.currency)}</span>
          <OrderStatusBadge status={event.order.status} />
        </p>
      )}
    </li>
  );
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org, role } = await requireSession();
  const profile = await getCustomerProfile(org.id, id);
  if (!profile) notFound();

  const { customer, stats, orders, timeline } = profile;
  const canWork = can(role, "tickets.work");

  return (
    <DashboardLayout>
      <Link href="/customers" className="text-sm text-zinc-600 hover:text-zinc-800">
        ← Customers
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/20 text-lg font-semibold text-indigo-700">
          {initials(customer.name)}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{customer.name}</h1>
          <p className="mt-0.5 break-all text-sm text-zinc-600">
            {customer.email} · {customer.location} · {customer.device}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Spent" value={orders ? formatMoney(stats.spent, stats.currency) : "—"} sub={`${stats.paidOrders} paid order${stats.paidOrders === 1 ? "" : "s"}`} />
        <Stat label="Tickets" value={String(profile.tickets.length)} sub={`${stats.openTickets} open`} />
        <Stat label="Satisfaction" value={stats.csat === null ? "—" : `${stats.csat} ★`} sub={`${stats.ratings} rating${stats.ratings === 1 ? "" : "s"}`} />
        <Stat
          label="Customer since"
          value={new Date(customer.customerSince).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
          sub={`${profile.chats.length} bot chat${profile.chats.length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 lg:col-span-2 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">History</h2>
          <p className="mt-1 text-sm text-zinc-600">Every ticket, chat and order, newest first.</p>
          {timeline.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">Nothing yet.</p>
          ) : (
            <ol className="relative mt-6 before:absolute before:bottom-2 before:left-[4.5px] before:top-2 before:w-px before:bg-zinc-100">
              {timeline.slice(0, 60).map((event, i) => (
                <Event key={`${event.kind}-${i}`} event={event} />
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Orders</h2>
            <p className="mt-1 text-xs text-zinc-500">From the Atlas order store. A Shopify store can be connected later.</p>
          </div>
          {orders === null ? (
            <p className="text-sm text-amber-700">Orders aren&apos;t set up yet. Run supabase/migrations/015_orders.sql.</p>
          ) : (
            <>
              <OrdersPanel orders={orders} canAct={canWork} />
              {canWork && <AddOrderForm customerId={customer.id} suggestedNumber={`${orderPrefix(org.name)}-`} />}
            </>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
