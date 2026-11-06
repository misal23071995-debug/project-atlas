import { formatBytes, isImage, type Attachment } from "@/app/lib/attachments";

const FileIcon = () => (
  <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
    <path d="M14 3v5h5" strokeLinejoin="round" />
  </svg>
);

// Images as small previews, other files as download chips. Every link goes through the
// signed-in /api/attachments route, which checks the workspace before handing out a short-lived link.
export default function AttachmentList({ attachments, compact = false }: { attachments: Attachment[]; compact?: boolean }) {
  if (!attachments.length) return null;
  const images = attachments.filter((a) => isImage(a.contentType));
  const files = attachments.filter((a) => !isImage(a.contentType));

  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <a key={a.id} href={`/api/attachments/${a.id}?view=1`} target="_blank" rel="noreferrer" title={`${a.fileName} · ${formatBytes(a.sizeBytes)}`}>
              {/* Served from short-lived storage links, so Next's image optimiser can't cache them */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/attachments/${a.id}?view=1`}
                alt={a.fileName}
                loading="lazy"
                className={`${compact ? "h-14 w-14" : "h-24 w-24"} rounded-lg border border-zinc-700 bg-zinc-950 object-cover hover:border-indigo-400`}
              />
            </a>
          ))}
        </div>
      )}
      {files.map((a) => (
        <a
          key={a.id}
          href={`/api/attachments/${a.id}`}
          className="flex max-w-xs items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 hover:border-indigo-400"
        >
          <FileIcon />
          <span className="min-w-0 flex-1 truncate">{a.fileName}</span>
          <span className="shrink-0 text-xs text-zinc-500">{formatBytes(a.sizeBytes)}</span>
        </a>
      ))}
    </div>
  );
}
