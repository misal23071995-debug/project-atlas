"use client";

import { analyzeMessage } from "@/app/lib/ai";
import { useState } from "react";
import type { ChatMessage } from "./types";
import ChatInput from "./components/ChatInput";
import ChatWindow from "./components/ChatWindow";
import QuickActions from "./components/QuickActions";
import { createTicket } from "@/app/lib/ticketStore";
import type { Ticket } from "@/app/lib/tickets";
import { useRouter } from "next/navigation";

export default function ChatPage() {
const [message, setMessage] = useState("");
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [isThinking, setIsThinking] = useState(false);
const router = useRouter();
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
function handleCreateTicket(message: ChatMessage) {
  if (!message.analysis) return;

  const ticket: Ticket = {
  id: Date.now().toString(),

  subject: message.analysis.intent,

  description: message.content,

  summary: message.analysis.summary,

  intent: message.analysis.intent,

  sentiment: message.analysis.sentiment,

  confidence: message.analysis.confidence,

  priority:
    message.analysis.sentiment === "Angry"
      ? "High"
      : message.analysis.sentiment === "Frustrated"
      ? "Medium"
      : "Low",

  status: "Open",

  customerName: "Rahul Sharma",

  email: "rahul.sharma@gmail.com",

  createdAt: new Date().toLocaleString(),

  category: message.analysis.intent,

  channel: "AI Assistant",

  tags: [message.analysis.intent],

  conversation: [
    {
      sender: "Rahul Sharma",
      role: "customer",
      message: message.content,
      time: new Date().toLocaleTimeString(),
    },
  ],
};

  createTicket(ticket);

  router.push("/tickets");
}
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
            onCreateTicket={handleCreateTicket}
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