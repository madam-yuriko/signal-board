import { Star } from "lucide-react";
import type { Bout } from "@/types";
import OrgBadge from "@/components/OrgBadge";

export default function BoutRow({ bout }: { bout: Bout }) {
  const jpFighterWon = bout.result === "win";
  const opponentWon = bout.result === "loss";

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-white/5 bg-black/20 p-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {bout.isMainEvent && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
              <Star className="h-3 w-3 fill-amber-300" />
              MAIN
            </span>
          )}
          <span className="text-[11px] text-gray-400">{bout.weightClass}</span>
          {bout.organizations.map((o) => (
            <OrgBadge key={o} org={o} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <span className={jpFighterWon ? "font-bold text-white" : "text-gray-300"}>
            {bout.jpFighter}
          </span>
          <span className="text-gray-500">vs</span>
          <span
            className={opponentWon ? "font-bold text-white" : "text-gray-300"}
          >
            {bout.opponent}
            {bout.opponentCountry && (
              <span className="ml-1 text-[11px] text-gray-500">
                ({bout.opponentCountry})
              </span>
            )}
          </span>
        </div>

        {bout.notes && (
          <div className="mt-0.5 text-[11px] text-gray-500">{bout.notes}</div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:flex-col sm:items-end">
        {bout.method && (
          <span className="text-[11px] text-gray-400">{bout.method}</span>
        )}
      </div>
    </div>
  );
}
