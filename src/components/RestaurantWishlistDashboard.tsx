"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  CircleDollarSign,
  ExternalLink,
  LoaderCircle,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Utensils,
} from "lucide-react";
import type { RestaurantWishlistRecord } from "@/types/restaurant";
import CardListPagination, { useCardListPagination } from "@/components/CardListPagination";

function number(value?: number) {
  return value === undefined ? "—" : value.toLocaleString("ja-JP");
}

function savedDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function mapsUrl(record: RestaurantWishlistRecord) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [record.name, record.prefecture, record.address].filter(Boolean).join(" "),
  )}`;
}

function budgetSortValue(value?: string) {
  if (!value) return -1;
  const amounts = [...value.matchAll(/\d[\d,]*/g)]
    .map((match) => Number(match[0].replaceAll(",", "")))
    .filter(Number.isFinite);
  return amounts.length > 0 ? Math.max(...amounts) : -1;
}

function Metric({ icon: Icon, label, value }: {
  icon: typeof Utensils;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/7 bg-black/15 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><Icon className="h-3 w-3" />{label}</div>
      <div className="mt-1 text-base font-bold tabular-nums text-gray-100">{value}</div>
    </div>
  );
}

function RestaurantCard({ record, removing, onRemove }: {
  record: RestaurantWishlistRecord;
  removing: boolean;
  onRemove: (record: RestaurantWishlistRecord) => void;
}) {
  return (
    <article className="glass-card flex h-full flex-col rounded-xl p-4">
      {record.imageUrl && <div className="relative -mx-4 -mt-4 mb-4 aspect-[16/7] overflow-hidden rounded-t-xl border-b border-white/7 bg-black/20"><Image src={record.imageUrl} alt={`${record.name}のイメージ画像`} fill unoptimized sizes="(max-width: 640px) 100vw, 360px" className="object-cover transition-transform duration-500 hover:scale-[1.02]" /></div>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1">
            {record.prefecture && <span className="rounded border border-amber-300/20 bg-amber-300/8 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">{record.prefecture}</span>}
            {record.status && <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-gray-400">{record.status}</span>}
          </div>
          <h2 className="mt-2 text-base font-bold leading-snug text-white">{record.name}</h2>
          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-gray-500">{record.address ?? "所在地未登録"}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(record)}
          disabled={removing}
          aria-label={`${record.name}を行きたい店から削除`}
          className="shrink-0 rounded-md p-1.5 text-gray-600 hover:bg-rose-400/10 hover:text-rose-300 disabled:cursor-wait"
        >
          {removing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <div className="rounded-md border border-white/7 bg-black/15 px-2 py-1.5"><div className="flex items-center gap-1 text-[9px] text-gray-600"><Star className="h-2.5 w-2.5" />点数</div><div className="mt-0.5 font-bold tabular-nums text-rose-200">{record.score?.toFixed(2) ?? "—"}</div></div>
        <div className="rounded-md border border-white/7 bg-black/15 px-2 py-1.5"><div className="flex items-center gap-1 text-[9px] text-gray-600"><MessageCircle className="h-2.5 w-2.5" />口コミ</div><div className="mt-0.5 font-bold tabular-nums text-cyan-200">{number(record.reviewCount)}</div></div>
        <div className="rounded-md border border-white/7 bg-black/15 px-2 py-1.5"><div className="flex items-center gap-1 text-[9px] text-gray-600"><Bookmark className="h-2.5 w-2.5" />食べログ保存</div><div className="mt-0.5 font-bold tabular-nums text-cyan-200">{number(record.tabelogSaveCount)}</div></div>
      </div>

      {record.genres.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{record.genres.map((genre) => <span key={genre} className="rounded-md border border-cyan-300/12 bg-cyan-300/[0.04] px-2 py-1 text-[10px] text-cyan-100/75">{genre}</span>)}</div>}

      <div className="mt-3 space-y-1.5 text-[10px] text-gray-500">
        <div className="flex items-center gap-1.5"><CircleDollarSign className="h-3 w-3 text-gray-600" /><span>{record.budget ?? "予算未登録"}</span>{record.seats !== undefined && <span className="ml-auto">{record.seats}席</span>}</div>
        {record.facility && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-gray-600" /><span className="truncate">{record.facility}</span></div>}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/7 pt-3">
        <span className="text-[9px] text-gray-600">追加日 {savedDate(record.addedAt)}</span>
        <div className="flex gap-1.5">
          <a href={mapsUrl(record)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-[10px] text-gray-400 hover:bg-white/5 hover:text-white"><MapPin className="h-3 w-3" />地図</a>
          <a href={record.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-cyan-300/20 bg-cyan-300/7 px-2 py-1.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-300/12">食べログ<ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>
    </article>
  );
}

export default function RestaurantWishlistDashboard({ initialRecords }: { initialRecords: RestaurantWishlistRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [query, setQuery] = useState("");
  const [prefecture, setPrefecture] = useState("all");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("newest");
  const [syncing, setSyncing] = useState(false);
  const [removingId, setRemovingId] = useState<string>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(async (showIndicator = false) => {
    if (showIndicator) setSyncing(true);
    try {
      const response = await fetch("/api/restaurants", { cache: "no-store" });
      const payload = await response.json() as { records?: RestaurantWishlistRecord[]; error?: string };
      if (!response.ok || !payload.records) throw new Error(payload.error ?? "同期できませんでした。");
      setRecords(payload.records);
      setError(undefined);
    } catch (caught) {
      if (showIndicator) setError(caught instanceof Error ? caught.message : "同期できませんでした。");
    } finally {
      if (showIndicator) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const prefectures = useMemo(() => [...new Set(records.map((record) => record.prefecture).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "ja")), [records]);
  const genres = useMemo(() => [...new Set(records.flatMap((record) => record.genres))].sort((a, b) => a.localeCompare(b, "ja")), [records]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ja");
    return records
      .filter((record) => {
        const haystack = [record.name, record.prefecture, record.address, record.facility, record.budget, ...record.genres].filter(Boolean).join(" ").toLocaleLowerCase("ja");
        return (prefecture === "all" || record.prefecture === prefecture)
          && (genre === "all" || record.genres.includes(genre))
          && (!normalizedQuery || haystack.includes(normalizedQuery));
      })
      .sort((left, right) => {
        if (sort === "score") return (right.score ?? -1) - (left.score ?? -1);
        if (sort === "reviews") return (right.reviewCount ?? -1) - (left.reviewCount ?? -1);
        if (sort === "budget-desc") return budgetSortValue(right.budget) - budgetSortValue(left.budget);
        return right.addedAt.localeCompare(left.addedAt);
      });
  }, [genre, prefecture, query, records, sort]);
  const {
    visibleItems: visibleRecords,
    showMore: showMoreCards,
  } = useCardListPagination(filtered);

  const averageScore = records.length > 0
    ? records.reduce((sum, record) => sum + (record.score ?? 0), 0) / records.filter((record) => record.score !== undefined).length
    : undefined;

  async function remove(record: RestaurantWishlistRecord) {
    if (!window.confirm(`「${record.name}」を行きたい店から削除しますか？`)) return;
    setRemovingId(record.tabelogId);
    try {
      const response = await fetch(`/api/restaurants?id=${encodeURIComponent(record.tabelogId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("削除できませんでした。");
      setRecords((current) => current.filter((item) => item.tabelogId !== record.tabelogId));
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "削除できませんでした。");
    } finally {
      setRemovingId(undefined);
    }
  }

  return <div className="space-y-4">
    <section className="relative overflow-hidden rounded-xl border border-amber-300/10 bg-gradient-to-r from-amber-950/30 via-[#111318] to-rose-950/20 px-4 py-5 sm:px-5">
      <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-amber-300/7 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-amber-300/80"><Utensils className="h-3.5 w-3.5" />RESTAURANT WISHLIST</div><h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">行きたい飲食店</h1><p className="mt-1.5 text-xs leading-relaxed text-gray-400">Tabelog Insightでチェックした店舗を自動同期します。開いたままでも約5秒で反映されます。</p></div>
        <button type="button" onClick={() => void refresh(true)} disabled={syncing} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/8 px-3 text-[11px] font-semibold text-amber-100 hover:bg-amber-300/12 disabled:cursor-wait"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />今すぐ同期</button>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4"><Metric icon={Utensils} label="行きたい店" value={`${records.length}件`} /><Metric icon={Star} label="平均点" value={Number.isFinite(averageScore) ? averageScore!.toFixed(2) : "—"} /><Metric icon={MapPin} label="都道府県" value={`${prefectures.length}地域`} /><Metric icon={Bookmark} label="ジャンル" value={`${genres.length}種類`} /></section>

    <section className="glass-card flex flex-wrap items-end gap-2 rounded-lg px-3 py-2.5">
      <label className="relative min-w-[200px] flex-1"><span className="sr-only">店舗を検索</span><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="店名・所在地・施設名を検索" className="h-8 w-full rounded-md border border-white/10 bg-black/20 pl-8 pr-2 text-[11px] outline-none placeholder:text-gray-700 focus:border-amber-300/35" /></label>
      <select value={prefecture} onChange={(event) => setPrefecture(event.target.value)} aria-label="都道府県" className="h-8 rounded-md border border-white/10 bg-[#111318] px-2 text-[11px] text-gray-300"><option value="all">すべての都道府県</option>{prefectures.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="ジャンル" className="h-8 rounded-md border border-white/10 bg-[#111318] px-2 text-[11px] text-gray-300"><option value="all">すべてのジャンル</option>{genres.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="並び順" className="h-8 rounded-md border border-white/10 bg-[#111318] px-2 text-[11px] text-gray-300"><option value="newest">追加が新しい順</option><option value="score">点数が高い順</option><option value="reviews">口コミが多い順</option><option value="budget-desc">予算が高い順</option></select>
      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-gray-600">{filtered.length}件表示</span>
    </section>

    {error && <div role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-xs text-rose-200">{error}</div>}
    {filtered.length === 0 ? <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-5 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-300/8 text-amber-200"><Utensils className="h-7 w-7" /></div><h2 className="mt-4 text-sm font-bold text-gray-200">{records.length === 0 ? "行きたい店はまだありません" : "条件に合う店舗がありません"}</h2><p className="mt-1.5 text-[11px] text-gray-600">{records.length === 0 ? "Tabelog Insightの店舗一覧で左端のチェックを入れてください。" : "検索や絞り込み条件を変えてください。"}</p></section> : <><div className="responsive-card-grid">{visibleRecords.map((record) => <RestaurantCard key={record.tabelogId} record={record} removing={removingId === record.tabelogId} onRemove={(item) => void remove(item)} />)}</div><CardListPagination visibleCount={visibleRecords.length} totalCount={filtered.length} onShowMore={showMoreCards} /></>}
  </div>;
}
