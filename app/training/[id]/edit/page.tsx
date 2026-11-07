import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard-layout";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { listArticles } from "@/app/lib/db/bot";
import { getScorecard } from "@/app/lib/db/quality";
import { getCourse, listAssignments } from "@/app/lib/db/training";
import CourseEditor from "../../CourseEditor";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org, role } = await requireSession();
  if (!can(role, "training.manage")) redirect(`/training/${id}`);

  const [course, criteria, articles, members, assignments] = await Promise.all([
    getCourse(org.id, id),
    getScorecard(org.id),
    listArticles(org.id).catch(() => []),
    listMembers(org.id),
    listAssignments(org.id, { courseId: id }),
  ]);

  return (
    <DashboardLayout>
      <Link href="/training" className="text-sm text-zinc-600 hover:text-zinc-800">
        ← Training
      </Link>
      {course ? (
        <>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Edit course</h1>
            {course.published && (
              <Link href={`/training/${course.id}`} className="text-sm text-indigo-600 hover:underline">
                Preview as an agent ↗
              </Link>
            )}
          </div>
          <CourseEditor
            course={course}
            criteria={criteria.map((c) => ({ id: c.id, label: c.label }))}
            articles={articles.map((a) => ({ id: a.id, title: a.title }))}
            members={members.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
            assignments={assignments ?? []}
          />
        </>
      ) : (
        <p className="mt-6 text-zinc-600">This course doesn&apos;t exist.</p>
      )}
    </DashboardLayout>
  );
}
