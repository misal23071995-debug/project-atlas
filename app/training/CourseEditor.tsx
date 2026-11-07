"use client";

import { useState, useTransition } from "react";
import SparkleIcon from "@/app/components/ui/SparkleIcon";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, type Role } from "@/app/lib/auth/roles";
import {
  MAX_QUESTIONS,
  OPTIONS_PER_QUESTION,
  type Assignment,
  type Course,
  type QuizQuestion,
} from "@/app/lib/training/types";
import {
  articleForCourseAction,
  assignCourseAction,
  deleteCourseAction,
  saveCourseAction,
  writeQuizAction,
} from "./actions";
import AssignmentStatusBadge from "./AssignmentStatusBadge";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500";
const labelClass = "block text-sm text-zinc-600";

const blankQuestion = (): QuizQuestion => ({
  id: `q${Math.random().toString(36).slice(2, 10)}`,
  question: "",
  options: Array(OPTIONS_PER_QUESTION).fill(""),
  answer: 0,
  explanation: "",
});

export default function CourseEditor({
  course,
  criteria,
  articles,
  members,
  assignments,
}: {
  course: Course | null;
  criteria: { id: string; label: string }[];
  articles: { id: string; title: string }[];
  members: { id: string; name: string; role: Role }[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [body, setBody] = useState(course?.body ?? "");
  const [questions, setQuestions] = useState<QuizQuestion[]>(course?.questions ?? []);
  const [passPercent, setPassPercent] = useState(course?.passPercent ?? 80);
  const [linkedCriterion, setLinkedCriterion] = useState(course?.linkedCriterion ?? "");
  const [published, setPublished] = useState(course?.published ?? false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isWriting, startWrite] = useTransition();

  function updateQuestion(index: number, changes: Partial<QuizQuestion>) {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...changes } : q)));
  }

  function loadArticle(articleId: string) {
    if (!articleId) return;
    if (body.trim() && !confirm("Replace the current lesson with this article?")) return;
    startWrite(async () => {
      const result = await articleForCourseAction(articleId);
      if (!result.ok) return setError(result.error);
      setTitle((current) => current || result.title);
      setBody(result.body);
    });
  }

  function writeWithAi() {
    setError(null);
    startWrite(async () => {
      const result = await writeQuizAction(title, body, 5);
      if (!result.ok) return setError(result.error);
      // Keep questions someone already wrote; add the AI's after them
      setQuestions((current) => [...current.filter((q) => q.question.trim()), ...result.questions].slice(0, MAX_QUESTIONS));
      setNotice("AI questions added. Check each one before publishing.");
    });
  }

  function save() {
    setError(null);
    setNotice(null);
    startSave(async () => {
      const result = await saveCourseAction({
        id: course?.id ?? null,
        title,
        description,
        body,
        questions,
        passPercent,
        linkedCriterion: linkedCriterion || null,
        published,
      });
      if (!result.ok) return setError(result.error);
      setNotice("Course saved.");
      if (!course) router.replace(`/training/${result.id}/edit`);
      else router.refresh();
    });
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label className={labelClass}>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>
            Short description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="What agents will learn"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          {articles.length > 0 && (
            <label className={labelClass}>
              Start from a knowledge base article (optional)
              <select defaultValue="" onChange={(e) => loadArticle(e.target.value)} className={`mt-1 ${inputClass}`}>
                <option value="">Choose an article…</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={labelClass}>
            Lesson
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              maxLength={30000}
              placeholder="Explain the skill or policy. Include examples of good and bad replies."
              className={`mt-1 ${inputClass}`}
            />
          </label>
        </section>

        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Quiz</h2>
              <p className="text-xs text-zinc-500">
                {questions.length} question{questions.length === 1 ? "" : "s"} · pass at {passPercent}%
              </p>
            </div>
            <button
              type="button"
              onClick={writeWithAi}
              disabled={isWriting || questions.length >= MAX_QUESTIONS}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-500/20 disabled:opacity-60"
            >
              <SparkleIcon />
              {isWriting ? "AI is writing…" : "Write 5 questions with AI"}
            </button>
          </div>

          {questions.map((q, index) => (
            <div key={q.id} className="space-y-3 rounded-lg border border-zinc-200 p-4">
              <div className="flex gap-2">
                <span className="mt-2 text-sm text-zinc-500">{index + 1}.</span>
                <textarea
                  value={q.question}
                  onChange={(e) => updateQuestion(index, { question: e.target.value })}
                  rows={2}
                  maxLength={500}
                  placeholder="Question"
                  aria-label={`Question ${index + 1}`}
                  className={inputClass}
                />
                <button
                  type="button"
                  aria-label={`Remove question ${index + 1}`}
                  onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}
                  className="self-start px-2 py-1 text-zinc-500 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2 pl-6">
                {q.options.map((option, optionIndex) => (
                  <label key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`answer-${q.id}`}
                      checked={q.answer === optionIndex}
                      onChange={() => updateQuestion(index, { answer: optionIndex })}
                      aria-label={`Answer ${optionIndex + 1} is correct`}
                    />
                    <input
                      value={option}
                      onChange={(e) =>
                        updateQuestion(index, {
                          options: q.options.map((o, i) => (i === optionIndex ? e.target.value : o)),
                        })
                      }
                      maxLength={300}
                      placeholder={`Answer ${optionIndex + 1}`}
                      className={`${inputClass} ${q.answer === optionIndex ? "border-emerald-600" : ""}`}
                    />
                  </label>
                ))}
                <input
                  value={q.explanation}
                  onChange={(e) => updateQuestion(index, { explanation: e.target.value })}
                  maxLength={500}
                  placeholder="Why the right answer is right (shown after submitting)"
                  className={inputClass}
                />
              </div>
            </div>
          ))}

          {questions.length < MAX_QUESTIONS && (
            <button
              type="button"
              onClick={() => setQuestions((current) => [...current, blankQuestion()])}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              + Add question
            </button>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label className={labelClass}>
            Pass mark (%)
            <input
              type="number"
              min={1}
              max={100}
              value={passPercent}
              onChange={(e) => setPassPercent(Number(e.target.value))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className={labelClass}>
            Linked quality criterion
            <select value={linkedCriterion} onChange={(e) => setLinkedCriterion(e.target.value)} className={`mt-1 ${inputClass}`}>
              <option value="">None</option>
              {criteria.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-zinc-500">
              A quality review scoring this criterion 1 or 2 assigns this course to the agent automatically.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Published (agents can take it)
          </label>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-600">{notice}</p>}

          <button
            type="button"
            onClick={save}
            disabled={isSaving || isWriting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save course"}
          </button>
          {course && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete this course and everyone's results for it?")) deleteCourseAction(course.id);
              }}
              className="w-full text-sm text-red-600 hover:text-red-700"
            >
              Delete course
            </button>
          )}
        </section>

        {course && (
          <AssignPanel courseId={course.id} published={course.published} members={members} assignments={assignments} />
        )}
      </div>
    </div>
  );
}

function AssignPanel({
  courseId,
  published,
  members,
  assignments,
}: {
  courseId: string;
  published: boolean;
  members: { id: string; name: string; role: Role }[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const byUser = new Map(assignments.map((a) => [a.userId, a]));

  function assign() {
    setMessage(null);
    startTransition(async () => {
      const result = await assignCourseAction(courseId, chosen, dueDate || null);
      if (!result.ok) return setMessage({ text: result.error, ok: false });
      setMessage({ text: `Assigned to ${result.count} ${result.count === 1 ? "person" : "people"}.`, ok: true });
      setChosen([]);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Assign</h2>
      {!published ? (
        <p className="text-sm text-zinc-500">Publish and save the course first.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {members.map((member) => {
              const assignment = byUser.get(member.id);
              return (
                <li key={member.id} className="flex items-center justify-between gap-2">
                  <label className="flex min-w-0 items-center gap-2 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      checked={chosen.includes(member.id)}
                      onChange={(e) =>
                        setChosen((current) =>
                          e.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id)
                        )
                      }
                    />
                    <span className="truncate">{member.name}</span>
                    <span className="text-xs text-zinc-500">{ROLE_LABELS[member.role]}</span>
                  </label>
                  {assignment && <AssignmentStatusBadge assignment={assignment} />}
                </li>
              );
            })}
          </ul>
          <label className={labelClass}>
            Due date (optional)
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          {message && <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}
          <button
            type="button"
            onClick={assign}
            disabled={isPending || chosen.length === 0}
            className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
          >
            {isPending ? "Assigning…" : "Assign course"}
          </button>
        </>
      )}
    </section>
  );
}
