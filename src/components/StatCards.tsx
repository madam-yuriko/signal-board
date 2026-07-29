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
        <div key={s.label} className="glass-card rounded-lg p-3">
          <div className="text-[11px] text-gray-400">{s.label}</div>
          <div
            className={`mt-0.5 text-xl font-bold tabular-nums ${
              s.accent ?? "text-white"
            }`}
          >
            {s.value}
          </div>
          {s.hint && <div className="text-[10px] text-gray-500">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}
