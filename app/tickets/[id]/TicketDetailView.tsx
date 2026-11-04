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
            <div>
              <h1 className="text-3xl font-bold">
                Ticket {ticket.id}
              </h1>

              <p className="mt-1 text-zinc-400">
                {ticket.subject}
              </p>
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-6 text-lg font-semibold">
              Conversation
            </h2>

            <div className="space-y-4">
              {ticket.conversation.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.role === "customer"
                      ? "rounded-lg bg-zinc-800 p-4"
                      : "ml-12 rounded-lg bg-indigo-600/20 p-4"
                  }
                >
                  <p className="font-medium">
                    {message.sender}
                  </p>

                  <p className="mt-2 text-sm whitespace-pre-line">
                    {message.message}
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">
                    {formatDateTime(message.time)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Reply Editor */}
          {canWork ? (
            <ReplyEditor
              value={reply}
              onChange={setReply}
              onSend={handleSendReply}
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
