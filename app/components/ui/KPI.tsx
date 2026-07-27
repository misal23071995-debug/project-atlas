type KPIProps = {
    title: string;
    value: string;
    change: string;
    icon: string;
    trend: "up" | "down";
  };
  
  export default function KPI({
    title,
    value,
    change,
    icon,
    trend,
  }: KPIProps) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-xl dark:bg-indigo-900">
            {icon}
          </div>
  
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              trend === "up"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
            }`}
          >
            {change}
          </span>
        </div>
  
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {title}
        </p>
  
        <h2 className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
          {value}
        </h2>
      </div>
    );
  }