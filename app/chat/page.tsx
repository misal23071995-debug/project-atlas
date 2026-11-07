"use client";

import { fetchAnalysis } from "@/app/lib/ai/client";
import { useState } from "react";
import type { ChatMessage } from "./types";
import ChatInput from "./components/ChatInput";
import ChatWindow from "./components/ChatWindow";
import QuickActions from "./components/QuickActions";
import { createTicketAction } from "@/app/tickets/actions";
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

  const result = await fetchAnalysis(userMessage);

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
async function handleCreateTicket(message: ChatMessage) {
  if (!message.analysis) return;

  const analysis = message.analysis;

  // The customer's own words, not the AI reply
  const index = messages.indexOf(message);
  const customerMessage =
    messages
      .slice(0, index)
      .reverse()
      .find((m) => m.role === "user")?.content ?? message.content;

  try {
    const id = await createTicketAction({
      // TODO: replace with the real customer once channels and sign-in exist
      customerName: "Rahul Sharma",
      customerEmail: "rahul.sharma@gmail.com",
      subject: analysis.summary || analysis.intent,
      description: customerMessage,
      summary: analysis.summary,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      priority:
        analysis.sentiment === "Angry"
          ? "High"
          : analysis.sentiment === "Frustrated"
          ? "Medium"
          : "Low",
      channel: "AI Assistant",
      category: analysis.intent,
      tags: [analysis.intent],
    });

    router.push(`/tickets/${id}`);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not create ticket");
  }
}
  return (
    <div className="min-h-screen bg-zinc-50 text-white flex justify-center py-10">
      <div className="w-full max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 shadow-lg">

        <h1 className="text-3xl font-bold">
          Atlas AI Assistant
        </h1>

        <p className="mt-2 text-zinc-600">
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