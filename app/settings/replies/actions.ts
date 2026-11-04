"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/app/lib/auth/session";
import { addStarterReplies, deleteSavedReply, saveSavedReply } from "@/app/lib/db/replies";
import { KB_CATEGORIES } from "@/app/lib/bot/types";
import { MAX_REPLY_BODY, MAX_REPLY_TITLE } from "@/app/lib/replies";

export interface ReplyFormState {
  error?: string;
  success?: string;
}

function done() {
  revalidatePath("/settings/replies");
  revalidatePath("/tickets", "layout");
}

export async function saveReplyAction(_previous: ReplyFormState, formData: FormData): Promise<ReplyFormState> {
  const { agent, org } = await requireSession("replies.manage");
  const id = String(formData.get("id") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "Other");

  if (id && !/^\d+$/.test(id)) return { error: "Reply not found." };
  if (!title || title.length > MAX_REPLY_TITLE) return { error: `Give it a title of up to ${MAX_REPLY_TITLE} characters.` };
  if (!body || body.length > MAX_REPLY_BODY) return { error: `Write the reply (up to ${MAX_REPLY_BODY.toLocaleString("en-IN")} characters).` };

  try {
    await saveSavedReply(
      org.id,
      id,
      { title, body, category: (KB_CATEGORIES as readonly string[]).includes(category) ? category : "Other" },
      agent.name
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the reply." };
  }

  done();
  return { success: id ? "Saved." : "Reply added." };
}

export async function deleteReplyAction(id: string) {
  const { org } = await requireSession("replies.manage");
  if (!/^\d+$/.test(id)) throw new Error("Reply not found");
  await deleteSavedReply(org.id, id);
  done();
}

export async function addStarterRepliesAction() {
  const { agent, org } = await requireSession("replies.manage");
  await addStarterReplies(org.id, agent.name);
  done();
}
