export default function InternalNotes() {
  const notes = [
    {
      author: "Sarah K.",
      time: "Today • 9:48 AM",
      note: "Customer already tried restarting the Ring once.",
    },
    {
      author: "James L.",
      time: "Today • 10:05 AM",
      note: "Engineering has been notified. Waiting for logs.",
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-6 text-lg font-semibold">
        Internal Notes
      </h2>

      <div className="space-y-5">
        {notes.map((note, index) => (
          <div
            key={index}
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {note.author}
              </p>

              <p className="text-xs text-zinc-500">
                {note.time}
              </p>
            </div>

            <p className="mt-3 text-sm text-zinc-400">
              {note.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}