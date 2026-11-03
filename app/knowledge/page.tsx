import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { listArticles } from "@/app/lib/db/bot";
import { formatDateTime } from "@/app/lib/tickets";
import type { KbArticle } from "@/app/lib/bot/types";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  let articles: KbArticle[] | null = null;
  try {
    articles = await listArticles();
  } catch {
    // Most likely migration 003 hasn't been run yet
  }

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="mt-1 text-zinc-400">
            The AI chatbot answers customers only from published articles. Keep them accurate.
          </p>
        </div>

        <Link
          href="/knowledge/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          New article
        </Link>
      </div>

      {articles === null ? (
        <p className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Couldn&apos;t load articles. Run supabase/migrations/003_support_bot.sql in the Supabase SQL Editor, then
          reload this page.
        </p>
      ) : articles.length === 0 ? (
        <p className="mt-8 text-zinc-500">No articles yet. Add one so the chatbot has something to answer from.</p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900 text-left text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                  <td className="px-4 py-3">
                    <Link href={`/knowledge/${article.id}`} className="font-medium text-indigo-400 hover:underline">
                      {article.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{article.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        article.published ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700 text-zinc-300"
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
