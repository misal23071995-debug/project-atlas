"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { getArticle } from "@/app/lib/db/bot";
import { getScorecard } from "@/app/lib/db/quality";
import {
  assignCourse,
  deleteCourse,
  getCourse,
  recordAttempt,
  removeAssignment,
  saveCourse,
} from "@/app/lib/db/training";
import { writeQuiz } from "@/app/lib/training/ai";
import { isIsoDate } from "@/app/lib/roster/types";
import {
  gradeQuiz,
  MAX_QUESTIONS,
  OPTIONS_PER_QUESTION,
  type QuizQuestion,
  type QuizResult,
} from "@/app/lib/training/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (err: unknown, fallback: string) => ({
  ok: false as const,
  error: err instanceof Error ? err.message : fallback,
});

export interface CourseDraft {
  id: string | null;
  title: string;
  description: string;
  body: string;
  questions: QuizQuestion[];
  passPercent: number;
  linkedCriterion: string | null;
  published: boolean;
}

function cleanQuestions(questions: unknown): QuizQuestion[] {
  if (!Array.isArray(questions)) throw new Error("Add the quiz questions.");
  if (questions.length > MAX_QUESTIONS) throw new Error(`Use at most ${MAX_QUESTIONS} questions.`);

  return questions.map((raw: Partial<QuizQuestion>, index) => {
    const question = String(raw.question ?? "").trim().slice(0, 500);
    const options = (Array.isArray(raw.options) ? raw.options : []).map((o) => String(o ?? "").trim().slice(0, 300));
    const answer = Number(raw.answer);

    if (!question) throw new Error(`Question ${index + 1} is empty.`);
    if (options.length !== OPTIONS_PER_QUESTION || options.some((o) => !o)) {
      throw new Error(`Question ${index + 1} needs ${OPTIONS_PER_QUESTION} answers.`);
    }
    if (!Number.isInteger(answer) || answer < 0 || answer >= OPTIONS_PER_QUESTION) {
      throw new Error(`Mark the correct answer for question ${index + 1}.`);
    }

    const id = /^[a-z0-9]{1,40}$/i.test(String(raw.id ?? "")) ? String(raw.id) : `q${index}${Date.now().toString(36)}`;
    return { id, question, options, answer, explanation: String(raw.explanation ?? "").trim().slice(0, 500) };
  });
}

export async function saveCourseAction(draft: CourseDraft): Promise<Result<{ id: string }>> {
  const { agent, org } = await requireSession("training.manage");

  try {
    const title = String(draft.title ?? "").trim().slice(0, 150);
    if (!title) throw new Error("Give the course a title.");
    const passPercent = Math.round(Number(draft.passPercent));
    if (!(passPercent >= 1 && passPercent <= 100)) throw new Error("The pass mark must be 1-100%.");

    const questions = cleanQuestions(draft.questions);
    if (draft.published && questions.length === 0) throw new Error("Add at least one question before publishing.");

    // Only criteria on this workspace's scorecard can be linked
    let linkedCriterion = draft.linkedCriterion || null;
    if (linkedCriterion && !(await getScorecard(org.id)).some((c) => c.id === linkedCriterion)) linkedCriterion = null;

    const id = await saveCourse(
      org.id,
      draft.id && /^\d+$/.test(draft.id) ? draft.id : null,
      {
        title,
        description: String(draft.description ?? "").trim().slice(0, 500),
        body: String(draft.body ?? "").trim().slice(0, 30000),
        questions,
        passPercent,
        linkedCriterion,
        published: Boolean(draft.published),
      },
      agent.name
    );

    revalidatePath("/training", "layout");
    return { ok: true, id };
  } catch (err) {
    return fail(err, "Could not save the course.");
  }
}

export async function deleteCourseAction(id: string) {
  const { org } = await requireSession("training.manage");
  await deleteCourse(org.id, id);
  revalidatePath("/training", "layout");
  redirect("/training");
}

// Gemini writes questions from the lesson text; the editor shows them for checking before saving
export async function writeQuizAction(title: string, body: string, count: number): Promise<Result<{ questions: QuizQuestion[] }>> {
  const { org } = await requireSession("training.manage");
  const lesson = String(body ?? "").trim();
  if (lesson.length < 100) return { ok: false, error: "Write at least a short paragraph of lesson first." };

  try {
    const questions = await writeQuiz(String(title ?? ""), lesson, Math.min(10, Math.max(1, Math.round(count) || 5)), org.name);
    return { ok: true, questions };
  } catch (err) {
    console.error("AI quiz writing failed:", err);
    return { ok: false, error: "The AI couldn't write questions right now (the free quota may be used up). Try again soon." };
  }
}

// Starts a lesson from a knowledge base article
export async function articleForCourseAction(articleId: string): Promise<Result<{ title: string; body: string }>> {
  const { org } = await requireSession("training.manage");
  const article = await getArticle(org.id, articleId);
  if (!article) return { ok: false, error: "Article not found." };
  return { ok: true, title: article.title, body: article.body };
}

export async function assignCourseAction(
  courseId: string,
  userIds: string[],
  dueDate: string | null
): Promise<Result<{ count: number }>> {
  const { agent, org } = await requireSession("training.manage");

  try {
    const course = await getCourse(org.id, courseId);
    if (!course) throw new Error("Course not found.");
    if (!course.published) throw new Error("Publish the course before assigning it.");
    if (dueDate && !isIsoDate(dueDate)) throw new Error("Pick a valid due date.");

    const memberIds = new Set((await listMembers(org.id)).map((m) => m.id));
    const chosen = [...new Set(userIds)].filter((id) => memberIds.has(id));
    if (chosen.length === 0) throw new Error("Choose at least one person.");

    for (const userId of chosen) {
      await assignCourse(org.id, courseId, userId, { assignedBy: agent.name, reason: null, dueDate: dueDate || null });
    }

    revalidatePath("/training", "layout");
    return { ok: true, count: chosen.length };
  } catch (err) {
    return fail(err, "Could not assign the course.");
  }
}

export async function removeAssignmentAction(id: string) {
  const { org } = await requireSession("training.manage");
  if (!/^\d+$/.test(id)) throw new Error("Unknown assignment");
  await removeAssignment(org.id, id);
  revalidatePath("/training", "layout");
}

// Grades on the server: the browser never receives the correct answers before submitting
export async function submitQuizAction(courseId: string, chosen: Record<string, number>): Promise<Result<{ result: QuizResult }>> {
  const { agent, org } = await requireSession();

  try {
    const course = await getCourse(org.id, courseId);
    if (!course || !course.published) throw new Error("This course isn't available.");

    const result = gradeQuiz(course.questions, chosen, course.passPercent);
    await recordAttempt(org.id, course.id, agent.id, result.score, result.passed);

    revalidatePath("/training", "layout");
    return { ok: true, result };
  } catch (err) {
    return fail(err, "Could not submit your answers.");
  }
}
