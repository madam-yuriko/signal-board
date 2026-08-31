import { Star } from "lucide-react";
import type { Bout } from "@/types";
import BoutTitleBadges from "@/components/BoutTitleBadges";
import { fighterAnnotation } from "@/lib/fighterInfo";

function isSelectableFighter(name: string): boolean {
  return Boolean(name) && name !== "未定" && !name.startsWith("__");
}

function FighterName({
  name,
  annotation,
  emphasized,
  onSelectFighter,
}: {
  name: string;
  annotation?: string;
  emphasized: boolean;
  onSelectFighter?: (fighter: string) => void;
}) {
  const content = (
    <>
      {name}
      {annotation && (
        <span className="ml-1 text-[11px] text-gray-500">({annotation})</span>
      )}
    </>
  );
  const className = `whitespace-nowrap ${emphasized ? "font-bold text-white" : "text-gray-300"}`;

  if (!onSelectFighter || !isSelectableFighter(name)) {
    return <span className={className}>{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelectFighter(name)}
      className={`${className} cursor-pointer underline decoration-white/20 underline-offset-2 transition-colors hover:text-red-200 hover:decoration-red-300/60`}
      aria-label={`${name}の選手別結果を表示`}
    >
      {content}
    </button>
  );
}

export default function BoutRow({
  bout,
  onSelectFighter,
}: {
  bout: Bout;
  onSelectFighter?: (fighter: string) => void;
}) {
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
          <BoutTitleBadges bout={bout} />
        </div>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <FighterName
            name={bout.jpFighter}
            annotation={jpAnnotation}
            emphasized={jpFighterWon}
            onSelectFighter={onSelectFighter}
          />
          {jpFighterWon && (
            <span className="whitespace-nowrap rounded border border-emerald-400/30 bg-emerald-400/10 px-1 py-0.5 text-[9px] font-bold text-emerald-300">
              勝
            </span>
          )}
          <span className="whitespace-nowrap text-gray-500">vs</span>
          <FighterName
            name={bout.opponent}
            annotation={opponentAnnotation}
            emphasized={opponentWon}
            onSelectFighter={onSelectFighter}
          />
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
