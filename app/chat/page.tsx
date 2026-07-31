"use client";

import { analyzeMessage } from "@/app/lib/ai";
import { useState } from "react";
import type { ChatMessage } from "./types";
import ChatInput from "./components/ChatInput";
import ChatWindow from "./components/ChatWindow";
import QuickActions from "./components/QuickActions";

export default function ChatPage() {
const [message, setMessage] = useState("");
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [isThinking, setIsThinking] = useState(false);
const handleSend = async () => {
  if (!message.trim()) return;

  const userMessage = message;

  setMessages((prev) => [
    ...prev,
    {
      role: "user",
      content: userMessage,
    },
  ]);

  setMessage("");
  setIsThinking(true);

  // Simulate AI thinking
  await new Promise((resolve) => setTimeout(resolve, 700));

  const result = analyzeMessage(userMessage);

  setMessages((prev) => [
    ...prev,
    {
      role: "assistant",
      content: result.suggestedReply,
      analysis: result,
    },
  ]);

  setIsThinking(false);
};
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex justify-center py-10">
      <div className="w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">

        <h1 className="text-3xl font-bold">
          Atlas AI Assistant
        </h1>

        <p className="mt-2 text-zinc-400">
          Ask Atlas anything before creating a support ticket.
        </p>

        <ChatWindow
            messages={messages}
            isThinking={isThinking}
        />
        
        <QuickActions
        onSelect={(selectedMessage) => {
            setMessage(selectedMessage);
        }}
        />

        <ChatInput
            value={message}
            onChange={setMessage}
            onSend={handleSend}
        />

      </div>
    </div>
  );

  
}