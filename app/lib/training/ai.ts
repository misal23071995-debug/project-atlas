import "server-only";
import { ai } from "@/app/lib/ai/provider";
import { OPTIONS_PER_QUESTION, type QuizQuestion } from "./types";

const MODEL = "models/gemini-3.5-flash-lite";
const MAX_LESSON_CHARS = 15000;

const quizSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer_index: { type: "integer", minimum: 0, maximum: OPTIONS_PER_QUESTION - 1 },
          explanation: { type: "string" },
        },
        required: ["question", "options", "answer_index", "explanation"],
      },
    },
  },
  required: ["questions"],
};

// Multiple-choice questions that check the lesson was understood. Throws if Gemini fails.
export async function writeQuiz(title: string, lesson: string, count: number, brandName: string): Promise<QuizQuestion[]> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You write training quizzes for the ${brandName} customer support team.
Write ${count} multiple-choice questions that check a support agent understood this lesson.

Rules:
- Use only facts from the lesson. Never invent policies, numbers or steps.
- Prefer realistic situations ("A customer says... what do you do?") over memorising wording.
- Exactly ${OPTIONS_PER_QUESTION} options per question, one clearly correct; wrong options should be believable.
- Vary which option is correct.
- explanation: one sentence on why the answer is right, pointing to the lesson.

Lesson title: ${title}

Lesson:
${lesson.slice(0, MAX_LESSON_CHARS)}`,
    config: { responseMimeType: "application/json", responseJsonSchema: quizSchema },
  });

  const parsed = JSON.parse(response.text ?? "") as {
    questions?: { question?: unknown; options?: unknown; answer_index?: unknown; explanation?: unknown }[];
  };

  const questions = (parsed.questions ?? [])
    .filter(
      (q) =>
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === OPTIONS_PER_QUESTION &&
        q.options.every((o) => typeof o === "string" && o.trim()) &&
        Number.isInteger(q.answer_index) &&
        (q.answer_index as number) >= 0 &&
        (q.answer_index as number) < OPTIONS_PER_QUESTION
    )
    .slice(0, count)
    .map((q, index) => ({
      id: `q${Date.now().toString(36)}${index}`,
      question: (q.question as string).trim(),
      options: (q.options as string[]).map((o) => o.trim()),
      answer: q.answer_index as number,
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
    }));

  if (questions.length === 0) throw new Error("The AI didn't return any usable questions");
  return questions;
}
