import "server-only";
import { listMembers } from "@/app/lib/auth/session";
import { assignCourse, getAssignment, listCourses } from "@/app/lib/db/training";
import { addDays } from "@/app/lib/roster/types";
import type { CriterionScore } from "@/app/lib/quality/types";

// A QC score at or below this on a criterion assigns the courses linked to it
export const AUTO_ASSIGN_MAX_SCORE = 2;
const DUE_IN_DAYS = 7;

// After a quality review: assign the linked course for every low-scoring criterion.
// Returns what happened, for the reviewer. Never throws, so a training problem can't block a review.
export async function assignTrainingForLowScores(
  orgId: string,
  agentName: string,
  scores: CriterionScore[],
  ticketId: string
): Promise<string[]> {
  const low = scores.filter((s) => s.score <= AUTO_ASSIGN_MAX_SCORE);
  if (low.length === 0) return [];

  try {
    const courses = await listCourses(orgId, { publishedOnly: true });
    if (!courses) return [];

    const linked = low.flatMap((s) =>
      courses.filter((c) => c.linkedCriterion === s.id).map((course) => ({ course, criterion: s }))
    );
    if (linked.length === 0) return [];

    const member = (await listMembers(orgId)).find((m) => m.name === agentName);
    if (!member) return [`${agentName} has no login in this workspace, so no training was assigned.`];

    const notes: string[] = [];
    for (const { course, criterion } of linked) {
      const existing = await getAssignment(orgId, course.id, member.id);
      // Already working on it: leave it alone
      if (existing && existing.status !== "passed") continue;

      await assignCourse(orgId, course.id, member.id, {
        assignedBy: "Quality check",
        reason: `${criterion.label} scored ${criterion.score}/5 on ticket #${ticketId}`,
        dueDate: addDays(new Date().toISOString().slice(0, 10), DUE_IN_DAYS),
      });
      notes.push(`Assigned "${course.title}" to ${member.name}.`);
    }
    return notes;
  } catch (err) {
    console.error("Automatic training assignment failed:", err);
    return [];
  }
}
