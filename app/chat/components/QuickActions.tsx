type Props = {
  onSelect: (message: string) => void;
};

const actions = [
  {
    icon: "💍",
    title: "Ring Sync",
    message: "My ring is not syncing.",
  },
  {
    icon: "🔋",
    title: "Battery",
    message: "My battery drains quickly.",
  },
  {
    icon: "😴",
    title: "Sleep",
    message: "My sleep score is missing.",
  },
  {
    icon: "🏃",
    title: "Workout",
    message: "My workout isn't syncing.",
  },
  {
    icon: "📦",
    title: "Order",
    message: "Where is my order?",
  },
  {
    icon: "💳",
    title: "Subscription",
    message: "I have a subscription question.",
  },
];

export default function QuickActions({ onSelect }: Props) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {actions.map((action) => (
        <button
          key={action.title}
          onClick={() => onSelect(action.message)}
          className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm transition hover:border-blue-500 hover:bg-zinc-800"
        >
          {action.icon} {action.title}
        </button>
      ))}
    </div>
  );
}