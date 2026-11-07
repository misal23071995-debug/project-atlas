"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import DashboardLayout from "@/app/components/dashboard-layout";
import { useAgent, useCan } from "@/app/components/AgentProvider";
import { PriorityBadge, StatusBadge } from "@/app/components/ui/Badges";
import { MAX_FILES_PER_MESSAGE, checkFile } from "@/app/lib/attachments";
import type { Order } from "@/app/lib/orders";
import type { SavedReply } from "@/app/lib/replies";
import { formatDateTime, type TicketDetail, type TicketPriority, type TicketStatus } from "@/app/lib/tickets";
import Composer, { type ComposerMode, type PendingFile } from "./Composer";
import ContextPanel from "./ContextPanel";
import PropertiesPanel from "./PropertiesPanel";
import Timeline from "./Timeline";
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

// Three panels, like most support desks: ticket properties, the conversation with the reply box
// docked under it, and what we know about the customer
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
  const canWork = useCan("tickets.work");
  const canReview = useCan("quality.review");
  const origin = useSyncExternalStore(subscribeNever, browserOrigin, serverOrigin);
  const surveyLink = origin ? `${origin}/rate/${ticket.csatToken}` : null;

  const [mode, setMode] = useState<ComposerMode>(canWork ? "reply" : "note");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [statusAfter, setStatusAfter] = useState<TicketStatus | "">("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const stream = useRef<HTMLDivElement>(null);

  // Newest at the bottom, like an email thread: open scrolled to the latest
  const size = ticket.conversation.length + ticket.notes.length;
  useEffect(() => {
    stream.current?.scrollTo({ top: stream.current.scrollHeight });
  }, [size]);

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

  function send() {
    const ready = files.filter((f) => f.status === "ready" && f.path).map((f) => ({ path: f.path!, fileName: f.fileName }));
    const next = statusAfter;
    run(
      async () => {
        await sendReplyAction(ticket.id, reply, ready);
        if (next) await updateStatusAction(ticket.id, next);
      },
      () => {
        setReply("");
        setFiles([]);
        setStatusAfter("");
      }
    );
  }

  const insertReply = (text: string) => {
    setMode("reply");
    setReply((r) => (r.trim() ? `${r.trimEnd()}\n\n${text}` : text));
  };

  return (
    <DashboardLayout fullBleed>
      <div className="flex flex-col lg:h-[calc(100vh-3.5rem)]">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">
              <Link href="/tickets" className="hover:text-zinc-800">
                Tickets
              </Link>
              <span className="mx-1.5 text-zinc-300">/</span>
              <span className="font-mono">#{ticket.id}</span>
            </p>
            <h1 className="mt-0.5 truncate text-lg font-semibold text-zinc-900">{ticket.subject}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-500">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <span>
                {ticket.customer.name} via {ticket.channel}
              </span>
              <span>· Opened {formatDateTime(ticket.createdAt)}</span>
            </div>
          </div>
          {canReview && ticket.conversation.some((m) => m.role === "agent") && (
            <Link href={`/quality/${ticket.id}`} className="inline-flex h-8 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50">
              Review quality
            </Link>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="order-2 border-t border-zinc-200 bg-white lg:order-1 lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-t-0">
            <PropertiesPanel
              ticket={ticket}
              agentNames={agentNames}
              readOnly={!canWork}
              onStatus={(s) => run(() => updateStatusAction(ticket.id, s as TicketStatus))}
              onPriority={(p) => run(() => updatePriorityAction(ticket.id, p as TicketPriority))}
              onAssign={(a) => run(() => assignTicketAction(ticket.id, a))}
            />
          </aside>

          <section className="order-1 flex min-w-0 flex-1 flex-col lg:order-2">
            <div ref={stream} className="flex-1 px-4 py-4 sm:px-6 lg:overflow-y-auto">
              {error && <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <Timeline messages={ticket.conversation} notes={ticket.notes} activities={ticket.activities} attachments={ticket.attachments} channel={ticket.channel} />
            </div>
            <Composer
              mode={mode}
              onModeChange={setMode}
              value={mode === "note" ? note : reply}
              onChange={mode === "note" ? setNote : setReply}
              canReply={canWork}
              replyTo={ticket.channel === "Email" ? `Email to ${ticket.customer.email}` : `Reply to ${ticket.customer.name}`}
              savedReplies={savedReplies}
              placeholders={{
                customer_first_name: ticket.customer.name.split(" ")[0],
                customer_name: ticket.customer.name,
                agent_name: agent?.name,
                ticket_id: ticket.id,
                survey_link: surveyLink ?? undefined,
              }}
              files={files}
              onAttach={attach}
              onRemoveFile={(key) => setFiles((list) => list.filter((f) => f.key !== key))}
              statusAfter={statusAfter}
              onStatusAfterChange={setStatusAfter}
              currentStatus={ticket.status}
              onSend={send}
              onAddNote={() => run(() => addNoteAction(ticket.id, note), () => setNote(""))}
              pending={isPending}
            />
          </section>

          <aside className="order-3 border-t border-zinc-200 bg-white lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <ContextPanel
              ticket={ticket}
              orders={orders}
              otherTickets={otherTickets}
              canWork={canWork}
              surveyLink={surveyLink}
              onUseReply={insertReply}
              onInsertSurvey={canWork ? (link) => insertReply(`How did we do? ${link}`) : undefined}
            />
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
