import "server-only";
import { getSupabase } from "./supabase";
import { STARTER_REPLIES, type SavedReply } from "@/app/lib/replies";

type ReplyRow = { id: number; title: string; category: string; body: string; updated_at: string };

const toReply = (row: ReplyRow): SavedReply => ({
  id: String(row.id),
  title: row.title,
  category: row.category,
  body: row.body,
  updatedAt: row.updated_at,
});

// Null until migration 012 has been run
export async function listSavedReplies(orgId: string): Promise<SavedReply[] | null> {
  const { data, error } = await getSupabase()
    .from("saved_replies")
    .select("id, title, category, body, updated_at")
    .eq("org_id", orgId)
    .order("category")
    .order("title")
    .returns<ReplyRow[]>();

  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load saved replies: ${error.message}`);
  return data.map(toReply);
}

export type SavedReplyInput = Pick<SavedReply, "title" | "category" | "body">;

export async function saveSavedReply(orgId: string, id: string | null, input: SavedReplyInput, author: string) {
  const supabase = getSupabase();
  const values = { ...input, updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabase.from("saved_replies").update(values).eq("org_id", orgId).eq("id", id)
    : await supabase.from("saved_replies").insert({ ...values, org_id: orgId, created_by: author });

  if (error) throw new Error(`Failed to save the reply: ${error.message}`);
}

export async function deleteSavedReply(orgId: string, id: string) {
  const { error } = await getSupabase().from("saved_replies").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw new Error(`Failed to delete the reply: ${error.message}`);
}

export async function addStarterReplies(orgId: string, author: string) {
  const { error } = await getSupabase()
    .from("saved_replies")
    .insert(STARTER_REPLIES.map((r) => ({ ...r, org_id: orgId, created_by: author })));
  if (error) throw new Error(`Failed to add the starter replies: ${error.message}`);
}
