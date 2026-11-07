import { useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import type { ChatMessage as ChatMessageType } from "../types";

type Props = {
  messages: ChatMessageType[];
  isThinking: boolean;
  onCreateTicket: (message: ChatMessageType) => void;
};


export default function ChatWindow({
  messages,
  isThinking,
  onCreateTicket,
}: Props) {
 const bottomRef = useRef<HTMLDivElement | null>(null);
 useEffect(() => {
  bottomRef.current?.scrollIntoView({
    behavior: "smooth",
  });
}, [messages, isThinking]);

return (
    <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 h-96 overflow-y-auto p-4">
      {messages.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No conversation yet.
        </p>
      ) : (
        <div className="space-y-6">
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              message={message}
              onCreateTicket={onCreateTicket}
            />
          ))}
          {isThinking && (
            <div className="flex justify-start">
                <div className="rounded-xl bg-zinc-100 px-4 py-3">
                <p className="animate-pulse">
                    🤖 Atlas is thinking...
                </p>
                </div>
            </div>
            )}
            <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
