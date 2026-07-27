"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { tickets } from "@/app/lib/data/tickets";

import DashboardLayout from "@/app/components/dashboard-layout";
import ReplyEditor from "@/app/components/ui/ReplyEditor";
import CustomerCard from "@/app/components/ui/CustomerCard";
import TicketInfoCard from "@/app/components/ui/TicketInfoCard";
import InternalNotes from "@/app/components/ui/InternalNotes";
import ActivityTimeline from "@/app/components/ui/ActivityTimeline";
import AICopilot from "@/app/components/ui/AICopilot";

export default function TicketDetailsPage() {
  const { id } = useParams();
  const ticketData = tickets.find(
  (ticket) => ticket.id === id
  );
  if (!ticketData) {
  return (
    <DashboardLayout>
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold">
          Ticket not found
        </h1>

        <p className="mt-2 text-zinc-500">
          This ticket does not exist.
        </p>
      </div>
    </DashboardLayout>
  );
}

  // Reply shared between AI Copilot and Reply Editor
  const [reply, setReply] = useState("");

  // Ticket State
  const [ticket, setTicket] = useState({
    status: "Open",
    priority: "High",
    assignedTo: "Sarah K.",
  });
  const [conversation, setConversation] = useState(
  ticketData.conversation
);
  // Activity Timeline
  const [activities, setActivities] = useState([
    {
      title: "Ticket Created",
      time: "Today • 9:42 AM",
      color: "bg-green-500",
    },
  ]);

  function addActivity(title: string, color: string) {
    setActivities((prev) => [
      {
        title,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        color,
      },
      ...prev,
    ]);
  }
  function handleSendReply() {
    if (!reply.trim()) return;

    setConversation((prev) => [
      ...prev,
      {
        sender: "Support",
        role: "agent",
        message: reply,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

  addActivity("Reply sent", "bg-indigo-500");

  setReply("");
}
const latestCustomerMessage =
  [...conversation]
    .reverse()
    .find((message) => message.role === "customer")
    ?.message ?? "";
    
  return (
    <DashboardLayout>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT SIDE */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">
              Ticket {id}
            </h1>

            <p className="mt-1 text-zinc-400">
              Customer support conversation
            </p>
          </div>

          {/* Conversation */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-6 text-lg font-semibold">
              Conversation
            </h2>

          <div className="space-y-4">
            {conversation.map((message, index) => (
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

                <p className="mt-2 text-sm">
                  {message.message}
                </p>

                <p className="mt-2 text-xs text-zinc-500">
                  {message.time}
                </p>
              </div>
            ))}
          </div>

          </div>

          {/* Reply Editor */}
          <ReplyEditor
            value={reply}
            onChange={setReply}
            onSend={handleSendReply}
          />

          {/* Internal Notes */}
          <InternalNotes />

          {/* Activity Timeline */}
          <ActivityTimeline
            activities={activities}
          />
        </div>

        {/* RIGHT SIDE */}
        <div className="space-y-6">
          <CustomerCard
          name={ticketData.customer}
          email={ticketData.email}
          customerSince={ticketData.customerSince}
          orders={ticketData.orders}
          csat={ticketData.csat}
          location={ticketData.location}
          device={ticketData.device}
          />

          <TicketInfoCard
            status={ticket.status}
            priority={ticket.priority}
            assignedTo={ticket.assignedTo}
            channel={ticketData.channel}
            category={ticketData.category}
            created={ticketData.created}
            tags={ticketData.tags}
            onStatusChange={(status) => {
              addActivity(`Status changed to ${status}`, "bg-blue-500");

              setTicket((prev) => ({
                ...prev,
                status,
              }));
            }}
            onPriorityChange={(priority) => {
              addActivity(`Priority changed to ${priority}`, "bg-orange-500");

              setTicket((prev) => ({
                ...prev,
                priority,
              }));
            }}
            onAssignedChange={(assignedTo) => {
              addActivity(`Assigned to ${assignedTo}`, "bg-purple-500");

              setTicket((prev) => ({
                ...prev,
                assignedTo,
              }));
            }}
          />

          <AICopilot
            customerMessage={latestCustomerMessage}
            onUseReply={setReply}

          />
        </div>
      </div>
    </DashboardLayout>
  );
}