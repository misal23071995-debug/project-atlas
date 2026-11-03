import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getScorecard } from "@/app/lib/db/quality";
import { listAssignments, listCourses } from "@/app/lib/db/training";
import { formatDay } from "@/app/lib/roster/types";
import { isOverdue, type Assignment } from "@/app/lib/training/types";
import AssignmentStatusBadge from "./AssignmentStatusBadge";
import RemoveAssignmentButton from "./RemoveAssignmentButton";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function MyTraining({ assignments, today }: { assignments: Assignment[]; today: string }) {
  // To do first (overdue at the top), then finished
  const sorted = [...assignments].sort((a, b) => {
    const rank = (x: Assignment) => (x.status === "passed" ? 2 : isOverdue(x, today) ? 0 : 1);
    return rank(a) - rank(b) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  return (
    <ul className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900">
      {sorted.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <Link href={`/training/${a.courseId}`} className="font-medium text-zinc-100 hover:underline">
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
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
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
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Run supabase/migrations/010_training.sql in the Supabase SQL Editor to turn on training.
        </p>
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Training</h1>
          <p className="mt-1 max-w-3xl text-zinc-400">
            Short lessons with a quiz. Courses linked to a quality criterion are assigned automatically when a review
            scores an agent low on it.
          </p>
        </div>
        {canManage && (
          <Link href="/training/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            New course
          </Link>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">My training</h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nothing assigned to you right now.</p>
        ) : (
          <MyTraining assignments={mine} today={today} />
        )}
      </section>

      {!canManage && others.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">More courses</h2>
          <p className="mt-1 text-sm text-zinc-400">Take any of these for practice.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {others.map((c) => (
              <li key={c.id}>
                <Link href={`/training/${c.id}`} className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600">
                  <p className="font-medium text-zinc-100">{c.title}</p>
                  {c.description && <p className="mt-1 text-sm text-zinc-400">{c.description}</p>}
                  <p className="mt-2 text-xs text-zinc-500">{c.questions.length} questions</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <>
          <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Completion rate"
              value={assigned.length ? `${Math.round((passed.length / assigned.length) * 100)}%` : "—"}
              hint={`${passed.length} of ${assigned.length} assignments passed`}
            />
            <Stat
              label="Overdue"
              value={<span className={overdue.length ? "text-red-400" : "text-emerald-400"}>{overdue.length}</span>}
              hint="past the due date and not passed"
            />
            <Stat label="Average quiz score" value={averageScore === null ? "—" : `${averageScore}%`} hint="best attempt per person" />
            <Stat
              label="From quality checks"
              value={assigned.filter((a) => a.assignedBy === "Quality check").length}
              hint="assigned automatically after a low QC score"
            />
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-semibold">Courses</h2>
            {courses.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                No courses yet. Create one, and link it to a quality criterion like Empathy so it&apos;s assigned when
                needed.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-900 text-left text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Course</th>
                      <th className="px-4 py-3 font-medium">Linked to</th>
                      <th className="px-4 py-3 font-medium">Questions</th>
                      <th className="px-4 py-3 font-medium">Passed</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => {
                      const forCourse = assignments.filter((a) => a.courseId === course.id);
                      return (
                        <tr key={course.id} className="border-t border-zinc-800">
                          <td className="px-4 py-3">
                            <Link href={`/training/${course.id}/edit`} className="font-medium text-indigo-400 hover:underline">
                              {course.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {course.linkedCriterion ? criterionLabels.get(course.linkedCriterion) ?? "Removed criterion" : "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">{course.questions.length}</td>
                          <td className="px-4 py-3 text-zinc-400">
                            {forCourse.filter((a) => a.status === "passed").length} / {forCourse.length}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs ${
                                course.published ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700 text-zinc-300"
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
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-semibold">Team progress</h2>
            {assignments.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Nobody has been assigned a course yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-900 text-left text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Person</th>
                      <th className="px-4 py-3 font-medium">Course</th>
                      <th className="px-4 py-3 font-medium">Why</th>
                      <th className="px-4 py-3 font-medium">Due</th>
                      <th className="px-4 py-3 font-medium">Result</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...assignments]
                      .sort((a, b) => Number(isOverdue(b, today)) - Number(isOverdue(a, today)))
                      .map((a) => (
                        <tr key={a.id} className="border-t border-zinc-800">
                          <td className="px-4 py-3 text-zinc-100">{names.get(a.userId) ?? "Former member"}</td>
                          <td className="px-4 py-3 text-zinc-300">{a.courseTitle}</td>
                          <td className="max-w-xs px-4 py-3 text-xs text-zinc-500">
                            {a.reason ?? (a.assignedBy ? `Assigned by ${a.assignedBy}` : "Self-study")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{a.dueDate ? formatDay(a.dueDate) : "—"}</td>
                          <td className="px-4 py-3">
                            <AssignmentStatusBadge assignment={a} today={today} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <RemoveAssignmentButton id={a.id} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
