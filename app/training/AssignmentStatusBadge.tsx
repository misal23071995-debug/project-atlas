import { isOverdue, type Assignment } from "@/app/lib/training/types";

// "Passed 90%", "Failed 40%", "Overdue" or "To do"
export default function AssignmentStatusBadge({
  assignment,
  today = new Date().toISOString().slice(0, 10),
}: {
  assignment: Pick<Assignment, "status" | "dueDate" | "bestScore" | "lastScore">;
  today?: string;
}) {
  const overdue = isOverdue(assignment, today);
  const [label, className] =
    assignment.status === "passed"
      ? [`Passed ${assignment.bestScore ?? ""}%`, "bg-emerald-500/15 text-emerald-400"]
      : overdue
      ? ["Overdue", "bg-red-500/15 text-red-400"]
      : assignment.status === "failed"
      ? [`Failed ${assignment.lastScore ?? ""}%`, "bg-amber-500/15 text-amber-300"]
      : ["To do", "bg-zinc-700 text-zinc-300"];

  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${className}`}>{label}</span>;
}
