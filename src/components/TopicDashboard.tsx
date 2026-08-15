"use client";

import { useMemo, useState } from "react";
import {
  BellRing,
  Building2,
  CalendarClock,
  Clock3,
  Cpu,
  Film,
  MapPin,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react";
import type {
  TopicBoard,
  TopicDomain,
  TopicStatusTone,
} from "@/types/topics";
import StatCards, { type Stat } from "@/components/StatCards";

const TONE_STYLES: Record<TopicStatusTone, string> = {
  neutral: "border-white/15 bg-white/5 text-gray-300",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  danger: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
};

const DOMAIN_STYLES: Record<
  TopicDomain,
  {
    label: string;
    eyebrow: string;
    icon: typeof Building2;
    filter: string;
    imageFallback: string;
    searchPlaceholder: string;
  }
> = {
  hardware: {
    label: "CPU・GPU・APU",
    eyebrow: "プロセッサ・グラフィックス",
    icon: Cpu,
    filter: "focus:border-violet-400/60",
    imageFallback: "from-violet-950 via-zinc-900 to-cyan-950",
    searchPlaceholder: "製品名・メーカー・キーワードで検索",
  },
  redevelopment: {
    label: "再開発",
    eyebrow: "都市プロジェクト",
    icon: Building2,
    filter: "focus:border-cyan-400/60",
    imageFallback: "from-cyan-950 via-zinc-900 to-emerald-950",
    searchPlaceholder: "再開発名・地域・キーワードで検索",
  },
  movie: {
    label: "映画",
    eyebrow: "映画・映像作品",
    icon: Film,
    filter: "focus:border-fuchsia-400/60",
    imageFallback: "from-fuchsia-950 via-zinc-900 to-indigo-950",
    searchPlaceholder: "作品名・ジャンル・キーワードで検索",
  },
  disaster: {
    label: "災害",
    eyebrow: "防災・危機管理",
    icon: TriangleAlert,
    filter: "focus:border-rose-400/60",
    imageFallback: "from-rose-950 via-zinc-900 to-amber-950",
    searchPlaceholder: "事象名・地域・キーワードで検索",
  },
};

function statusStats(domain: TopicDomain, items: TopicBoard[]): Stat[] {
  if (domain === "hardware") {
    return [
      { label: "登録製品", value: items.length, hint: "条件に一致" },
      {
        label: "CPU",
        value: items.filter((item) => item.category === "CPU").length,
        accent: "text-violet-300",
        hint: "プロセッサ",
      },
      {
        label: "GPU",
        value: items.filter((item) => item.category === "GPU").length,
        accent: "text-cyan-300",
        hint: "グラフィックス",
      },
      {
        label: "APU",
        value: items.filter((item) => item.category === "APU").length,
        accent: "text-emerald-300",
        hint: "統合プロセッサ",
      },
    ];
  }

  if (domain === "redevelopment") {
    return [
      { label: "登録案件", value: items.length, hint: "条件に一致" },
      {
        label: "工事中",
        value: items.filter((item) => item.status === "construction").length,
        accent: "text-amber-300",
        hint: "施工フェーズ",
      },
      {
        label: "計画中",
        value: items.filter((item) => item.status === "planning").length,
        accent: "text-cyan-300",
        hint: "着工前",
      },
      {
        label: "対象地域",
        value: new Set(items.map((item) => item.region)).size,
        hint: "収録エリア",
      },
    ];
  }

  if (domain === "movie") {
    return [
      { label: "作品数", value: items.length, hint: "条件に一致" },
      {
        label: "公開中",
        value: items.filter((item) => item.status === "screening").length,
        accent: "text-fuchsia-300",
        hint: "劇場公開中",
      },
      {
        label: "公開予定",
        value: items.filter((item) => item.status === "upcoming").length,
        accent: "text-amber-300",
        hint: "近日公開",
      },
      {
        label: "配信中",
        value: items.filter((item) => item.status === "streaming").length,
        accent: "text-emerald-300",
        hint: "見放題・レンタル",
      },
    ];
  }

  return [
    { label: "監視事象", value: items.length, hint: "条件に一致" },
    {
      label: "警戒",
      value: items.filter((item) => item.statusTone === "danger").length,
      accent: "text-rose-300",
      hint: "訓練上の高警戒",
    },
    {
      label: "監視中",
      value: items.filter((item) => item.status === "monitoring").length,
      accent: "text-amber-300",
      hint: "経過確認",
    },
    {
      label: "対象地域",
      value: new Set(items.map((item) => item.region)).size,
      hint: "収録エリア",
    },
  ];
}

function TopicCard({ item }: { item: TopicBoard }) {
  const [imageFailed, setImageFailed] = useState(false);
  const domain = DOMAIN_STYLES[item.domain];

  return (
    <article className="glass-card group overflow-hidden rounded-lg">
      <div className="p-3 pb-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
            {item.category}
          </span>
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${TONE_STYLES[item.statusTone]}`}
          >
            {item.statusLabel}
          </span>
        </div>
        <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">
          {item.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {item.dateLabel}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {item.location}
          </span>
        </div>
      </div>

      <div
        className={`relative aspect-[16/7] overflow-hidden bg-gradient-to-br ${domain.imageFallback}`}
      >
        {!imageFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#14141c] via-transparent to-black/10" />
      </div>

      <div className="space-y-3 p-3">
        <p className="text-xs leading-relaxed text-gray-300">{item.summary}</p>

        <dl className="grid grid-cols-2 border-y border-white/8">
          {item.metrics.map((metric) => (
            <div
              key={metric.label}
              className="border-b border-white/8 px-1 py-2 odd:border-r last:border-b-0 [&:nth-last-child(2)]:border-b-0"
            >
              <dt className="text-[10px] text-gray-500">{metric.label}</dt>
              <dd className="mt-0.5 text-xs font-semibold text-gray-100">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <div>
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-gray-500">
            <Clock3 className="h-3 w-3" />
            最新更新
          </div>
          <div className="space-y-1.5">
            {item.updates.map((update) => (
              <div
                key={`${update.at}-${update.text}`}
                className="flex gap-2 text-[11px] leading-relaxed"
              >
                <span className="w-12 shrink-0 text-gray-500">{update.at}</span>
                <span className="text-gray-300">{update.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-white/8 px-1.5 py-0.5 text-[10px] text-gray-500"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

interface Props {
  domain: TopicDomain;
  title: string;
  description: string;
  items: TopicBoard[];
  feedMode: "live" | "fallback";
  sourceName: string;
  updatedAt?: string;
}

function formatUpdatedAt(value?: string): string | undefined {
  if (!value) return undefined;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function TopicDashboard({
  domain,
  title,
  description,
  items,
  feedMode,
  sourceName,
  updatedAt,
}: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [region, setRegion] = useState("all");

  const domainStyle = DOMAIN_STYLES[domain];
  const DomainIcon = domainStyle.icon;
  const updatedLabel = formatUpdatedAt(updatedAt);
  const statuses = useMemo(
    () =>
      [...new Map(items.map((item) => [item.status, item.statusLabel])).entries()],
    [items],
  );
  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))],
    [items],
  );
  const regions = useMemo(
    () => [...new Set(items.map((item) => item.region))],
    [items],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (category !== "all" && item.category !== category) return false;
      if (region !== "all" && item.region !== region) return false;
      if (!normalizedQuery) return true;

      return [
        item.title,
        item.category,
        item.location,
        item.region,
        item.summary,
        ...item.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [category, items, query, region, status]);

  const hasFilters =
    query.trim() !== "" ||
    status !== "all" ||
    category !== "all" ||
    region !== "all";

  function resetFilters() {
    setQuery("");
    setStatus("all");
    setCategory("all");
    setRegion("all");
  }

  return (
    <div className="space-y-4">
      <section className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
            <DomainIcon className="h-3.5 w-3.5" />
            {domainStyle.eyebrow}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-400">
            {description}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-right text-[10px] font-semibold ${
            feedMode === "live"
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
              : "border-amber-400/20 bg-amber-400/10 text-amber-300"
          }`}
          title={sourceName}
        >
          {feedMode === "live" ? "実データ" : "保存データ"}
          {updatedLabel && (
            <span className="mt-0.5 block font-normal opacity-70">
              更新 {updatedLabel}
            </span>
          )}
        </span>
      </section>

      {feedMode === "fallback" && (
        <div className="rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          外部ソースに接続できないため、保存済みデータを表示しています。
        </div>
      )}

      <StatCards stats={statusStats(domain, filtered)} />

      <section className="glass-card space-y-3 rounded-lg p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={domainStyle.searchPlaceholder}
              className={`w-full rounded-md border border-white/10 bg-black/30 py-2 pl-8 pr-3 text-xs text-white outline-none placeholder:text-gray-600 ${domainStyle.filter}`}
            />
          </div>
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            aria-label="地域で絞り込み"
            className={`rounded-md border border-white/10 bg-[#101018] px-2.5 py-2 text-xs text-gray-300 outline-none ${domainStyle.filter}`}
          >
            <option value="all">すべての地域</option>
            {regions.map((itemRegion) => (
              <option key={itemRegion} value={itemRegion}>
                {itemRegion}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              title="フィルタをリセット"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs text-gray-400 hover:border-white/20 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              リセット
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[10px] font-semibold text-gray-500">
              状態
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setStatus("all")}
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  status === "all"
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/8 text-gray-500 hover:text-gray-300"
                }`}
              >
                すべて
              </button>
              {statuses.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`rounded-md border px-2 py-1 text-[11px] ${
                    status === value
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-white/8 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-semibold text-gray-500">
              種類
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCategory("all")}
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  category === "all"
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/8 text-gray-500 hover:text-gray-300"
                }`}
              >
                すべて
              </button>
              {categories.map((itemCategory) => (
                <button
                  key={itemCategory}
                  type="button"
                  onClick={() => setCategory(itemCategory)}
                  className={`rounded-md border px-2 py-1 text-[11px] ${
                    category === itemCategory
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-white/8 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {itemCategory}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-2 rounded-lg py-12 text-center text-gray-400">
          {domain === "disaster" ? (
            <BellRing className="h-6 w-6 text-gray-600" />
          ) : domain === "movie" ? (
            <Film className="h-6 w-6 text-gray-600" />
          ) : domain === "hardware" ? (
            <Cpu className="h-6 w-6 text-gray-600" />
          ) : (
            <Building2 className="h-6 w-6 text-gray-600" />
          )}
          <p className="text-sm">条件に一致するボードがありません。</p>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-gray-500 underline underline-offset-4 hover:text-white"
          >
            フィルタを解除
          </button>
        </div>
      ) : (
        <div className="gap-3 [column-fill:_balance] columns-1 sm:columns-2 xl:columns-3">
          {filtered.map((item) => (
            <div key={item.id} className="mb-3 break-inside-avoid">
              <TopicCard item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
