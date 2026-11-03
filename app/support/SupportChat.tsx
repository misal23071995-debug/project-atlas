"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { MAX_MESSAGE_LENGTH, type BotChatMessage } from "@/app/lib/bot/types";
import {
  markResolvedAction,
  requestHumanAction,
  sendSupportMessageAction,
  startSupportChatAction,
  type SendResult,
} from "./actions";
import ChatRating from "./ChatRating";

type ChatState = "intro" | "chatting" | "ended";

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

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
  const [state, setState] = useState<ChatState>("intro");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BotChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [endNote, setEndNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

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
      setState("chatting");
    });
  }

  // Shared by sending, "Talk to a person" and "That solved it"
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
          setState("ended");
          setEndNote(`Passed to our support team. We'll reply to ${email}.`);
        } else if (!outgoing) {
          // "That solved it" ends the chat too
          setState("ended");
          setEndNote(`Chat closed. Thanks for contacting ${workspaceName} support.`);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function send(text: string) {
    const message = text.trim();
    if (!message || !conversationId || isPending) return;
    setDraft("");
    run(() => sendSupportMessageAction(conversationId, message), message);
  }

  if (state === "intro") {
    return (
      <form onSubmit={handleStart} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-sm text-zinc-300">
          Hi! Tell us who you are so our team can follow up if the assistant can&apos;t solve it.
        </p>

        <label className="block text-sm text-zinc-400">
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            className={`mt-1 ${inputClass}`}
          />
        </label>

        <label className="block text-sm text-zinc-400">
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

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {isPending ? "Starting…" : "Start chat"}
        </button>
      </form>
    );
  }

  const customerHasWritten = messages.some((m) => m.role === "customer");

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={message.role === "customer" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                message.role === "customer" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-100"
              }`}
            >
              <p className="whitespace-pre-line">{message.body}</p>
              {message.sources && message.sources.length > 0 && (
                <p className="mt-2 text-xs text-zinc-400">From: {message.sources.join(", ")}</p>
              )}
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-400">Typing…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p role="alert" className="px-4 pb-2 text-sm text-red-400">{error}</p>}

      {state === "ended" ? (
        <div className="space-y-4 border-t border-zinc-800 p-4 text-center text-sm text-zinc-400">
          <p>{endNote}</p>
          {conversationId && <ChatRating key={conversationId} conversationId={conversationId} />}
          <button
            type="button"
            onClick={() => {
              setState("intro");
              setMessages([]);
              setConversationId(null);
              setEndNote(null);
            }}
            className="text-indigo-400 hover:text-indigo-300"
          >
            Start a new chat
          </button>
        </div>
      ) : (
        <div className="space-y-3 border-t border-zinc-800 p-4">
          {!customerHasWritten && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  disabled={isPending}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-indigo-500 hover:text-white"
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
              placeholder="Type your question…"
              aria-label="Your message"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={isPending || !draft.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Send
            </button>
          </form>

          {customerHasWritten && conversationId && (
            <div className="flex justify-between text-xs">
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => markResolvedAction(conversationId))}
                className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
              >
                ✓ That solved it
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => requestHumanAction(conversationId))}
                className="text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
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
