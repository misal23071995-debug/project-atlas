import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { getArticle } from "@/app/lib/db/bot";
import ArticleForm from "../ArticleForm";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticle(id);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <Link href="/knowledge" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Knowledge Base
        </Link>

        {article ? (
          <>
            <h1 className="mt-2 text-3xl font-bold">Edit article</h1>
            <ArticleForm article={article} />
          </>
        ) : (
          <p className="mt-6 text-zinc-400">This article doesn&apos;t exist.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
