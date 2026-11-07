import Link from "next/link";
import { StatusBadge } from "@/app/components/ui/Badges";
import DashboardLayout from "@/app/components/dashboard-layout";
import { EmptyState, Notice, PageHeader, Panel, StatStrip, buttonSecondary, td, th } from "@/app/components/ui/Panel";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getQualityOverview } from "@/app/lib/db/quality";
import { scoreBand } from "@/app/lib/quality/types";
import { formatDateTime } from "@/app/lib/tickets";

export const dynamic = "force-dynamic";

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-500">—</span>;
  return <span className={`font-semibold tabular-nums ${scoreBand(value).className}`}>{value}%</span>;
}

export default async function QualityPage() {
  const { agent, org, role } = await requireSession();
  const isReviewer = can(role, "quality.review");
  // Agents see only their own results
  const overview = await getQualityOverview(org.id, isReviewer ? {} : { agentName: agent.name });

  return (
    <DashboardLayout>
      <PageHeader
        title={isReviewer ? "Quality" : "My quality"}
        description={
          isReviewer
            ? "AI scores each conversation against your scorecard. A reviewer checks the score, adjusts it and gives the agent feedback."
            : "How your conversations were scored by the quality team in the last 30 days."
        }
        actions={
          can(role, "quality.scorecard") && (
            <Link href="/quality/scorecard" className={buttonSecondary}>
              Edit scorecard
            </Link>
          )
        }
      />

      {overview === null ? (
        <Notice>Run supabase/migrations/007_quality.sql in the Supabase SQL Editor to turn on quality checks.</Notice>
      ) : (
        <>
          <StatStrip
            stats={[
              { label: "Average QA score", value: <Score value={overview.average} />, hint: "final reviews, last 30 days" },
              { label: "Reviews done", value: overview.reviewed, hint: "last 30 days" },
              isReviewer
                ? {
                    label: "AI vs reviewer gap",
                    value: overview.aiGap === null ? "—" : `${overview.aiGap} pts`,
                    hint: "how far the AI's score was from the final one; lower is better",
                  }
                : { label: "Weakest area", value: <span className="text-lg">{overview.byCriterion[0]?.label ?? "—"}</span>, hint: "your lowest-scoring criterion" },
            ]}
          />

          {isReviewer && (
            <Panel
              title="Ready to review"
              description="Tickets with agent replies that haven't been reviewed yet"
              action={<span className="text-xs tabular-nums text-zinc-500">{overview.queue.length} waiting</span>}
              className="mt-4"
              flush
            >
              {overview.queue.length === 0 ? (
                <EmptyState>Nothing waiting. Every answered ticket has been reviewed.</EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className={th}>Ticket</th>
                        <th className={th}>Agent</th>
                        <th className={th}>Status</th>
                        <th className={th}>AI score</th>
                        <th className={th} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {overview.queue.map((item) => (
                        <tr key={item.ticketId} className="hover:bg-zinc-50/60">
                          <td className={`${td} max-w-md`}>
                            <p className="truncate font-medium text-zinc-900">{item.subject}</p>
                            <p className="font-mono text-xs text-zinc-500">#{item.ticketId}</p>
                          </td>
                          <td className={`${td} whitespace-nowrap text-zinc-700`}>{item.agentName}</td>
                          <td className={td}>
                            <StatusBadge status={item.status} />
                          </td>
                          <td className={td}>
                            <Score value={item.aiTotal} />
                          </td>
                          <td className={`${td} text-right`}>
                            <Link href={`/quality/${item.ticketId}`} className="whitespace-nowrap text-xs font-medium text-indigo-600 hover:text-indigo-700">
                              Review →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {isReviewer && (
              <Panel title="By agent" flush>
                {overview.byAgent.length === 0 ? (
                  <EmptyState>No reviews yet.</EmptyState>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className={th}>Agent</th>
                          <th className={`${th} text-right`}>Reviews</th>
                          <th className={`${th} text-right`}>Average</th>
                          <th className={th}>Coach on</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {overview.byAgent.map((row) => (
                          <tr key={row.name}>
                            <td className={`${td} font-medium text-zinc-900`}>{row.name}</td>
                            <td className={`${td} text-right tabular-nums text-zinc-600`}>{row.reviews}</td>
                            <td className={`${td} text-right`}>
                              <Score value={row.average} />
                            </td>
                            <td className={`${td} text-zinc-600`}>{row.weakest ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            )}

            <Panel title="By criterion" description="Lowest first: where coaching helps most">
              {overview.byCriterion.length === 0 ? (
                <p className="text-sm text-zinc-500">No reviews yet.</p>
              ) : (
                <ul className="space-y-3.5">
                  {overview.byCriterion.map((row) => (
                    <li key={row.label}>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-700">{row.label}</span>
                        <Score value={row.average} />
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100">
                        <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${row.average}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recent reviews" className={isReviewer ? "lg:col-span-2" : ""} flush>
              {overview.recent.length === 0 ? (
                <EmptyState>No reviews yet.</EmptyState>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {overview.recent.map((review) => (
                    <li key={review.ticketId}>
                      <Link href={`/quality/${review.ticketId}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-zinc-50/60">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-900">
                            <span className="font-mono text-xs font-normal text-zinc-500">#{review.ticketId}</span> {review.subject}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {review.agentName} · reviewed by {review.reviewedBy ?? "—"} · {formatDateTime(review.reviewedAt)}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <Score value={review.total} />
                          {review.aiTotal !== null && <p className="text-xs text-zinc-500">AI said {review.aiTotal}%</p>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
