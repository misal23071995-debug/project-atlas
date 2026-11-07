import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { listArticles } from "@/app/lib/db/bot";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { formatDateTime } from "@/app/lib/tickets";
import type { KbArticle } from "@/app/lib/bot/types";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const { org, role } = await requireSession();
  const canEdit = can(role, "knowledge.edit");

  let articles: KbArticle[] | null = null;
  try {
    articles = await listArticles(org.id);
  } catch {
    // Most likely migration 003 hasn't been run yet
  }

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Knowledge Base</h1>
          <p className="mt-1 text-zinc-600">
            The AI chatbot answers customers only from published articles. Keep them accurate.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/knowledge/gaps"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Knowledge gaps
          </Link>
          {canEdit && (
            <Link
              href="/knowledge/new"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              New article
            </Link>
          )}
        </div>
      </div>

      {articles === null ? (
        <p className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
          Couldn&apos;t load articles. Run supabase/migrations/003_support_bot.sql in the Supabase SQL Editor, then
          reload this page.
        </p>
      ) : articles.length === 0 ? (
        <p className="mt-8 text-zinc-500">No articles yet. Add one so the chatbot has something to answer from.</p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
          <table className="min-w-full text-sm">
            <thead className="bg-white text-left text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/knowledge/${article.id}`} className="font-medium text-indigo-600 hover:underline">
                      {article.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{article.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        article.published ? "bg-emerald-500/15 text-emerald-600" : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {article.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{formatDateTime(article.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
