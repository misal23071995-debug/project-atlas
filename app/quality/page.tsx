import Link from "next/link";
import { StatusBadge } from "@/app/components/ui/Badges";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getQualityOverview } from "@/app/lib/db/quality";
import { scoreBand } from "@/app/lib/quality/types";
import { formatDateTime } from "@/app/lib/tickets";

export const dynamic = "force-dynamic";

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-500">—</span>;
  return <span className={`font-semibold ${scoreBand(value).className}`}>{value}%</span>;
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

export default async function QualityPage() {
  const { agent, org, role } = await requireSession();
  const isReviewer = can(role, "quality.review");
  // Agents see only their own results
  const overview = await getQualityOverview(org.id, isReviewer ? {} : { agentName: agent.name });

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{isReviewer ? "Quality" : "My quality"}</h1>
          <p className="mt-1 max-w-3xl text-zinc-400">
            {isReviewer
              ? "AI scores each conversation against your scorecard. A reviewer checks the score, adjusts it and gives the agent feedback."
              : "How your conversations were scored by the quality team in the last 30 days."}
          </p>
        </div>
        {can(role, "quality.scorecard") && (
          <Link
            href="/quality/scorecard"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Edit scorecard
          </Link>
        )}
      </div>

      {overview === null ? (
        <p className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Run supabase/migrations/007_quality.sql in the Supabase SQL Editor to turn on quality checks.
        </p>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Average QA score" value={<Score value={overview.average} />} hint="final reviews, last 30 days" />
            <Stat label="Reviews done" value={overview.reviewed} hint="last 30 days" />
            {isReviewer ? (
              <Stat
                label="AI vs reviewer gap"
                value={overview.aiGap === null ? "—" : `${overview.aiGap} pts`}
                hint="how far the AI's score was from the final one; lower is better"
              />
            ) : (
              <Stat
                label="Weakest area"
                value={<span className="text-xl">{overview.byCriterion[0]?.label ?? "—"}</span>}
                hint="your lowest-scoring criterion"
              />
            )}
          </section>

          {isReviewer && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold">Ready to review</h2>
              <p className="mt-1 text-sm text-zinc-400">Tickets with agent replies that haven&apos;t been reviewed yet.</p>

              {overview.queue.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">Nothing waiting. Every answered ticket has been reviewed.</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-900 text-left text-zinc-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">Ticket</th>
                        <th className="px-4 py-3 font-medium">Agent</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">AI score</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {overview.queue.map((item) => (
                        <tr key={item.ticketId} className="border-t border-zinc-800">
                          <td className="px-4 py-3">
                            <p className="font-medium text-zinc-100">#{item.ticketId}</p>
                            <p className="max-w-md truncate text-xs text-zinc-500">{item.subject}</p>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">{item.agentName}</td>
                          <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                          <td className="px-4 py-3">
                            <Score value={item.aiTotal} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/quality/${item.ticketId}`} className="font-medium text-indigo-400 hover:underline">
                              Review →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {isReviewer && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-lg font-semibold">By agent</h2>
                {overview.byAgent.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500">No reviews yet.</p>
                ) : (
                  <table className="mt-4 min-w-full text-sm">
                    <thead className="text-left text-zinc-500">
                      <tr>
                        <th className="pb-2 font-medium">Agent</th>
                        <th className="pb-2 font-medium">Reviews</th>
                        <th className="pb-2 font-medium">Average</th>
                        <th className="pb-2 font-medium">Coach on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.byAgent.map((row) => (
                        <tr key={row.name} className="border-t border-zinc-800">
                          <td className="py-2 text-zinc-100">{row.name}</td>
                          <td className="py-2 text-zinc-400">{row.reviews}</td>
                          <td className="py-2">
                            <Score value={row.average} />
                          </td>
                          <td className="py-2 text-zinc-400">{row.weakest ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold">By criterion</h2>
              <p className="mt-1 text-xs text-zinc-500">Lowest first: where coaching helps most</p>
              {overview.byCriterion.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">No reviews yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {overview.byCriterion.map((row) => (
                    <li key={row.label}>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-300">{row.label}</span>
                        <Score value={row.average} />
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-zinc-800">
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${row.average}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`rounded-xl border border-zinc-800 bg-zinc-900 p-6 ${isReviewer ? "lg:col-span-2" : ""}`}>
              <h2 className="text-lg font-semibold">Recent reviews</h2>
              {overview.recent.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">No reviews yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-zinc-800">
                  {overview.recent.map((review) => (
                    <li key={review.ticketId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <Link href={`/quality/${review.ticketId}`} className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100 hover:underline">
                          #{review.ticketId} · {review.subject}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {review.agentName} · reviewed by {review.reviewedBy ?? "—"} · {formatDateTime(review.reviewedAt)}
                        </p>
                      </Link>
                      <div className="text-right text-sm">
                        <Score value={review.total} />
                        {review.aiTotal !== null && <p className="text-xs text-zinc-500">AI said {review.aiTotal}%</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
