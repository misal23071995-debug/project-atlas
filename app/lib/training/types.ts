// Training courses, quizzes and assignments. Safe to import from Client Components.

export const OPTIONS_PER_QUESTION = 4;
export const MAX_QUESTIONS = 20;

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  // Index of the correct option
  answer: number;
  explanation: string;
}

// What a learner sees before answering: no correct answers
export type PublicQuestion = Omit<QuizQuestion, "answer" | "explanation">;

export interface Course {
  id: string;
  title: string;
  description: string;
  body: string;
  questions: QuizQuestion[];
  passPercent: number;
  linkedCriterion: string | null;
  published: boolean;
  createdBy: string | null;
  updatedAt: string;
}

export type AssignmentStatus = "assigned" | "passed" | "failed";

export interface Assignment {
  id: string;
  courseId: string;
  courseTitle: string;
  userId: string;
  // Filled in by the page from the team list
  userName?: string;
  assignedBy: string | null;
  reason: string | null;
  dueDate: string | null;
  status: AssignmentStatus;
  attempts: number;
  lastScore: number | null;
  bestScore: number | null;
  passedAt: string | null;
  assignedAt: string;
}

export interface QuizResult {
  score: number;
  passed: boolean;
  // Per question: what was right, and why
  answers: { id: string; chosen: number | null; answer: number; explanation: string }[];
}

export function publicQuestions(questions: QuizQuestion[]): PublicQuestion[] {
  return questions.map(({ id, question, options }) => ({ id, question, options }));
}

// Score out of 100 for the learner's chosen option per question id
export function gradeQuiz(questions: QuizQuestion[], chosen: Record<string, number>, passPercent: number): QuizResult {
  const answers = questions.map((q) => {
    const pick = Number.isInteger(chosen?.[q.id]) ? chosen[q.id] : null;
    return { id: q.id, chosen: pick, answer: q.answer, explanation: q.explanation };
  });
  const correct = answers.filter((a) => a.chosen === a.answer).length;
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 100;
  return { score, passed: score >= passPercent, answers };
}

// Overdue: still not passed after the due date
export function isOverdue(assignment: Pick<Assignment, "status" | "dueDate">, today: string) {
  return assignment.status !== "passed" && assignment.dueDate !== null && assignment.dueDate < today;
}
