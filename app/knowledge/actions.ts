"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgent } from "@/app/lib/auth/session";
import { KB_CATEGORIES, type KbCategory } from "@/app/lib/bot/types";
import { deleteArticle, saveArticle } from "@/app/lib/db/bot";

export interface ArticleFormState {
  error?: string;
}

export async function saveArticleAction(
  _previous: ArticleFormState,
  formData: FormData
): Promise<ArticleFormState> {
  await requireAgent();

  const id = String(formData.get("id") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const category = String(formData.get("category") ?? "") as KbCategory;
  const body = String(formData.get("body") ?? "").trim().slice(0, 10000);
  const published = formData.get("published") === "on";

  if (!title) return { error: "Add a title." };
  if (!body) return { error: "Add the article text." };
  if (!KB_CATEGORIES.includes(category)) return { error: "Choose a category." };
  if (id && !/^\d+$/.test(id)) return { error: "Unknown article." };

  try {
    await saveArticle(id, { title, category, body, published });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the article." };
  }

  revalidatePath("/knowledge");
  redirect("/knowledge");
}

export async function deleteArticleAction(id: string) {
  await requireAgent();
  if (!/^\d+$/.test(id)) throw new Error("Unknown article");

  await deleteArticle(id);
  revalidatePath("/knowledge");
  redirect("/knowledge");
}
