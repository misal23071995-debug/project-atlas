"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { MAX_MESSAGE_LENGTH, type BotChatMessage } from "@/app/lib/bot/types";
import type { LiveMessage } from "@/app/lib/db/livechat";
import {
  endLiveChatAction,
  markResolvedAction,
  pollChatAction,
  requestHumanAction,
  resumeChatAction,
  sendLiveMessageAction,
  sendSupportMessageAction,
  startSupportChatAction,
  type LiveStatus,
  type SendResult,
} from "./actions";
import ChatRating from "./ChatRating";

// intro: name and email. bot: talking to the AI assistant. live: handed to the team, an agent replies here.
type Stage = "intro" | "bot" | "live" | "ended";

// How often the chat window checks for an agent's reply
const POLL_MS = 3000;

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15";

// The open chat is remembered in this browser, so reopening the page picks it up again
type Saved = { id: string; name: string; email: string };
const storageKey = (slug: string) => `atlas-chat:${slug}`;
function readSaved(slug: string): Saved | null {
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function writeSaved(slug: string, saved: Saved | null) {
  try {
    if (saved) window.localStorage.setItem(storageKey(slug), JSON.stringify(saved));
    else window.localStorage.removeItem(storageKey(slug));
  } catch {
    // Private windows can block storage; the chat still works, it just isn't remembered
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function SupportChat({
  workspaceSlug,
  workspaceName,
  suggestions = [],
}: {
  workspaceSlug: string;
  workspaceName: string;
  // Example questions shown as buttons before the customer types anything
  suggestions?: string[];
}) {
  const [stage, setStage] = useState<Stage>("intro");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BotChatMessage[]>([]);
  const [live, setLive] = useState<LiveMessage[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("waiting");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [endNote, setEndNote] = useState<string | null>(null);
  const [rateable, setRateable] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, live, isPending, liveStatus]);

  // Pick up a chat this browser already has open
  useEffect(() => {
    const saved = readSaved(workspaceSlug);
    if (!saved) return;
    resumeChatAction(saved.id)
      .then((result) => {
        if (!result.ok || result.stage === "ended") return writeSaved(workspaceSlug, null);
        setName(saved.name);
        setEmail(saved.email);
        setConversationId(saved.id);
        setMessages(result.messages);
        setStage(result.stage);
      })
      .catch(() => {});
  }, [workspaceSlug]);

  // While handed over: check for the agent's replies every few seconds
  useEffect(() => {
    if (stage !== "live" || !conversationId) return;
    let stopped = false;
    async function check() {
      try {
        const result = await pollChatAction(conversationId!, lastId.current);
        if (stopped || !result.ok) return;
        if (result.messages.length) {
          lastId.current = Math.max(lastId.current, ...result.messages.map((m) => m.id));
          setLive((current) => {
            const seen = new Set(current.map((m) => m.id));
            return [...current, ...result.messages.filter((m) => !seen.has(m.id))];
          });
        }
        setLiveStatus(result.status);
        setAgentName(result.agentName);
        if (result.status === "closed") {
          setStage("ended");
          setRateable(true);
          setEndNote(`${result.agentName ?? "Our team"} marked this as solved. Thanks for contacting ${workspaceName} support.`);
          writeSaved(workspaceSlug, null);
        }
      } catch {
        // A dropped connection; the next check tries again
      }
    }
    check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [stage, conversationId, workspaceSlug, workspaceName]);

  function reset() {
    writeSaved(workspaceSlug, null);
    setStage("intro");
    setMessages([]);
    setLive([]);
    lastId.current = 0;
    setLiveStatus("waiting");
    setAgentName(null);
    setConversationId(null);
    setEndNote(null);
    setRateable(false);
    setError(null);
  }

  function handleStart(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await startSupportChatAction(workspaceSlug, name, email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConversationId(result.conversationId);
      setMessages([result.greeting]);
      setStage("bot");
      writeSaved(workspaceSlug, { id: result.conversationId, name, email });
    });
  }

  // Shared by sending to the bot, "Talk to a person" and "That solved it"
  function run(action: () => Promise<SendResult>, outgoing?: string) {
    setError(null);
    if (outgoing) setMessages((current) => [...current, { role: "customer", body: outgoing }]);

    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessages((current) => [...current, result.reply]);
        if (result.handedOff) {
          setStage("live");
        } else if (!outgoing) {
          // "That solved it" ends the chat
          setStage("ended");
          setRateable(true);
          setEndNote(`Chat closed. Thanks for contacting ${workspaceName} support.`);
          writeSaved(workspaceSlug, null);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function sendLive(message: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await sendLiveMessageAction(conversationId!, message);
        if (!result.ok) {
          setError(result.error);
          setDraft(message);
          return;
        }
        lastId.current = Math.max(lastId.current, result.id);
        setLive((current) =>
          current.some((m) => m.id === result.id)
            ? current
            : [...current, { id: result.id, role: "customer", sender: name, body: message, time: new Date().toISOString(), files: [] }]
        );
      } catch {
        setError("Your message didn't send. Please try again.");
        setDraft(message);
      }
    });
  }

  function send(text: string) {
    const message = text.trim();
    if (!message || !conversationId || isPending) return;
    setDraft("");
    if (stage === "live") sendLive(message);
    else run(() => sendSupportMessageAction(conversationId, message), message);
  }

  function endChat() {
    if (!conversationId) return;
    startTransition(async () => {
      await endLiveChatAction(conversationId).catch(() => null);
      setStage("ended");
      setEndNote(`You ended the chat. We'll reply to ${email} if there's anything more.`);
      writeSaved(workspaceSlug, null);
    });
  }

  if (stage === "intro") {
    return (
      <form onSubmit={handleStart} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-700">Hi! Tell us who you are so our team can follow up if the assistant can&apos;t solve it.</p>

        <label className="block text-sm font-medium text-zinc-700">
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" className={`mt-1 ${inputClass}`} />
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={320}
            autoComplete="email"
            className={`mt-1 ${inputClass}`}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
        >
          {isPending ? "Starting…" : "Start chat"}
        </button>
      </form>
    );
  }

  const customerHasWritten = messages.some((m) => m.role === "customer");
  const handedOver = stage === "live" || live.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {stage === "live" && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm">
          {liveStatus === "live" && agentName ? (
            <p className="flex items-center gap-2 text-zinc-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Chatting with <span className="font-medium text-zinc-900">{agentName}</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-zinc-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden />
              Waiting for an agent to join…
            </p>
          )}
          <button type="button" onClick={endChat} disabled={isPending} className="text-xs font-medium text-zinc-500 hover:text-zinc-800 disabled:opacity-50">
            End chat
          </button>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={message.role === "customer" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                message.role === "customer" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md bg-zinc-100 text-zinc-900"
              }`}
            >
              <p className="whitespace-pre-line">{message.body}</p>
              {message.sources && message.sources.length > 0 && <p className="mt-2 text-xs text-zinc-500">From: {message.sources.join(", ")}</p>}
            </div>
          </div>
        ))}

        {handedOver && (
          <p className="flex items-center gap-3 py-1 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" />
            Passed to the {workspaceName} team
            <span className="h-px flex-1 bg-zinc-200" />
          </p>
        )}

        {live.map((m) =>
          m.role === "customer" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white">
                <p className="whitespace-pre-line">{m.body}</p>
                <p className="mt-1 text-right text-[0.68rem] text-indigo-200">{clock(m.time)}</p>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-end gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[0.65rem] font-semibold text-white" aria-hidden>
                {initials(m.sender)}
              </span>
              <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900">
                <p className="mb-0.5 text-xs font-medium text-emerald-700">{m.sender}</p>
                <p className="whitespace-pre-line">{m.body}</p>
                {m.files.map((f) => (
                  <a key={f.url} href={f.url} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    📎 {f.fileName}
                  </a>
                ))}
                <p className="mt-1 text-[0.68rem] text-zinc-400">{clock(m.time)}</p>
              </div>
            </div>
          )
        )}

        {isPending && stage === "bot" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500">Typing…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="px-4 pb-2 text-sm text-rose-600">
          {error}
        </p>
      )}

      {stage === "ended" ? (
        <div className="space-y-4 border-t border-zinc-100 p-4 text-center text-sm text-zinc-600">
          <p>{endNote}</p>
          {rateable && conversationId && <ChatRating key={conversationId} conversationId={conversationId} />}
          <button type="button" onClick={reset} className="font-medium text-indigo-600 hover:text-indigo-700">
            Start a new chat
          </button>
        </div>
      ) : (
        <div className="space-y-3 border-t border-zinc-100 p-4">
          {stage === "bot" && !customerHasWritten && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  disabled={isPending}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={stage === "live" ? "Write to our team…" : "Type your question…"}
              aria-label="Your message"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={isPending || !draft.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              Send
            </button>
          </form>

          {stage === "bot" && customerHasWritten && conversationId && (
            <div className="flex justify-between text-xs">
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => markResolvedAction(conversationId))}
                className="font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
              >
                ✓ That solved it
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => requestHumanAction(conversationId))}
                className="font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
              >
                Talk to a person
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
