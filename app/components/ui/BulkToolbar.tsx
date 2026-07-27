type BulkToolbarProps = {
    selectedCount: number;
  };
  
  export default function BulkToolbar({
    selectedCount,
  }: BulkToolbarProps) {
    if (selectedCount === 0) return null;
  
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
        <p className="font-medium">
          ✓ {selectedCount} ticket{selectedCount > 1 ? "s" : ""} selected
        </p>
  
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800">
            Assign
          </button>
  
          <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800">
            Change Status
          </button>
  
          <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800">
            Change Priority
          </button>
  
          <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800">
            Export
          </button>
  
          <button className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500">
            Delete
          </button>
        </div>
      </div>
    );
  }