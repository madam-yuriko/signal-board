import { Calendar, MapPin, Plane } from "lucide-react";
import type { BoxingEvent } from "@/types";
import { formatDate, isUpcoming } from "@/lib/format";
import { eventImageUrl } from "@/lib/eventImage";
import BoutRow from "@/components/BoutRow";
import EventImage from "@/components/EventImage";

export default function EventCard({ event }: { event: BoxingEvent }) {
  const upcoming = isUpcoming(event.date);

  return (
    <article className="glass-card group overflow-hidden rounded-lg">
      <div className="p-3 pb-2.5">
        <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">
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
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {event.venue} / {event.city}
          </span>
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
          {event.bouts.map((bout) => (
            <BoutRow key={bout.id} bout={bout} />
          ))}
        </div>
      </div>
    </article>
  );
}
