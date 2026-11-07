import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { PageHeader, Panel, buttonSecondary } from "@/app/components/ui/Panel";
import { initials } from "@/app/lib/auth/agent";
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
        <PageHeader title="Review not found" back={{ href: "/quality", label: "Quality" }} />
        <p className="text-sm text-zinc-600">This review doesn&apos;t exist or isn&apos;t yours to see.</p>
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
      <PageHeader
        back={{ href: "/quality", label: "Quality" }}
        title={`Review ticket #${ticket.id}`}
        description={
          <>
            {ticket.subject} · agent <span className="font-medium text-zinc-700">{agentName}</span>
          </>
        }
        actions={
          <Link href={`/tickets/${ticket.id}`} className={buttonSecondary}>
            Open ticket ↗
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="Conversation" className="lg:col-span-3">
          <ol className="space-y-3">
            {ticket.conversation.map((message, index) => {
              const agentMsg = message.role === "agent";
              return (
                <li key={index} className="flex gap-3">
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      agentMsg ? "bg-indigo-600 text-white" : "bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {initials(message.sender)}
                  </span>
                  <div className={`min-w-0 flex-1 rounded-lg border px-4 py-3 ${agentMsg ? "border-indigo-100 bg-indigo-50/40" : "border-zinc-200 bg-white"}`}>
                    <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-zinc-900">
                      <span>
                        {message.sender}
                        <span className="ml-2 text-xs font-normal text-zinc-500">{agentMsg ? "Agent" : "Customer"}</span>
                      </span>
                      <time className="text-xs font-normal text-zinc-500">{formatDateTime(message.time)}</time>
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-zinc-800">{message.message}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <div className="lg:col-span-2">
          {hasAgentReply ? (
            <ReviewForm
              ticketId={ticket.id}
              criteria={criteria}
              review={review}
              readOnly={!isReviewer}
            />
          ) : (
            <Panel title="Scorecard">
              <p className="text-sm text-zinc-600">No agent has replied on this ticket yet, so there&apos;s nothing to score.</p>
            </Panel>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
