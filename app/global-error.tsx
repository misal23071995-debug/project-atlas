"use client";

// Last resort when the whole layout fails, so it brings its own html and body
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0c0f17", color: "#eceef5", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Atlas couldn&apos;t load</h1>
          <p style={{ color: "#9aa1b6", fontSize: 14 }}>This has been recorded. Please try again in a moment.</p>
          {error.digest && <p style={{ color: "#737b92", fontSize: 12, fontFamily: "monospace" }}>Error id: {error.digest}</p>}
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: 0, background: "#4f46e5", color: "white", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
