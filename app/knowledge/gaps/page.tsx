import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { getKnowledgeGaps } from "@/app/lib/db/bot";
import { requireSession } from "@/app/lib/auth/session";
import { HANDOFF_LABELS, type HandoffType } from "@/app/lib/bot/types";
import { formatDateTime } from "@/app/lib/tickets";

export const dynamic = "force-dynamic";

function typeLabel(type: HandoffType | "unknown") {
  return type === "unknown" ? "Not recorded" : HANDOFF_LABELS[type];
}

function newArticleLink(topic: string, question: string) {
  const params = new URLSearchParams({ category: topic, question: question.slice(0, 300) });
  return `/knowledge/new?${params}`;
}

export default async function KnowledgeGapsPage() {
  const { org } = await requireSession();
  const gaps = await getKnowledgeGaps(org.id);

  return (
    <DashboardLayout>
      <Link href="/knowledge" className="text-sm text-zinc-600 hover:text-zinc-800">
        ← Knowledge Base
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Knowledge gaps</h1>
      <p className="mt-1 max-w-3xl text-zinc-600">
        Why the AI chatbot handed customers to an agent in the last 30 days. Questions with no matching article
        are the quickest wins: write the article, and the bot answers next time.
      </p>

      {gaps === null ? (
        <p className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
          Run supabase/migrations/004_handoff_reasons.sql in the Supabase SQL Editor to turn on this report.
        </p>
      ) : gaps.handoffs === 0 ? (
        <p className="mt-8 text-zinc-500">
          No handovers in the last 30 days{gaps.totalChats ? `, out of ${gaps.totalChats} chats` : ""}. Nothing to fix.
        </p>
      ) : (
        <>
          <section className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-zinc-600">Handovers</p>
              <p className="mt-1 text-2xl font-bold">
                {gaps.handoffs}
                <span className="ml-1 text-sm font-normal text-zinc-500">of {gaps.totalChats} chats</span>
              </p>
            </div>
            {gaps.byType.map((item) => (
              <div key={item.type} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-zinc-600">{typeLabel(item.type)}</p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    item.type === "not_covered" ? "text-amber-600" : "text-zinc-900"
                  }`}
                >
                  {item.count}
                  <span className="ml-1 text-sm font-normal text-zinc-500">
                    {Math.round((item.count / gaps.handoffs) * 100)}%
                  </span>
                </p>
              </div>
            ))}
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-semibold">Missing articles</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Customers asked these, and no published article answered them.
            </p>

            {gaps.missingArticles.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">None. Every handover had another reason.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {gaps.missingArticles.map((group) => (
                  <div key={group.topic} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        {group.topic}
                        <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600">
                          {group.items.length} {group.items.length === 1 ? "chat" : "chats"}
                        </span>
                      </h3>
                      <Link
                        href={newArticleLink(group.topic, group.items[0].question)}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                      >
                        Write article
                      </Link>
                    </div>

                    <ul className="mt-4 space-y-3">
                      {group.items.map((item) => (
                        <li key={item.conversationId} className="rounded-lg bg-zinc-50 p-3 text-sm">
                          <p className="text-zinc-900">&ldquo;{item.question}&rdquo;</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {formatDateTime(item.createdAt)}
                            {item.ticketId && (
                              <>
                                {" · "}
                                <Link href={`/tickets/${item.ticketId}`} className="text-indigo-600 hover:underline">
                                  Ticket #{item.ticketId}
                                </Link>
                              </>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {gaps.otherHandoffs.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold">Other handovers</h2>
              <p className="mt-1 text-sm text-zinc-600">
                The bot couldn&apos;t finish these on its own. Look for repeats: a frequent staff action may be
                worth a process change.
              </p>

              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-white text-left text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Question</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Topic</th>
                      <th className="px-4 py-3 font-medium">Ticket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.otherHandoffs.map((item) => (
                      <tr key={item.conversationId} className="border-t border-zinc-200 align-top">
                        <td className="max-w-md px-4 py-3 text-zinc-900">{item.question}</td>
                        <td className="px-4 py-3">
                          <p className="text-zinc-700">{typeLabel(item.type)}</p>
                          {item.reason && <p className="mt-0.5 text-xs text-zinc-500">{item.reason}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">{item.topic}</td>
                        <td className="px-4 py-3">
                          {item.ticketId ? (
                            <Link href={`/tickets/${item.ticketId}`} className="text-indigo-600 hover:underline">
                              #{item.ticketId}
                            </Link>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
