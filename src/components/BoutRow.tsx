import { Star } from "lucide-react";
import type { Bout } from "@/types";
import OrgBadge from "@/components/OrgBadge";
import { fighterAnnotation } from "@/lib/fighterInfo";

export default function BoutRow({ bout }: { bout: Bout }) {
  const jpFighterWon = bout.result === "win";
  const opponentWon = bout.result === "loss";
  const jpAnnotation = fighterAnnotation(bout.jpFighter, {
    country: bout.jpFighterCountry,
    gym: bout.jpFighterGym,
  });
  const opponentAnnotation = fighterAnnotation(bout.opponent, {
    country: bout.opponentCountry,
    gym: bout.opponentGym,
  });

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-white/5 bg-black/20 p-2.5">
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
          <span className={`whitespace-nowrap ${jpFighterWon ? "font-bold text-white" : "text-gray-300"}`}>
            {bout.jpFighter}
            {jpAnnotation && (
              <span className="ml-1 text-[11px] text-gray-500">
                ({jpAnnotation})
              </span>
            )}
          </span>
          {jpFighterWon && (
            <span className="whitespace-nowrap rounded border border-emerald-400/30 bg-emerald-400/10 px-1 py-0.5 text-[9px] font-bold text-emerald-300">
              勝
            </span>
          )}
          <span className="whitespace-nowrap text-gray-500">vs</span>
          <span
            className={`whitespace-nowrap ${opponentWon ? "font-bold text-white" : "text-gray-300"}`}
          >
            {bout.opponent}
            {opponentAnnotation && (
              <span className="ml-1 text-[11px] text-gray-500">
                ({opponentAnnotation})
              </span>
            )}
          </span>
          {opponentWon && (
            <span className="whitespace-nowrap rounded border border-emerald-400/30 bg-emerald-400/10 px-1 py-0.5 text-[9px] font-bold text-emerald-300">
              勝
            </span>
          )}
          {bout.result === "draw" && (
            <span className="whitespace-nowrap rounded border border-slate-400/30 bg-slate-400/10 px-1 py-0.5 text-[9px] font-bold text-slate-300">
              引分
            </span>
          )}
          {bout.result === "no-contest" && (
            <span className="whitespace-nowrap rounded border border-slate-400/30 bg-slate-400/10 px-1 py-0.5 text-[9px] font-bold text-slate-300">
              無効
            </span>
          )}
          {bout.result === "cancelled" && (
            <span className="whitespace-nowrap rounded border border-rose-400/30 bg-rose-400/10 px-1 py-0.5 text-[9px] font-bold text-rose-300">
              中止
            </span>
          )}
          {bout.method && (
            <span className="ml-auto whitespace-nowrap text-[11px] text-gray-400">
              {bout.method}
            </span>
          )}
        </div>

        {bout.notes && (
          <div className="mt-0.5 text-[11px] text-gray-500">{bout.notes}</div>
        )}
      </div>

    </div>
  );
}
