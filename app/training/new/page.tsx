import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard-layout";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { listArticles } from "@/app/lib/db/bot";
import { getScorecard } from "@/app/lib/db/quality";
import CourseEditor from "../CourseEditor";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const { org, role } = await requireSession();
  if (!can(role, "training.manage")) redirect("/training");

  const [criteria, articles, members] = await Promise.all([
    getScorecard(org.id),
    listArticles(org.id).catch(() => []),
    listMembers(org.id),
  ]);

  return (
    <DashboardLayout>
      <Link href="/training" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
        ← Training
      </Link>
      <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900">New course</h1>
      <CourseEditor
        course={null}
        criteria={criteria.map((c) => ({ id: c.id, label: c.label }))}
        articles={articles.map((a) => ({ id: a.id, title: a.title }))}
        members={members.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        assignments={[]}
      />
    </DashboardLayout>
  );
}
