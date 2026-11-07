"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import AICopilot from "@/app/components/ui/AICopilot";
import AttachmentList from "@/app/components/ui/AttachmentList";
import CsatCard from "@/app/components/ui/CsatCard";
import OrdersPanel from "@/app/components/ui/OrdersPanel";
import SparkleIcon from "@/app/components/ui/SparkleIcon";
import { initials } from "@/app/lib/auth/agent";
import { findOrderNumbers, type Order } from "@/app/lib/orders";
import type { TicketDetail } from "@/app/lib/tickets";

// A titled block in the side panel that can be folded away
function Block({ title, count, icon, children, defaultOpen = true }: { title: string; count?: number; icon?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-zinc-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-zinc-50"
      >
        <span className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {icon}
          {title}
          {count !== undefined && <span className="rounded bg-zinc-100 px-1.5 text-[0.65rem] text-zinc-600">{count}</span>}
        </span>
        <svg className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "" : "-rotate-90"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export default function ContextPanel({
  ticket,
  orders,
  otherTickets,
  canWork,
  surveyLink,
  onUseReply,
  onInsertSurvey,
}: {
  ticket: TicketDetail;
  orders: Order[] | null;
  otherTickets: number;
  canWork: boolean;
  surveyLink: string | null;
  onUseReply: (text: string) => void;
  onInsertSurvey?: (link: string) => void;
}) {
  const c = ticket.customer;
  const latestCustomerMessage = [...ticket.conversation].reverse().find((m) => m.role === "customer")?.message ?? "";

  return (
    <div>
      <div className="border-b border-zinc-200 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700">{initials(c.name)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-zinc-900">{c.name}</p>
            <p className="truncate text-xs text-zinc-500" title={c.email}>
              {c.email}
            </p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <dt className="text-zinc-500">Location</dt>
            <dd className="truncate text-zinc-800">{c.location}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Device</dt>
            <dd className="truncate text-zinc-800">{c.device}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Customer since</dt>
            <dd className="text-zinc-800">{new Date(c.customerSince).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Other tickets</dt>
            <dd className="text-zinc-800">{otherTickets}</dd>
          </div>
        </dl>
        <Link href={`/customers/${c.id}`} className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700">
          View full history →
        </Link>
      </div>

      {orders && (
        <Block title="Orders" count={orders.length}>
          <OrdersPanel
            orders={orders}
            ticketId={ticket.id}
            // Orders the customer quoted in this conversation go first
            mentioned={findOrderNumbers(`${ticket.subject} ${ticket.conversation.map((m) => m.message).join(" ")}`)}
            canAct={canWork}
            limit={2}
          />
        </Block>
      )}

      {canWork && latestCustomerMessage && (
        <Block title="AI copilot" icon={<SparkleIcon className="h-3.5 w-3.5 text-indigo-500" />}>
          <AICopilot customerMessage={latestCustomerMessage} onUseReply={onUseReply} />
        </Block>
      )}

      <Block title="Satisfaction">
        <CsatCard rating={ticket.csatRating} comment={ticket.csatComment} ratedAt={ticket.csatRatedAt} surveyLink={surveyLink} onInsert={onInsertSurvey} />
      </Block>

      {ticket.attachments.length > 0 && (
        <Block title="Files" count={ticket.attachments.length}>
          <AttachmentList attachments={ticket.attachments} compact />
        </Block>
      )}
    </div>
  );
}
