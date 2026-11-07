import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getTicket } from "@/app/lib/db/tickets";
import { agentForTicket, getReview, getScorecard } from "@/app/lib/db/quality";
import { formatDateTime } from "@/app/lib/tickets";
import ReviewForm from "./ReviewForm";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const { agent, org, role } = await requireSession();
  const isReviewer = can(role, "quality.review");

  const [ticket, review, criteria] = await Promise.all([
    getTicket(org.id, ticketId),
    getReview(org.id, ticketId),
    getScorecard(org.id),
  ]);

  // Agents may only open their own finished reviews
  const allowed =
    ticket && (isReviewer || (review?.status === "reviewed" && review.agentName === agent.name));

  if (!ticket || !allowed) {
    return (
      <DashboardLayout>
        <Link href="/quality" className="text-sm text-zinc-600 hover:text-zinc-800">
          ← Quality
        </Link>
        <p className="mt-6 text-zinc-600">This review doesn&apos;t exist or isn&apos;t yours to see.</p>
      </DashboardLayout>
    );
  }

  const agentName =
    review?.agentName ??
    agentForTicket(
      ticket.assignedTo,
      ticket.conversation.map((m) => ({ sender: m.sender, role: m.role, created_at: m.time }))
    );
  const hasAgentReply = ticket.conversation.some((m) => m.role === "agent");

  return (
    <DashboardLayout>
      <Link href="/quality" className="text-sm text-zinc-600 hover:text-zinc-800">
        ← Quality
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold">Review ticket #{ticket.id}</h1>
          <p className="mt-1 text-zinc-600">
            {ticket.subject} · agent <span className="text-zinc-800">{agentName}</span>
          </p>
        </div>
        <Link href={`/tickets/${ticket.id}`} className="text-sm text-indigo-600 hover:underline">
          Open ticket ↗
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 lg:col-span-3">
          <h2 className="mb-4 text-lg font-semibold">Conversation</h2>
          <div className="space-y-4">
            {ticket.conversation.map((message, index) => (
              <div
                key={index}
                className={message.role === "customer" ? "rounded-lg bg-zinc-100 p-4" : "ml-8 rounded-lg bg-indigo-600/20 p-4"}
              >
                <p className="text-sm font-medium">
                  {message.sender}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {message.role === "agent" ? "Agent" : "Customer"} · {formatDateTime(message.time)}
                  </span>
                </p>
                <p className="mt-2 whitespace-pre-line text-sm">{message.message}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="lg:col-span-2">
          {hasAgentReply ? (
            <ReviewForm
              ticketId={ticket.id}
              criteria={criteria}
              review={review}
              readOnly={!isReviewer}
            />
          ) : (
            <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              No agent has replied on this ticket yet, so there&apos;s nothing to score.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
