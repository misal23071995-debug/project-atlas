type KPICardProps = {
    title: string;
    value: string | number;
    change: string;
    positive?: boolean;
  };
  
  export default function KPICard({
    title,
    value,
    change,
    positive = true,
  }: KPICardProps) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-400">{title}</p>
  
        <h2 className="mt-3 text-3xl font-bold">
          {value}
        </h2>
  
        <p
          className={`mt-3 text-sm ${
            positive ? "text-green-400" : "text-red-400"
          }`}
        >
          {change}
        </p>
      </div>
    );
  }