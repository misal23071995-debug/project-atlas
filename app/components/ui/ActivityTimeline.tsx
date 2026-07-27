type Activity = {
  title: string;
  time: string;
  color: string;
};

type ActivityTimelineProps = {
  activities: Activity[];
};

export default function ActivityTimeline({
  activities,
}: ActivityTimelineProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-6 text-lg font-semibold">
        Activity Timeline
      </h2>

      <div className="space-y-6">
        {activities.map((activity, index) => (
          <div key={index} className="relative flex gap-4">
            {/* Timeline line */}
            {index !== activities.length - 1 && (
              <div className="absolute left-[5px] top-4 h-full w-px bg-zinc-700" />
            )}

            {/* Timeline dot */}
            <div
              className={`relative z-10 mt-1 h-3 w-3 rounded-full ${activity.color}`}
            />

            {/* Activity content */}
            <div>
              <p className="font-medium text-zinc-100">
                {activity.title}
              </p>

              <p className="text-sm text-zinc-500">
                {activity.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}