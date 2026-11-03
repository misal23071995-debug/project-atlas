"use client";

import { useActionState, useTransition } from "react";
import { KB_CATEGORIES, type KbArticle } from "@/app/lib/bot/types";
import { deleteArticleAction, saveArticleAction, type ArticleFormState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
const labelClass = "block text-sm font-medium text-zinc-300";

export default function ArticleForm({
  article,
  defaultCategory,
}: {
  article?: KbArticle;
  defaultCategory?: string;
}) {
  const [state, action, pending] = useActionState<ArticleFormState, FormData>(saveArticleAction, {});
  const [deleting, startDelete] = useTransition();

  return (
    <form action={action} className="mt-6 space-y-5 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <input type="hidden" name="id" value={article?.id ?? ""} />

      <label className={labelClass}>
        Title
        <input name="title" required maxLength={200} defaultValue={article?.title} className={inputClass} />
      </label>

      <label className={labelClass}>
        Category
        <select name="category" defaultValue={article?.category ?? defaultCategory ?? KB_CATEGORIES[0]} className={inputClass}>
          {KB_CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Article text
        <textarea
          name="body"
          required
          rows={12}
          maxLength={10000}
          defaultValue={article?.body}
          className={inputClass}
        />
        <span className="mt-1 block text-xs font-normal text-zinc-500">
          Write it the way you&apos;d explain it to a customer. The chatbot only uses what&apos;s written here.
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" name="published" defaultChecked={article?.published ?? true} className="h-4 w-4" />
        Published (the chatbot can use it)
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save article"}
        </button>

        {article && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (confirm(`Delete "${article.title}"? The chatbot will stop using it.`)) {
                startDelete(() => deleteArticleAction(article.id));
              }
            }}
            className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}
