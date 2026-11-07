import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { getArticle } from "@/app/lib/db/bot";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import ArticleForm from "../ArticleForm";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org, role } = await requireSession();
  const article = await getArticle(org.id, id);
  const canEdit = can(role, "knowledge.edit");

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <Link href="/knowledge" className="text-sm text-zinc-600 hover:text-zinc-800">
          ← Knowledge Base
        </Link>

        {article ? (
          <>
            {canEdit ? (
              <>
                <h1 className="mt-2 text-3xl font-bold">Edit article</h1>
                <ArticleForm article={article} />
              </>
            ) : (
              <article className="mt-2">
                <h1 className="text-3xl font-bold">{article.title}</h1>
                <p className="mt-1 text-sm text-zinc-500">{article.category}</p>
                <p className="mt-6 whitespace-pre-line text-zinc-800">{article.body}</p>
              </article>
            )}
          </>
        ) : (
          <p className="mt-6 text-zinc-600">This article doesn&apos;t exist.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
