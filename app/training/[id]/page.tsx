import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getAssignment, getCourse } from "@/app/lib/db/training";
import { publicQuestions } from "@/app/lib/training/types";
import { formatDay } from "@/app/lib/roster/types";
import AssignmentStatusBadge from "../AssignmentStatusBadge";
import TakeCourse from "./TakeCourse";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agent, org, role } = await requireSession();
  const canManage = can(role, "training.manage");

  const [course, assignment] = await Promise.all([getCourse(org.id, id), getAssignment(org.id, id, agent.id)]);
  // Drafts are only visible to the people who write courses
  const visible = course && (course.published || canManage);

  return (
    <DashboardLayout>
      <Link href="/training" className="text-sm text-zinc-600 hover:text-zinc-800">
        ← Training
      </Link>

      {!visible ? (
        <p className="mt-6 text-zinc-600">This course doesn&apos;t exist or isn&apos;t published yet.</p>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{course.title}</h1>
              {course.description && <p className="mt-1 text-zinc-600">{course.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              {assignment && <AssignmentStatusBadge assignment={assignment} />}
              {canManage && (
                <Link href={`/training/${course.id}/edit`} className="text-sm text-indigo-600 hover:underline">
                  Edit
                </Link>
              )}
            </div>
          </div>

          {assignment && (
            <p className="mt-3 text-xs text-zinc-500">
              {assignment.assignedBy ? `Assigned by ${assignment.assignedBy}` : "Self-study"}
              {assignment.reason && ` · ${assignment.reason}`}
              {assignment.dueDate && ` · due ${formatDay(assignment.dueDate)}`}
              {assignment.attempts > 0 && ` · ${assignment.attempts} attempt${assignment.attempts === 1 ? "" : "s"}, best ${assignment.bestScore}%`}
            </p>
          )}
          {!course.published && <p className="mt-3 text-sm text-amber-700">Draft: agents can&apos;t see this yet.</p>}

          <article className="mt-6 whitespace-pre-line rounded-xl border border-zinc-200 bg-white p-6 leading-relaxed text-zinc-800">
            {course.body || "This course has no lesson text."}
          </article>

          {course.questions.length > 0 && course.published && (
            <TakeCourse courseId={course.id} questions={publicQuestions(course.questions)} passPercent={course.passPercent} />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
