"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";

import DashboardLayout from "@/app/components/dashboard-layout";
import { useCan } from "@/app/components/AgentProvider";
import ReplyEditor from "@/app/components/ui/ReplyEditor";
import CustomerCard from "@/app/components/ui/CustomerCard";
import TicketInfoCard from "@/app/components/ui/TicketInfoCard";
import SlaCard from "@/app/components/ui/SlaCard";
import CsatCard from "@/app/components/ui/CsatCard";
import { useAgent } from "@/app/components/AgentProvider";
import { ChannelLabel, PriorityBadge, StatusBadge } from "@/app/components/ui/Badges";
import { initials } from "@/app/lib/auth/agent";
import type { SavedReply } from "@/app/lib/replies";
import InternalNotes from "@/app/components/ui/InternalNotes";
import ActivityTimeline from "@/app/components/ui/ActivityTimeline";
import AICopilot from "@/app/components/ui/AICopilot";
import {
  formatDateTime,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
} from "@/app/lib/tickets";
import {
  addNoteAction,
  assignTicketAction,
  sendReplyAction,
  updatePriorityAction,
  updateStatusAction,
} from "../actions";

// The site's own address, only known in the browser
const subscribeNever = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => null;

export default function TicketDetailView({
  ticket,
  agentNames,
  savedReplies,
}: {
  ticket: TicketDetail;
  agentNames: string[];
  savedReplies: SavedReply[];
}) {
  const agent = useAgent();
  const origin = useSyncExternalStore(subscribeNever, browserOrigin, serverOrigin);
  const surveyLink = origin ? `${origin}/rate/${ticket.csatToken}` : null;
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canWork = useCan("tickets.work");
  const canReview = useCan("quality.review");

  // Run a server action; the page re-renders with fresh data when it finishes
  function run(action: () => Promise<void>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleSendReply() {
    if (!reply.trim() || isPending) return;
    run(() => sendReplyAction(ticket.id, reply), () => setReply(""));
  }

  const latestCustomerMessage =
    [...ticket.conversation]
      .reverse()
      .find((message) => message.role === "customer")
      ?.message ?? "";

  const activities = ticket.activities.map((activity) => ({
    title: activity.title,
    color: activity.color,
    time: formatDateTime(activity.time),
  }));

  return (
    <DashboardLayout>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT SIDE */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-sm text-indigo-300">#{ticket.id}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{ticket.subject}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <ChannelLabel channel={ticket.channel} />
                <span className="text-xs text-zinc-500">Opened {formatDateTime(ticket.createdAt)}</span>
              </div>
            </div>

            {canReview && ticket.conversation.some((m) => m.role === "agent") && (
              <Link
                href={`/quality/${ticket.id}`}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Review quality
              </Link>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Conversation */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
            <h2 className="mb-5 text-sm font-medium uppercase tracking-wide text-zinc-500">
              Conversation
            </h2>

            <div className="space-y-4">
              {ticket.conversation.map((message, index) => {
                const fromAgent = message.role === "agent";
                return (
                  <div key={index} className={`flex gap-3 ${fromAgent ? "flex-row-reverse" : ""}`}>
                    <span
                      className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        fromAgent ? "bg-indigo-500/20 text-indigo-200" : "bg-zinc-800 text-zinc-300"
                      }`}
                      aria-hidden
                    >
                      {initials(message.sender)}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        fromAgent ? "rounded-tr-md bg-indigo-500/15 ring-1 ring-inset ring-indigo-500/20" : "rounded-tl-md bg-zinc-800/70"
                      }`}
                    >
                      <p className="text-xs font-medium text-zinc-400">
                        {message.sender}
                        {fromAgent && <span className="font-normal text-zinc-500"> · agent</span>}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-zinc-100">{message.message}</p>
                      <p className="mt-2 text-xs text-zinc-500">
                        {formatDateTime(message.time)}
                        {message.delivery === "sent" && <span className="ml-2 text-emerald-400">· Emailed</span>}
                        {message.delivery === "not_sent" && (
                          <span className="ml-2 text-amber-400" title={message.deliveryNote ?? undefined}>
                            · Not emailed: {message.deliveryNote ?? "email isn't connected"}
                          </span>
                        )}
                        {message.delivery === "failed" && (
                          <span className="ml-2 text-rose-400">· Email failed: {message.deliveryNote ?? "unknown error"}</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reply Editor */}
          {canWork ? (
            <ReplyEditor
              value={reply}
              onChange={setReply}
              onSend={handleSendReply}
              title={ticket.channel === "Email" ? "Reply by email" : undefined}
              note={ticket.channel === "Email" ? `Sent to ${ticket.customer.email}` : undefined}
              savedReplies={savedReplies}
              placeholders={{
                customer_first_name: ticket.customer.name.split(" ")[0],
                customer_name: ticket.customer.name,
                agent_name: agent?.name,
                ticket_id: ticket.id,
                survey_link: surveyLink ?? undefined,
              }}
            />
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
              Your role can read this ticket and leave internal notes, but not reply or change it.
            </p>
          )}

          {/* Internal Notes */}
          <InternalNotes
            notes={ticket.notes.map((note) => ({
              author: note.author,
              note: note.body,
              time: formatDateTime(note.time),
            }))}
            onAdd={(note, onSaved) => run(() => addNoteAction(ticket.id, note), onSaved)}
            disabled={isPending}
          />

          {/* Activity Timeline */}
          <ActivityTimeline
            activities={activities}
          />
        </div>

        {/* RIGHT SIDE */}
        <div className="space-y-6">
          <CustomerCard
            name={ticket.customer.name}
            email={ticket.customer.email}
            customerSince={new Date(ticket.customer.customerSince).toLocaleDateString("en-IN", {
              month: "short",
              year: "numeric",
            })}
            orders={ticket.customer.orders}
            csat={ticket.customer.csat ?? 0}
            location={ticket.customer.location}
            device={ticket.customer.device}
          />

          <SlaCard ticket={ticket} />

          <CsatCard
            rating={ticket.csatRating}
            comment={ticket.csatComment}
            ratedAt={ticket.csatRatedAt}
            surveyLink={surveyLink}
            onInsert={canWork ? (link) => setReply((r) => (r.trim() ? `${r.trimEnd()}\n\nHow did we do? ${link}` : `How did we do? ${link}`)) : undefined}
          />

          <TicketInfoCard
            status={ticket.status}
            priority={ticket.priority}
            assignedTo={ticket.assignedTo}
            agentNames={agentNames}
            channel={ticket.channel}
            category={ticket.category}
            created={formatDateTime(ticket.createdAt)}
            tags={ticket.tags}
            readOnly={!canWork}
            onStatusChange={(status) =>
              run(() => updateStatusAction(ticket.id, status as TicketStatus))
            }
            onPriorityChange={(priority) =>
              run(() => updatePriorityAction(ticket.id, priority as TicketPriority))
            }
            onAssignedChange={(assignedTo) =>
              run(() => assignTicketAction(ticket.id, assignedTo))
            }
          />

          {canWork && (
            <AICopilot
              customerMessage={latestCustomerMessage}
              onUseReply={setReply}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
