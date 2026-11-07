import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { EmptyState, Notice, PageHeader, Panel, StatStrip, buttonPrimary, th } from "@/app/components/ui/Panel";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getScorecard } from "@/app/lib/db/quality";
import { listAssignments, listCourses } from "@/app/lib/db/training";
import { formatDay } from "@/app/lib/roster/types";
import { isOverdue, type Assignment } from "@/app/lib/training/types";
import AssignmentStatusBadge from "./AssignmentStatusBadge";
import RemoveAssignmentButton from "./RemoveAssignmentButton";

export const dynamic = "force-dynamic";

function MyTraining({ assignments, today }: { assignments: Assignment[]; today: string }) {
  // To do first (overdue at the top), then finished
  const sorted = [...assignments].sort((a, b) => {
    const rank = (x: Assignment) => (x.status === "passed" ? 2 : isOverdue(x, today) ? 0 : 1);
    return rank(a) - rank(b) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  return (
    <ul className="divide-y divide-zinc-100">
      {sorted.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <Link href={`/training/${a.courseId}`} className="text-sm font-medium text-zinc-900 hover:text-indigo-700">
              {a.courseTitle}
            </Link>
            <p className="text-xs text-zinc-500">
              {a.assignedBy ? `Assigned by ${a.assignedBy}` : "Self-study"}
              {a.reason && ` · ${a.reason}`}
              {a.dueDate && ` · due ${formatDay(a.dueDate)}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AssignmentStatusBadge assignment={a} today={today} />
            {a.status !== "passed" && (
              <Link
                href={`/training/${a.courseId}`}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500"
              >
                {a.attempts ? "Try again" : "Start"}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function TrainingPage() {
  const { agent, org, role } = await requireSession();
  const canManage = can(role, "training.manage");
  const today = new Date().toISOString().slice(0, 10);

  const [courses, assignments, members, criteria] = await Promise.all([
    listCourses(org.id, { publishedOnly: !canManage }),
    listAssignments(org.id, canManage ? {} : { userId: agent.id }),
    listMembers(org.id),
    getScorecard(org.id),
  ]);

  if (courses === null || assignments === null) {
    return (
      <DashboardLayout>
        <PageHeader title="Training" />
        <Notice>Run supabase/migrations/010_training.sql in the Supabase SQL Editor to turn on training.</Notice>
      </DashboardLayout>
    );
  }

  const names = new Map(members.map((m) => [m.id, m.name]));
  const criterionLabels = new Map(criteria.map((c) => [c.id, c.label]));
  const mine = assignments.filter((a) => a.userId === agent.id);
  const mineIds = new Set(mine.map((a) => a.courseId));
  const others = courses.filter((c) => c.published && !mineIds.has(c.id));

  // Team report: only real assignments count, not self-study
  const assigned = assignments.filter((a) => a.assignedBy);
  const passed = assigned.filter((a) => a.status === "passed");
  const overdue = assigned.filter((a) => isOverdue(a, today));
  const scored = assignments.filter((a) => a.bestScore !== null);
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, a) => sum + a.bestScore!, 0) / scored.length)
    : null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Training"
        description="Short lessons with a quiz. Courses linked to a quality criterion are assigned automatically when a review scores an agent low on it."
        actions={
          canManage && (
            <Link href="/training/new" className={buttonPrimary}>
              New course
            </Link>
          )
        }
      />

      {canManage && (
        <StatStrip
          className="mb-4"
          stats={[
            {
              label: "Completion rate",
              value: assigned.length ? `${Math.round((passed.length / assigned.length) * 100)}%` : "—",
              hint: `${passed.length} of ${assigned.length} assignments passed`,
            },
            {
              label: "Overdue",
              value: <span className={overdue.length ? "text-rose-600" : "text-emerald-600"}>{overdue.length}</span>,
              hint: "past the due date and not passed",
            },
            { label: "Average quiz score", value: averageScore === null ? "—" : `${averageScore}%`, hint: "best attempt per person" },
            {
              label: "From quality checks",
              value: assigned.filter((a) => a.assignedBy === "Quality check").length,
              hint: "assigned automatically after a low QC score",
            },
          ]}
        />
      )}

      <Panel title="My training" action={<span className="text-xs tabular-nums text-zinc-500">{mine.length} assigned</span>} flush>
        {mine.length === 0 ? <EmptyState>Nothing assigned to you right now.</EmptyState> : <MyTraining assignments={mine} today={today} />}
      </Panel>

      {!canManage && others.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-900">More courses</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Take any of these for practice.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((c) => (
              <li key={c.id}>
                <Link href={`/training/${c.id}`} className="block h-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-indigo-300">
                  <p className="text-sm font-medium text-zinc-900">{c.title}</p>
                  {c.description && <p className="mt-1 text-sm text-zinc-600">{c.description}</p>}
                  <p className="mt-2 text-xs text-zinc-500">{c.questions.length} questions</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <>
          <Panel title="Courses" className="mt-4" flush>
            {courses.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-zinc-500">
                No courses yet. Create one, and link it to a quality criterion like Empathy so it&apos;s assigned when
                needed.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className={th}>Course</th>
                      <th className={th}>Linked to</th>
                      <th className={th}>Questions</th>
                      <th className={th}>Passed</th>
                      <th className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {courses.map((course) => {
                      const forCourse = assignments.filter((a) => a.courseId === course.id);
                      return (
                        <tr key={course.id} className="hover:bg-zinc-50/60">
                          <td className="px-5 py-2.5">
                            <Link href={`/training/${course.id}/edit`} className="font-medium text-zinc-900 hover:text-indigo-700">
                              {course.title}
                            </Link>
                          </td>
                          <td className="px-5 py-2.5 text-zinc-700">
                            {course.linkedCriterion ? criterionLabels.get(course.linkedCriterion) ?? "Removed criterion" : "—"}
                          </td>
                          <td className="px-5 py-2.5 text-zinc-600">{course.questions.length}</td>
                          <td className="px-5 py-2.5 text-zinc-600">
                            {forCourse.filter((a) => a.status === "passed").length} / {forCourse.length}
                          </td>
                          <td className="px-5 py-2.5">
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                                course.published ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-zinc-50 text-zinc-600 ring-zinc-500/20"
                              }`}
                            >
                              {course.published ? "Published" : "Draft"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Team progress" description="Overdue first" className="mt-4" flush>
            {assignments.length === 0 ? (
              <EmptyState>Nobody has been assigned a course yet.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className={th}>Person</th>
                      <th className={th}>Course</th>
                      <th className={th}>Why</th>
                      <th className={th}>Due</th>
                      <th className={th}>Result</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {[...assignments]
                      .sort((a, b) => Number(isOverdue(b, today)) - Number(isOverdue(a, today)))
                      .map((a) => (
                        <tr key={a.id} className="hover:bg-zinc-50/60">
                          <td className="px-5 py-2.5 font-medium text-zinc-900">{names.get(a.userId) ?? "Former member"}</td>
                          <td className="px-5 py-2.5 text-zinc-700">{a.courseTitle}</td>
                          <td className="max-w-xs px-5 py-2.5 text-xs text-zinc-500">
                            {a.reason ?? (a.assignedBy ? `Assigned by ${a.assignedBy}` : "Self-study")}
                          </td>
                          <td className="whitespace-nowrap px-5 py-2.5 text-zinc-600">{a.dueDate ? formatDay(a.dueDate) : "—"}</td>
                          <td className="px-5 py-2.5">
                            <AssignmentStatusBadge assignment={a} today={today} />
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <RemoveAssignmentButton id={a.id} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </DashboardLayout>
  );
}
