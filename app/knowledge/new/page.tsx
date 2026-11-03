import DashboardLayout from "@/app/components/dashboard-layout";
import { KB_CATEGORIES, type KbCategory } from "@/app/lib/bot/types";
import ArticleForm from "../ArticleForm";

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; question?: string }>;
}) {
  // Filled in when coming from "Write article" on the Knowledge Gaps report
  const { category, question } = await searchParams;
  const defaultCategory = KB_CATEGORIES.includes(category as KbCategory) ? category : undefined;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">New article</h1>

        {question && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="text-amber-300">A customer asked the chatbot:</p>
            <p className="mt-1 text-zinc-100">&ldquo;{question}&rdquo;</p>
            <p className="mt-2 text-xs text-zinc-400">Write an article that answers this and similar questions.</p>
          </div>
        )}

        <ArticleForm defaultCategory={defaultCategory} />
      </div>
    </DashboardLayout>
  );
}
