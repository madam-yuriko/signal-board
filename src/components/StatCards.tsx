export interface Stat {
  label: string;
  value: string | number;
  hint?: string;
  /** Tailwind text color class for the value */
  accent?: string;
}

export default function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="glass-card flex min-w-0 items-center gap-2 rounded-lg px-3 py-2"
        >
          <div className="min-w-0 flex-1 truncate text-[11px] text-gray-400">
            {s.label}
          </div>
          <div
            className={[
              "shrink-0 text-xl font-bold tabular-nums",
              s.accent ?? "text-white",
            ].join(" ")}
          >
            {s.value}
          </div>
          {s.hint && (
            <div className="hidden max-w-[42%] truncate text-[10px] text-gray-500 sm:block">
              {s.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
