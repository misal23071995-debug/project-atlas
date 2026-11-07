import AttachmentList from "@/app/components/ui/AttachmentList";
import { initials } from "@/app/lib/auth/agent";
import type { Attachment } from "@/app/lib/attachments";
import { formatDateTime, type ConversationMessage, type TicketActivity, type TicketNote } from "@/app/lib/tickets";

// One stream for the ticket: what the customer and agents wrote, internal notes, and what changed,
// in the order it happened, like an email thread with the history in between.

type Item =
  | { kind: "message"; at: string; message: ConversationMessage }
  | { kind: "note"; at: string; note: TicketNote }
  | { kind: "event"; at: string; activity: TicketActivity };

// These repeat something the stream already shows
const REDUNDANT = /^(Reply (sent|emailed) by|Note added by)/;

function Avatar({ name, agent }: { name: string; agent: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        agent ? "bg-indigo-600 text-white" : "bg-zinc-200 text-zinc-700"
      }`}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function Delivery({ message }: { message: ConversationMessage }) {
  if (message.delivery === "sent") return <span className="text-emerald-700">Emailed</span>;
  if (message.delivery === "failed") return <span className="text-rose-700">Email failed: {message.deliveryNote ?? "unknown error"}</span>;
  if (message.delivery === "not_sent") {
    return (
      <span className="text-amber-700" title={message.deliveryNote ?? undefined}>
        Not emailed
      </span>
    );
  }
  return null;
}

export default function Timeline({
  messages,
  notes,
  activities,
  attachments,
  channel,
}: {
  messages: ConversationMessage[];
  notes: TicketNote[];
  activities: TicketActivity[];
  attachments: Attachment[];
  channel: string;
}) {
  const items: Item[] = [
    ...messages.map((message) => ({ kind: "message" as const, at: message.time, message })),
    ...notes.map((note) => ({ kind: "note" as const, at: note.time, note })),
    ...activities.filter((a) => !REDUNDANT.test(a.title)).map((activity) => ({ kind: "event" as const, at: activity.time, activity })),
  // Same moment: the event first, so "Ticket created" sits above the message that created it
  ].sort((a, b) => a.at.localeCompare(b.at) || Number(b.kind === "event") - Number(a.kind === "event"));

  return (
    <ol className="space-y-1">
      {items.map((item, i) => {
        if (item.kind === "event") {
          return (
            <li key={`e${i}`} className="flex items-center gap-2 py-1.5 pl-[3.25rem] text-xs text-zinc-500">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.activity.color}`} aria-hidden />
              <span className="min-w-0 truncate">{item.activity.title}</span>
              <span className="shrink-0 text-zinc-400">· {formatDateTime(item.at)}</span>
            </li>
          );
        }

        if (item.kind === "note") {
          return (
            <li key={`n${i}`} className="flex gap-3 py-2">
              <Avatar name={item.note.author} agent />
              <div className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900">
                    {item.note.author}
                    <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide text-amber-800">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                      Internal note
                    </span>
                  </p>
                  <time className="text-xs text-zinc-500">{formatDateTime(item.at)}</time>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-zinc-800">{item.note.body}</p>
              </div>
            </li>
          );
        }

        const m = item.message;
        const agent = m.role === "agent";
        return (
          <li key={`m${i}`} className="flex gap-3 py-2">
            <Avatar name={m.sender} agent={agent} />
            <div className={`min-w-0 flex-1 rounded-lg border px-4 py-3 ${agent ? "border-indigo-100 bg-indigo-50/40" : "border-zinc-200 bg-white"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">
                  {m.sender}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {agent ? "Agent" : `Customer · via ${channel}`}
                  </span>
                </p>
                <p className="flex items-center gap-2 text-xs text-zinc-500">
                  {agent && <Delivery message={m} />}
                  <time>{formatDateTime(m.time)}</time>
                </p>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-zinc-800">{m.message}</p>
              <AttachmentList attachments={attachments.filter((a) => a.messageId === m.id)} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
