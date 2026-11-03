import "server-only";
import { getSupabase } from "./supabase";
import type { Assignment, AssignmentStatus, Course, QuizQuestion } from "@/app/lib/training/types";

// Every function takes the workspace id and only touches that workspace's training

type CourseRow = {
  id: number;
  title: string;
  description: string;
  body: string;
  questions: QuizQuestion[];
  pass_percent: number;
  linked_criterion: string | null;
  published: boolean;
  created_by: string | null;
  updated_at: string;
};

const COURSE_COLUMNS =
  "id, title, description, body, questions, pass_percent, linked_criterion, published, created_by, updated_at";

function toCourse(row: CourseRow): Course {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    body: row.body,
    questions: row.questions ?? [],
    passPercent: row.pass_percent,
    linkedCriterion: row.linked_criterion,
    published: row.published,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

// Null until migration 010 has been run
export async function listCourses(orgId: string, { publishedOnly = false } = {}): Promise<Course[] | null> {
  let query = getSupabase().from("courses").select(COURSE_COLUMNS).eq("org_id", orgId).order("title");
  if (publishedOnly) query = query.eq("published", true);

  const { data, error } = await query.returns<CourseRow[]>();
  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load courses: ${error.message}`);
  return data.map(toCourse);
}

export async function getCourse(orgId: string, id: string): Promise<Course | null> {
  if (!/^\d+$/.test(id)) return null;

  const { data, error } = await getSupabase()
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .returns<CourseRow[]>()
    .maybeSingle();

  if (error) throw new Error(`Failed to load course: ${error.message}`);
  return data ? toCourse(data) : null;
}

export type CourseInput = Omit<Course, "id" | "createdBy" | "updatedAt">;

// Creates the course when id is null, otherwise updates it. Returns the id.
export async function saveCourse(orgId: string, id: string | null, input: CourseInput, author: string) {
  const supabase = getSupabase();
  const values = {
    title: input.title,
    description: input.description,
    body: input.body,
    questions: input.questions,
    pass_percent: input.passPercent,
    linked_criterion: input.linkedCriterion,
    published: input.published,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = id
    ? await supabase.from("courses").update(values).eq("org_id", orgId).eq("id", id).select("id").single()
    : await supabase
        .from("courses")
        .insert({ ...values, org_id: orgId, created_by: author })
        .select("id")
        .single();

  if (error) throw new Error(`Failed to save course: ${error.message}`);
  return String(data.id);
}

export async function deleteCourse(orgId: string, id: string) {
  const { error } = await getSupabase().from("courses").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw new Error(`Failed to delete course: ${error.message}`);
}

// ---- Assignments ----

type AssignmentRow = {
  id: number;
  course_id: number;
  user_id: string;
  assigned_by: string | null;
  reason: string | null;
  due_date: string | null;
  status: AssignmentStatus;
  attempts: number;
  last_score: number | null;
  best_score: number | null;
  passed_at: string | null;
  assigned_at: string;
  course: { title: string } | null;
};

const ASSIGNMENT_COLUMNS =
  "id, course_id, user_id, assigned_by, reason, due_date, status, attempts, last_score, best_score, passed_at, assigned_at, course:courses (title)";

function toAssignment(row: AssignmentRow): Assignment {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    courseTitle: row.course?.title ?? "Deleted course",
    userId: row.user_id,
    assignedBy: row.assigned_by,
    reason: row.reason,
    dueDate: row.due_date,
    status: row.status,
    attempts: row.attempts,
    lastScore: row.last_score,
    bestScore: row.best_score,
    passedAt: row.passed_at,
    assignedAt: row.assigned_at,
  };
}

export async function listAssignments(
  orgId: string,
  { userId, courseId }: { userId?: string; courseId?: string } = {}
): Promise<Assignment[] | null> {
  let query = getSupabase()
    .from("course_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("org_id", orgId)
    .order("assigned_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  if (courseId) query = query.eq("course_id", courseId);

  const { data, error } = await query.returns<AssignmentRow[]>();
  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load training: ${error.message}`);
  return data.map(toAssignment);
}

// Assigns (or re-assigns) a course. Someone who already passed starts again, so a re-check is possible.
export async function assignCourse(
  orgId: string,
  courseId: string,
  userId: string,
  details: { assignedBy: string; reason: string | null; dueDate: string | null }
) {
  const { error } = await getSupabase()
    .from("course_assignments")
    .upsert(
      {
        org_id: orgId,
        course_id: courseId,
        user_id: userId,
        assigned_by: details.assignedBy,
        reason: details.reason,
        due_date: details.dueDate,
        status: "assigned",
        passed_at: null,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "course_id,user_id" }
    );

  if (error) throw new Error(`Failed to assign course: ${error.message}`);
}

export async function getAssignment(orgId: string, courseId: string, userId: string) {
  const { data, error } = await getSupabase()
    .from("course_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("org_id", orgId)
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .returns<AssignmentRow[]>()
    .maybeSingle();

  if (error) throw new Error(`Failed to load training: ${error.message}`);
  return data ? toAssignment(data) : null;
}

// Saves a quiz attempt. Taking a course nobody assigned records it as self-study.
export async function recordAttempt(orgId: string, courseId: string, userId: string, score: number, passed: boolean) {
  const existing = await getAssignment(orgId, courseId, userId);
  const now = new Date().toISOString();
  const wasPassed = existing?.status === "passed";

  const { error } = await getSupabase()
    .from("course_assignments")
    .upsert(
      {
        org_id: orgId,
        course_id: courseId,
        user_id: userId,
        assigned_by: existing?.assignedBy ?? null,
        reason: existing ? existing.reason : "Self-study",
        due_date: existing?.dueDate ?? null,
        // A later failed attempt doesn't undo a pass
        status: passed || wasPassed ? "passed" : "failed",
        attempts: (existing?.attempts ?? 0) + 1,
        last_score: score,
        best_score: Math.max(score, existing?.bestScore ?? 0),
        passed_at: passed && !wasPassed ? now : existing?.passedAt ?? null,
        updated_at: now,
      },
      { onConflict: "course_id,user_id" }
    );

  if (error) throw new Error(`Failed to save your result: ${error.message}`);
}

export async function removeAssignment(orgId: string, id: string) {
  const { error } = await getSupabase().from("course_assignments").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw new Error(`Failed to remove assignment: ${error.message}`);
}
