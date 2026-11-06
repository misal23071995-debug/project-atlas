import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabase } from "./supabase";
import { checkFile, safeFileName, type Attachment } from "@/app/lib/attachments";

const BUCKET = "attachments";

type AttachmentRow = {
  id: number;
  message_id: number | null;
  file_name: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  source: "agent" | "customer";
  uploaded_by: string;
  created_at: string;
};

const COLUMNS = "id, message_id, file_name, content_type, size_bytes, storage_path, source, uploaded_by, created_at";

const toAttachment = (r: AttachmentRow): Attachment => ({
  id: String(r.id),
  messageId: r.message_id ? String(r.message_id) : null,
  fileName: r.file_name,
  contentType: r.content_type,
  sizeBytes: r.size_bytes,
  source: r.source,
  uploadedBy: r.uploaded_by,
  createdAt: r.created_at,
});

const folder = (orgId: string, ticketId: string) => `${orgId}/${ticketId}`;

// Oldest first. Empty until migration 018 has been run.
export async function listTicketAttachments(orgId: string, ticketId: string): Promise<Attachment[]> {
  const { data, error } = await getSupabase()
    .from("ticket_attachments")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .eq("ticket_id", ticketId)
    .order("created_at")
    .returns<AttachmentRow[]>();
  if (error?.code === "PGRST205") return [];
  if (error) throw new Error(`Failed to load attachments: ${error.message}`);
  return data.map(toAttachment);
}

// A one-time link the browser uploads the file to directly, so big files don't pass through the app.
// The link only works for this exact path inside this workspace's and ticket's folder.
export async function createUploadSlot(orgId: string, ticketId: string, fileName: string, contentType: string, size: number) {
  const problem = checkFile(fileName, contentType, size);
  if (problem) throw new Error(problem);
  const path = `${folder(orgId, ticketId)}/${randomUUID()}-${safeFileName(fileName)}`;
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(`Couldn't prepare the upload: ${error.message}`);
  return { path, signedUrl: data.signedUrl };
}

// After the browser uploaded: checks each file really is in this ticket's folder and within the limits, then records it
export async function confirmUploads(
  orgId: string,
  ticketId: string,
  uploads: { path: string; fileName: string }[],
  messageId: number | null,
  uploadedBy: string
) {
  if (!uploads.length) return [];
  const prefix = `${folder(orgId, ticketId)}/`;
  const { data: files, error } = await getSupabase().storage.from(BUCKET).list(folder(orgId, ticketId), { limit: 1000 });
  if (error) throw new Error(`Couldn't check the uploads: ${error.message}`);
  const stored = new Map(files.map((f) => [`${prefix}${f.name}`, f]));

  const rows = uploads.map((u) => {
    const file = stored.get(u.path);
    if (!u.path.startsWith(prefix) || !file) throw new Error(`${u.fileName} didn't finish uploading. Try attaching it again.`);
    const size = Number(file.metadata?.size ?? 0);
    const type = String(file.metadata?.mimetype ?? "");
    const problem = checkFile(u.fileName, type, size);
    if (problem) throw new Error(problem);
    return {
      org_id: orgId,
      ticket_id: ticketId,
      message_id: messageId,
      file_name: u.fileName.slice(0, 200),
      content_type: type,
      size_bytes: size,
      storage_path: u.path,
      source: "agent",
      uploaded_by: uploadedBy,
    };
  });

  const { data, error: insertError } = await getSupabase().from("ticket_attachments").insert(rows).select(COLUMNS).returns<AttachmentRow[]>();
  if (insertError) throw new Error(`Couldn't save the attachments: ${insertError.message}`);
  return data.map((r) => ({ ...toAttachment(r), path: r.storage_path }));
}

// Files that arrive with a customer's email
export async function saveCustomerFile(
  orgId: string,
  ticketId: string,
  messageId: number | null,
  file: { name: string; contentType: string; bytes: Buffer },
  uploadedBy: string
) {
  if (checkFile(file.name, file.contentType, file.bytes.length)) return false;
  const path = `${folder(orgId, ticketId)}/${randomUUID()}-${safeFileName(file.name)}`;
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file.bytes, { contentType: file.contentType, upsert: false });
  if (error) throw new Error(`Couldn't store ${file.name}: ${error.message}`);
  const { error: insertError } = await supabase.from("ticket_attachments").insert({
    org_id: orgId,
    ticket_id: ticketId,
    message_id: messageId,
    file_name: file.name.slice(0, 200),
    content_type: file.contentType,
    size_bytes: file.bytes.length,
    storage_path: path,
    source: "customer",
    uploaded_by: uploadedBy,
  });
  if (insertError) throw new Error(`Couldn't save ${file.name}: ${insertError.message}`);
  return true;
}

// A link that works for a short time. Images can open in the browser; everything else downloads,
// so a file can never run as a page on the storage domain.
export async function signedLink(orgId: string, id: string, { inline = false, seconds = 60 } = {}) {
  if (!/^\d+$/.test(id)) return null;
  const { data: row, error } = await getSupabase()
    .from("ticket_attachments")
    .select("storage_path, file_name, content_type")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return null;
  const showInline = inline && row.content_type.startsWith("image/");
  const { data, error: linkError } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(row.storage_path, seconds, showInline ? undefined : { download: row.file_name });
  if (linkError) return null;
  return { url: data.signedUrl, fileName: row.file_name as string };
}
