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
import OrdersPanel from "@/app/components/ui/OrdersPanel";
import { findOrderNumbers, type Order } from "@/app/lib/orders";
import InternalNotes from "@/app/components/ui/InternalNotes";
import ActivityTimeline from "@/app/components/ui/ActivityTimeline";
import AICopilot from "@/app/components/ui/AICopilot";
import {
  formatDateTime,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
} from "@/app/lib/tickets";
import AttachmentList from "@/app/components/ui/AttachmentList";
import type { PendingFile } from "@/app/components/ui/ReplyEditor";
import { MAX_FILES_PER_MESSAGE, checkFile } from "@/app/lib/attachments";
import {
  addNoteAction,
  assignTicketAction,
  requestUploadAction,
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
  orders,
  otherTickets,
}: {
  ticket: TicketDetail;
  agentNames: string[];
  savedReplies: SavedReply[];
  // Null until orders are set up
  orders: Order[] | null;
  otherTickets: number;
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

  const [files, setFiles] = useState<PendingFile[]>([]);
  const updateFile = (key: string, changes: Partial<PendingFile>) =>
    setFiles((list) => list.map((f) => (f.key === key ? { ...f, ...changes } : f)));

  // Each file goes straight to storage through a one-time link, then is attached when the reply is sent
  function attach(picked: File[]) {
    const room = MAX_FILES_PER_MESSAGE - files.length;
    for (const file of picked.slice(0, Math.max(0, room))) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const problem = checkFile(file.name, file.type, file.size);
      setFiles((list) => [...list, { key, fileName: file.name, size: file.size, status: problem ? "error" : "uploading", error: problem ?? undefined }]);
      if (problem) continue;

      (async () => {
        const slot = await requestUploadAction(ticket.id, file.name, file.type, file.size);
        if ("error" in slot) return updateFile(key, { status: "error", error: slot.error });
        const res = await fetch(slot.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!res.ok) return updateFile(key, { status: "error", error: `${file.name} didn't upload. Try again.` });
        updateFile(key, { status: "ready", path: slot.path });
      })().catch(() => updateFile(key, { status: "error", error: `${file.name} didn't upload. Check your connection.` }));
    }
  }

  function handleSendReply() {
    const ready = files.filter((f) => f.status === "ready" && f.path).map((f) => ({ path: f.path!, fileName: f.fileName }));
    if ((!reply.trim() && !ready.length) || isPending || files.some((f) => f.status === "uploading")) return;
    run(
      () => sendReplyAction(ticket.id, reply, ready),
      () => {
        setReply("");
        setFiles([]);
      }
    );
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
              <p className="font-mono text-sm text-indigo-700">#{ticket.id}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{ticket.subject}</h1>
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
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100"
              >
                Review quality
              </Link>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Conversation */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
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
                        fromAgent ? "bg-indigo-500/20 text-indigo-700" : "bg-zinc-100 text-zinc-700"
                      }`}
                      aria-hidden
                    >
                      {initials(message.sender)}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        fromAgent ? "rounded-tr-md bg-indigo-500/15 ring-1 ring-inset ring-indigo-500/20" : "rounded-tl-md bg-zinc-100"
                      }`}
                    >
                      <p className="text-xs font-medium text-zinc-600">
                        {message.sender}
                        {fromAgent && <span className="font-normal text-zinc-500"> · agent</span>}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-zinc-900">{message.message}</p>
                      <AttachmentList attachments={ticket.attachments.filter((a) => a.messageId === message.id)} />
                      <p className="mt-2 text-xs text-zinc-500">
                        {formatDateTime(message.time)}
                        {message.delivery === "sent" && <span className="ml-2 text-emerald-600">· Emailed</span>}
                        {message.delivery === "not_sent" && (
                          <span className="ml-2 text-amber-600" title={message.deliveryNote ?? undefined}>
                            · Not emailed: {message.deliveryNote ?? "email isn't connected"}
                          </span>
                        )}
                        {message.delivery === "failed" && (
                          <span className="ml-2 text-rose-600">· Email failed: {message.deliveryNote ?? "unknown error"}</span>
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
              files={files}
              onAttach={attach}
              onRemoveFile={(key) => setFiles((list) => list.filter((f) => f.key !== key))}
              placeholders={{
                customer_first_name: ticket.customer.name.split(" ")[0],
                customer_name: ticket.customer.name,
                agent_name: agent?.name,
                ticket_id: ticket.id,
                survey_link: surveyLink ?? undefined,
              }}
            />
          ) : (
            <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
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
            id={ticket.customer.id}
            name={ticket.customer.name}
            email={ticket.customer.email}
            customerSince={new Date(ticket.customer.customerSince).toLocaleDateString("en-IN", {
              month: "short",
              year: "numeric",
            })}
            location={ticket.customer.location}
            device={ticket.customer.device}
            otherTickets={otherTickets}
          />

          {orders && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">Orders</h2>
              <OrdersPanel
                orders={orders}
                ticketId={ticket.id}
                // Orders the customer quoted in this conversation go first
                mentioned={findOrderNumbers(`${ticket.subject} ${ticket.conversation.map((m) => m.message).join(" ")}`)}
                canAct={canWork}
                limit={3}
              />
            </div>
          )}

          <SlaCard ticket={ticket} />

          {ticket.attachments.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-zinc-900">
                Files <span className="text-sm font-normal text-zinc-500">· {ticket.attachments.length}</span>
              </h2>
              <AttachmentList attachments={ticket.attachments} compact />
            </div>
          )}

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
