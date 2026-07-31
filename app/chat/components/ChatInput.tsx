type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
};

export default function ChatInput({
  value,
  onChange,
  onSend,
}: Props) {
  return (
    <div className="mt-6 flex items-end gap-3">
      <textarea
        rows={1}
        className="min-h-[52px] max-h-40 flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 leading-6 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
        placeholder="Describe your issue..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
            }
        }}
        />

      <button
        onClick={onSend}
        className="h-[52px] rounded-lg bg-blue-600 px-6 font-medium hover:bg-blue-500"
        >
        Send
        </button>
    </div>
  );
}