// What can be attached to a ticket. Safe to import from Client Components.
// Keep the types in sync with the bucket's allowed_mime_types in supabase/migrations/018_attachments.sql.

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 5;

export const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/gif": "GIF image",
  "image/webp": "WebP image",
  "image/heic": "HEIC photo",
  "application/pdf": "PDF",
  "text/plain": "Text file",
  "text/csv": "CSV",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel spreadsheet",
  "application/msword": "Word document",
  "application/vnd.ms-excel": "Excel spreadsheet",
  "video/mp4": "Video",
  "video/quicktime": "Video",
};

// For the file picker
export const ACCEPT = Object.keys(ALLOWED_TYPES).join(",");

export interface Attachment {
  id: string;
  messageId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  source: "agent" | "customer";
  uploadedBy: string;
  createdAt: string;
}

export const isImage = (contentType: string) => contentType.startsWith("image/") && contentType !== "image/heic";

// Says what's wrong with a file, or null if it can be attached
export function checkFile(name: string, contentType: string, size: number) {
  if (!ALLOWED_TYPES[contentType]) return `${name}: this kind of file can't be attached. Use an image, PDF, text, Word, Excel or video file.`;
  if (size <= 0) return `${name} is empty.`;
  if (size > MAX_ATTACHMENT_BYTES) return `${name} is over 10 MB.`;
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A name that's safe in a storage path and a download header: letters, numbers, dots, dashes
export function safeFileName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/^\.+/, "").slice(-120);
  return cleaned || "file";
}
