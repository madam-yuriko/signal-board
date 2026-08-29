import type { Bout, BoutTitle } from "@/types";
import { ORG_STYLES } from "@/lib/format";
import { boutTitleLabel, titlesForBout } from "@/lib/boutTitles";

function titleStyle(title: BoutTitle): string {
  if (title.kind === "world") return ORG_STYLES[title.organization];
  if (title.kind === "wbo-ap") {
    return "border-blue-400/35 bg-blue-400/10 text-blue-200";
  }
  if (title.kind === "opbf") {
    return "border-cyan-400/35 bg-cyan-400/10 text-cyan-200";
  }
  if (title.kind === "japan" || title.kind === "japan-youth") {
    return "border-rose-400/35 bg-rose-400/10 text-rose-200";
  }
  if (title.kind === "regional") {
    return "border-violet-400/35 bg-violet-400/10 text-violet-200";
  }
  return "border-white/10 bg-white/[0.03] text-gray-500";
}

export default function BoutTitleBadges({ bout }: { bout: Bout }) {
  return titlesForBout(bout).map((title) => {
    const label = boutTitleLabel(title);
    return (
      <span
        key={`${title.kind}:${label}`}
        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${titleStyle(title)}`}
      >
        {label}
      </span>
    );
  });
}
