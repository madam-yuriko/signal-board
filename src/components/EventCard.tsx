import { useState } from "react";
import { Calendar, Check, ChevronDown, ExternalLink, MapPin, Plane } from "lucide-react";
import type { BoxingEvent } from "@/types";
import { formatDate, isEventUpcoming, isUpcoming } from "@/lib/format";
import { eventImageUrl } from "@/lib/eventImage";
import BoutRow from "@/components/BoutRow";
import EventImage from "@/components/EventImage";

export default function EventCard({
  event,
  checked,
  onToggleCheck,
}: {
  event: BoxingEvent;
  checked: boolean;
  onToggleCheck: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const upcoming = isEventUpcoming(event);
  const titleIsUpcoming = isUpcoming(event.date);
  const officialUrl = event.detailsUrl ?? event.sourceUrl;
  const orderedBouts = [
    ...event.bouts.filter((bout) => bout.isMainEvent),
    ...event.bouts.filter((bout) => !bout.isMainEvent),
  ];
  const primaryBouts = orderedBouts.slice(0, 2);
  const additionalBouts = orderedBouts.slice(2);

  return (
    <article className="glass-card group relative overflow-hidden rounded-lg">
      <div className="p-3 pb-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2
              className={`text-xl font-bold leading-tight sm:text-2xl ${
                titleIsUpcoming ? "text-yellow-300" : "text-white"
              }`}
            >
              {event.name}
            </h2>

            {event.series && (
              <div className="mt-1.5 inline-flex rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-200">
                {event.series}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(event.date)}
                {event.startTime && ` ${event.startTime}開始`}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.venue} / {event.city}
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-pressed={checked}
            onClick={onToggleCheck}
            className={`relative z-20 inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold shadow-lg backdrop-blur transition ${
              checked
                ? "border-emerald-300/50 bg-emerald-400/25 text-emerald-100"
                : "border-white/20 bg-black/55 text-gray-200 hover:border-emerald-300/40 hover:text-emerald-100"
            }`}
          >
            {checked && <Check className="h-3.5 w-3.5" />}
            {checked ? "観たい済み" : "観たい"}
          </button>
        </div>
      </div>
      {/* 代表画像バナー（団体ステータスを上にオーバーレイ） */}
      <div className="relative">
        <EventImage src={eventImageUrl(event)} alt={event.name} />

        {!event.domestic && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full border border-sky-400/40 bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-sky-300 backdrop-blur">
            <Plane className="h-3 w-3" />
            海外
          </span>
        )}

        {upcoming && (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full border border-amber-400/40 bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            開催予定
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="space-y-1.5">
          {primaryBouts.map((bout) => (
            <BoutRow key={bout.id} bout={bout} />
          ))}
          {additionalBouts.length > 0 && (
            <div
              className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ${
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="min-h-0 space-y-1.5">
                {additionalBouts.map((bout) => (
                  <BoutRow key={bout.id} bout={bout} />
                ))}
              </div>
            </div>
          )}
          {additionalBouts.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] font-semibold text-gray-300 transition hover:border-sky-400/30 hover:text-sky-200"
            >
              {expanded
                ? "カードを閉じる"
                : `残り${additionalBouts.length}試合を表示`}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
          {event.bouts.length === 0 && (
            <div className="rounded-md border border-white/5 bg-black/20 p-2.5 text-[11px] leading-relaxed text-gray-400">
              {upcoming
                ? "対戦カードは公式発表後に確認できます。"
                : "公式の試合結果を参照できます。"}
            </div>
          )}
        </div>
        {officialUrl && (
          <a
            href={officialUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200"
          >
            <ExternalLink className="h-3 w-3" />
            {event.detailsUrl
              ? upcoming
                ? "公式対戦カードを見る"
                : "公式試合結果を見る"
              : "公式掲載ページを見る"}
          </a>
        )}
      </div>
    </article>
  );
}
