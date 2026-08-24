"use client";

type Accent = "amber" | "emerald" | "fuchsia" | "red";

const ACCENT_STYLES: Record<Accent, string> = {
  amber: "border-amber-300/50 bg-amber-400/15 text-amber-100",
  emerald: "border-emerald-300/50 bg-emerald-400/15 text-emerald-100",
  fuchsia: "border-fuchsia-300/50 bg-fuchsia-400/15 text-fuchsia-100",
  red: "border-red-300/50 bg-red-400/15 text-red-100",
};

const ACCENT_HOVER_STYLES: Record<Accent, string> = {
  amber: "hover:border-amber-300/40 hover:text-amber-100",
  emerald: "hover:border-emerald-300/40 hover:text-emerald-100",
  fuchsia: "hover:border-fuchsia-300/40 hover:text-fuchsia-100",
  red: "hover:border-red-300/40 hover:text-red-100",
};

interface Props {
  label: string;
  active: boolean;
  count: number;
  onChange: (active: boolean) => void;
  accent?: Accent;
}

export default function CheckedOnlyFilter({
  label,
  active,
  count,
  onChange,
  accent = "emerald",
}: Props) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold text-gray-500">
        {label}
      </div>
      <div
        role="group"
        aria-label={`${label}で絞り込み`}
        className="flex flex-wrap gap-1"
      >
        <button
          type="button"
          aria-pressed={!active}
          onClick={() => onChange(false)}
          className={`rounded-md border px-2 py-1 text-[11px] ${
            !active
              ? "border-white/25 bg-white/10 text-white"
              : "border-white/8 text-gray-500 hover:text-gray-300"
          }`}
        >
          すべて
        </button>
        <button
          type="button"
          aria-pressed={active}
          onClick={() => onChange(true)}
          disabled={count === 0 && !active}
          className={`rounded-md border px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${
            active
              ? ACCENT_STYLES[accent]
              : `border-white/8 text-gray-500 ${ACCENT_HOVER_STYLES[accent]}`
          }`}
        >
          {label}だけ（{count}）
        </button>
      </div>
    </div>
  );
}
