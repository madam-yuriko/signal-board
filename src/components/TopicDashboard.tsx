"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Building2,
  CalendarClock,
  ChevronDown,
  Clock3,
  Cpu,
  Film,
  MapPin,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react";
import type {
  MovieType,
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

const MOVIE_TYPES: MovieType[] = ["邦画", "洋画", "アニメ/CG"];
const MOVIE_INITIAL_VISIBLE_CARDS = 30;
const MOVIE_THEATER_PREFECTURES = [
  ["01", "北海道"], ["02", "青森"], ["03", "岩手"], ["04", "宮城"], ["05", "秋田"],
  ["06", "山形"], ["07", "福島"], ["08", "茨城"], ["09", "栃木"], ["10", "群馬"],
  ["11", "埼玉"], ["12", "千葉"], ["13", "東京"], ["14", "神奈川"], ["15", "新潟"],
  ["16", "富山"], ["17", "石川"], ["18", "福井"], ["19", "山梨"], ["20", "長野"],
  ["21", "岐阜"], ["22", "静岡"], ["23", "愛知"], ["24", "三重"], ["25", "滋賀"],
  ["26", "京都"], ["27", "大阪"], ["28", "兵庫"], ["29", "奈良"], ["30", "和歌山"],
  ["31", "鳥取"], ["32", "島根"], ["33", "岡山"], ["34", "広島"], ["35", "山口"],
  ["36", "徳島"], ["37", "香川"], ["38", "愛媛"], ["39", "高知"], ["40", "福岡"],
  ["41", "佐賀"], ["42", "長崎"], ["43", "熊本"], ["44", "大分"], ["45", "宮崎"],
  ["46", "鹿児島"], ["47", "沖縄"],
] as const;
type TheaterOption = { name: string; path: string };
const MOVIE_GENRE_ORDER = [
  "アクション",
  "アドベンチャー",
  "サバイバル",
  "パニック",
  "SF",
  "ファンタジー",
  "ホラー",
  "スリラー",
  "サスペンス",
  "ミステリー",
  "犯罪",
  "バイオレンス",
  "ドラマ",
  "ヒューマン",
  "恋愛",
  "青春",
  "コメディ",
  "ファミリー",
  "スポーツ",
  "音楽",
  "戦争",
  "歴史・伝記",
  "ドキュメンタリー",
  "その他",
] as const;

function movieTypeFor(item: TopicBoard): MovieType {
  if (item.movieType) return item.movieType;
  if (/アニメ|CG/i.test(item.category) || item.tags.some((tag) => /アニメ|CG/i.test(tag))) {
    return "アニメ/CG";
  }
  if (/洋画|海外/i.test(item.category) || item.tags.some((tag) => /洋画|海外/i.test(tag))) {
    return "洋画";
  }
  return "邦画";
}

function movieGenresFor(item: TopicBoard): string[] {
  const rawGenres = item.genres && item.genres.length > 0
    ? item.genres
    : item.tags.filter((tag) => new Set<string>(MOVIE_GENRE_ORDER).has(tag));
  const genres = rawGenres.flatMap((genre) => genre === "SFホラー" ? ["SF", "ホラー"] : [genre]);
  const order = new Map<string, number>(MOVIE_GENRE_ORDER.map((genre, index) => [genre, index]));
  return [...new Set(genres)].sort((a, b) => {
    if (a === "その他") return b === "その他" ? 0 : 1;
    if (b === "その他") return -1;
    return (order.get(a) ?? MOVIE_GENRE_ORDER.length - 1) - (order.get(b) ?? MOVIE_GENRE_ORDER.length - 1);
  });
}

function theaterKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/トーホー/g, "toho")
    .replace(/[\s・·,.、。\-ー]/g, "");
}

function parseFavoriteTheaters(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      value = parsed
        .filter((item): item is string => typeof item === "string")
        .flatMap((item) => {
          try {
            const nested = JSON.parse(item) as unknown;
            return Array.isArray(nested)
              ? nested.filter((nestedItem): nestedItem is string => typeof nestedItem === "string")
              : [item];
          } catch {
            return [item];
          }
        })
        .join("\n");
    }
  } catch {
    // Legacy comma/newline-separated values are handled below.
  }
  const unique = new Map<string, string>();
  value
    .split(/[\n,、]/)
    .map((theater) => theater.trim())
    .filter(Boolean)
    .forEach((theater) => {
      const key = theaterKey(theater);
      if (key && !unique.has(key)) unique.set(key, theater);
    });
  return [...unique.values()];
}

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

function MovieTheaterAvailability({
  sourceUrl,
  favoriteTheaters,
}: {
  sourceUrl?: string;
  favoriteTheaters: string[];
}) {
  const markerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [available, setAvailable] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const favoriteTheaterKey = favoriteTheaters.join("\u0000");

  useEffect(() => {
    const theaters = favoriteTheaterKey ? favoriteTheaterKey.split("\u0000") : [];
    if (!sourceUrl || theaters.length === 0) return;
    let cancelled = false;
    let observer: IntersectionObserver | undefined;

    const load = async () => {
      setState("loading");
      const params = new URLSearchParams({ movie: sourceUrl });
      theaters.forEach((theater) => params.append("theater", theater));
      try {
        const response = await fetch(`/api/movie-theaters?${params.toString()}`);
        if (!response.ok) throw new Error("theater availability request failed");
        const result = (await response.json()) as {
          theaters?: Array<{ name: string; available: boolean }>;
          suggestions?: Array<{ name: string; available: boolean }>;
        };
        if (cancelled) return;
        setAvailable((result.theaters ?? []).filter((theater) => theater.available).map((theater) => theater.name));
        setSuggestions((result.suggestions ?? []).filter((theater) => theater.available).map((theater) => theater.name).slice(0, 3));
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    };

    if (typeof IntersectionObserver === "undefined" || !markerRef.current) {
      void load();
    } else {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        void load();
      }, { rootMargin: "240px" });
      observer.observe(markerRef.current);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [favoriteTheaterKey, sourceUrl]);

  if (!sourceUrl || favoriteTheaters.length === 0) return null;
  return (
    <div ref={markerRef} className="rounded-md border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[10px] text-gray-400">
      {state === "loading" || state === "idle" ? "お気に入り劇場の上映状況を確認中…" : null}
      {state === "ready" && available.length > 0 ? (
        <div className="space-y-0.5 text-emerald-300">
          {available.map((theater) => <div key={theater}>{theater}</div>)}
        </div>
      ) : null}
      {state === "ready" && available.length === 0 && suggestions.length > 0 ? (
        <div className="border-t border-white/8 pt-1">
          <button
            type="button"
            onClick={() => setSuggestionsExpanded((value) => !value)}
            aria-expanded={suggestionsExpanded}
            className="flex w-full items-center justify-between gap-2 text-left text-[10px] font-semibold text-amber-200 transition hover:text-amber-100"
          >
            <span>都内の上映劇場（参考）</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${suggestionsExpanded ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ${suggestionsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="min-h-0 space-y-0.5 pt-1 text-amber-200">
              {suggestions.map((theater) => <div key={theater}>{theater}</div>)}
            </div>
          </div>
        </div>
      ) : null}
      {state === "ready" && available.length === 0 && suggestions.length === 0 ? "お気に入り劇場で上映情報なし" : null}
      {state === "error" ? "お気に入り劇場の上映状況を取得できませんでした" : null}
    </div>
  );
}

function TopicCard({ item, favoriteTheaters }: { item: TopicBoard; favoriteTheaters: string[] }) {
  const [imageFailed, setImageFailed] = useState(false);
  const domain = DOMAIN_STYLES[item.domain];

  return (
    <article className="glass-card group overflow-hidden rounded-lg">
      <div className="p-3 pb-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {item.domain === "movie" ? (
            <>
              <span className="rounded-md border border-fuchsia-400/20 bg-fuchsia-400/10 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-200">
                {movieTypeFor(item)}
              </span>
              {movieGenresFor(item).slice(0, 3).map((genre) => (
                <span key={genre} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                  {genre}
                </span>
              ))}
            </>
          ) : (
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
              {item.category}
            </span>
          )}
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

        {item.domain === "movie" && (
          <MovieTheaterAvailability
            sourceUrl={item.sourceUrl}
            favoriteTheaters={favoriteTheaters}
          />
        )}

        <dl className="grid grid-cols-2 border-y border-white/8">
          {item.metrics.map((metric) => (
            <div
              key={metric.label}
              className="border-b border-white/8 px-1 py-2 odd:border-r last:border-b-0 [&:nth-last-child(2)]:border-b-0"
            >
              <dt className="text-[10px] text-gray-500">{metric.label}</dt>
              <dd className={`mt-0.5 text-xs font-semibold text-gray-100 ${metric.label === "メインキャスト" ? "whitespace-pre-line leading-relaxed" : ""}`}>
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
  const [movieTypes, setMovieTypes] = useState<MovieType[]>([]);
  const [movieGenres, setMovieGenres] = useState<string[]>([]);
  const [favoriteTheaters, setFavoriteTheaters] = useState<string[]>([]);
  const [favoriteTheatersSaved, setFavoriteTheatersSaved] = useState(false);
  const [theaterPrefecture, setTheaterPrefecture] = useState("13");
  const [theaterOptions, setTheaterOptions] = useState<TheaterOption[]>([]);
  const [theaterOptionValue, setTheaterOptionValue] = useState("");
  const [theaterOptionsLoading, setTheaterOptionsLoading] = useState(true);
  const [visibleMovieCount, setVisibleMovieCount] = useState(MOVIE_INITIAL_VISIBLE_CARDS);

  const domainStyle = DOMAIN_STYLES[domain];
  const DomainIcon = domainStyle.icon;
  const updatedLabel = formatUpdatedAt(updatedAt);

  useEffect(() => {
    if (domain !== "movie") return;
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("movie-favorite-theaters-v1");
        if (!saved) return;
        const theaters = parseFavoriteTheaters(saved);
        setFavoriteTheaters(theaters);
      } catch {
        // Ignore unavailable browser storage.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [domain]);

  useEffect(() => {
    if (domain !== "movie") return;
    let cancelled = false;
    fetch(`/api/movie-theaters?options=1&pref=${theaterPrefecture}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("theater options request failed");
        return (await response.json()) as { theaters?: TheaterOption[] };
      })
      .then((result) => {
        if (cancelled) return;
        const options = result.theaters ?? [];
        setTheaterOptions(options);
        setFavoriteTheaters((current) => {
          const canonical = new Map(options.map((option) => [theaterKey(option.name), option.name]));
          return parseFavoriteTheaters(JSON.stringify(current.map((name) => canonical.get(theaterKey(name)) ?? name)));
        });
        setTheaterOptionValue("");
      })
      .catch(() => {
        if (!cancelled) setTheaterOptions([]);
      })
      .finally(() => {
        if (!cancelled) setTheaterOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [domain, theaterPrefecture]);
  const statuses = useMemo(
    () =>
      [...new Map(items.map((item) => [item.status, item.statusLabel])).entries()],
    [items],
  );
  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))],
    [items],
  );
  const movieGenresAvailable = useMemo(() => {
    const discovered = new Set(items.flatMap(movieGenresFor));
    const additional = [...discovered].filter(
      (genre) => !MOVIE_GENRE_ORDER.includes(genre as typeof MOVIE_GENRE_ORDER[number]),
    );
    const knownWithoutOther = MOVIE_GENRE_ORDER.filter((genre) => genre !== "その他");
    return [...knownWithoutOther, ...additional.filter((genre) => genre !== "その他"), "その他"];
  }, [items]);
  const regions = useMemo(
    () => [...new Set(items.map((item) => item.region))],
    [items],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (domain === "movie") {
        if (movieTypes.length > 0 && !movieTypes.includes(movieTypeFor(item))) return false;
        const genres = movieGenresFor(item);
        if (movieGenres.length > 0 && !movieGenres.some((genre) => genres.includes(genre))) return false;
      } else if (category !== "all" && item.category !== category) {
        return false;
      }
      if (region !== "all" && item.region !== region) return false;
      if (!normalizedQuery) return true;

      const searchableFields = [
        item.title,
        item.category,
        item.location,
        item.region,
        item.summary,
        ...item.tags,
        ...(domain === "movie" ? [movieTypeFor(item), ...movieGenresFor(item)] : []),
      ];
      return searchableFields
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [category, domain, items, movieGenres, movieTypes, query, region, status]);

  const visibleItems = domain === "movie"
    ? filtered.slice(0, visibleMovieCount)
    : filtered;

  const hasFilters =
    query.trim() !== "" ||
    status !== "all" ||
    (domain !== "movie" && category !== "all") ||
    movieTypes.length > 0 ||
    movieGenres.length > 0 ||
    region !== "all";

  function resetFilters() {
    setQuery("");
    setStatus("all");
    setCategory("all");
    setRegion("all");
    setMovieTypes([]);
    setMovieGenres([]);
  }

  function toggleMovieType(value: MovieType) {
    setMovieTypes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function toggleMovieGenre(value: string) {
    setMovieGenres((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function addFavoriteTheater() {
    if (!theaterOptionValue) return;
    setFavoriteTheaters((current) => current.includes(theaterOptionValue)
      ? current
      : [...current, theaterOptionValue]);
    setTheaterOptionValue("");
    setFavoriteTheatersSaved(false);
  }

  function removeFavoriteTheater(name: string) {
    setFavoriteTheaters((current) => current.filter((theater) => theater !== name));
    setFavoriteTheatersSaved(false);
  }

  function saveFavoriteTheaters() {
    setFavoriteTheatersSaved(true);
    try {
      localStorage.setItem("movie-favorite-theaters-v1", JSON.stringify(favoriteTheaters));
    } catch {
      // Ignore unavailable browser storage.
    }
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

          {domain === "movie" ? (
            <div className="space-y-2 md:col-span-2">
              <div className="relative z-10 rounded-md border border-white/8 bg-white/[0.03] p-2">
                <div className="mb-1 text-[10px] font-semibold text-gray-500">
                  お気に入り劇場
                </div>
                <div className="grid gap-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <select
                    value={theaterPrefecture}
                    onChange={(event) => {
                      setTheaterPrefecture(event.target.value);
                      setTheaterOptionsLoading(true);
                    }}
                    aria-label="劇場の都道府県"
                    className="rounded-md border border-white/10 bg-[#101018] px-2 py-1.5 text-[11px] text-gray-300 outline-none focus:border-fuchsia-400/60"
                  >
                    {MOVIE_THEATER_PREFECTURES.map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={theaterOptionValue}
                    onChange={(event) => setTheaterOptionValue(event.target.value)}
                    aria-label="お気に入り劇場の候補"
                    disabled={theaterOptionsLoading || theaterOptions.length === 0}
                    className="min-w-0 rounded-md border border-white/10 bg-[#101018] px-2 py-1.5 text-[11px] text-gray-300 outline-none focus:border-fuchsia-400/60 disabled:opacity-50"
                  >
                    <option value="">
                      {theaterOptionsLoading ? "候補を読み込み中…" : theaterOptions.length === 0 ? "候補なし" : "劇場を選択…"}
                    </option>
                    {theaterOptions.map((option) => (
                      <option key={option.path} value={option.name}>{option.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addFavoriteTheater}
                    disabled={!theaterOptionValue}
                    className="relative z-10 cursor-pointer rounded-md border border-fuchsia-300/30 bg-fuchsia-400/10 px-2.5 py-1.5 text-[11px] text-fuchsia-100 hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    追加
                  </button>
                </div>
                <div className="mt-2 flex min-h-7 flex-wrap gap-1">
                  {favoriteTheaters.map((theater) => (
                    <button
                      key={theater}
                      type="button"
                      onClick={() => removeFavoriteTheater(theater)}
                      className="rounded-md border border-fuchsia-300/40 bg-fuchsia-400/15 px-2 py-1 text-[11px] text-fuchsia-100 hover:bg-fuchsia-400/25"
                      title={`${theater}をお気に入りから外す`}
                    >
                      {theater} ×
                    </button>
                  ))}
                  {favoriteTheaters.length === 0 && (
                    <span className="py-1 text-[10px] text-gray-600">選択した劇場がここに表示されます</span>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-gray-600">
                    都道府県を選び、映画.comの候補から追加してください。
                  </p>
                  <button
                    type="button"
                    onClick={saveFavoriteTheaters}
                    className="relative z-10 shrink-0 cursor-pointer rounded-md border border-fuchsia-300/30 bg-fuchsia-400/10 px-2.5 py-1.5 text-[11px] text-fuchsia-100 hover:bg-fuchsia-400/20"
                  >
                    保存
                  </button>
                </div>
                {favoriteTheatersSaved && (
                  <p className="mt-1 text-[10px] text-emerald-300" role="status" aria-live="polite">
                    お気に入り劇場を保存しました（{favoriteTheaters.length}件）
                  </p>
                )}
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold text-gray-500">
                  作品区分
                </div>
                <div className="flex flex-wrap gap-1">
                  {MOVIE_TYPES.map((itemType) => (
                    <button
                      key={itemType}
                      type="button"
                      onClick={() => toggleMovieType(itemType)}
                      className={`rounded-md border px-2 py-1 text-[11px] ${
                        movieTypes.includes(itemType)
                          ? "border-fuchsia-300/50 bg-fuchsia-400/15 text-fuchsia-100"
                          : "border-white/8 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {itemType}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold text-gray-500">
                  ジャンル
                </div>
                <div className="flex flex-wrap gap-1">
                  {movieGenresAvailable.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleMovieGenre(genre)}
                      className={`rounded-md border px-2 py-1 text-[11px] ${
                        movieGenres.includes(genre)
                          ? "border-fuchsia-300/50 bg-fuchsia-400/15 text-fuchsia-100"
                          : "border-white/8 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
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
          )}
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
        <>
          <div className="gap-3 [column-fill:_balance] columns-1 sm:columns-2 xl:columns-3">
            {visibleItems.map((item) => (
              <div key={item.id} className="mb-3 break-inside-avoid">
                <TopicCard item={item} favoriteTheaters={favoriteTheaters} />
              </div>
            ))}
          </div>
          {domain === "movie" && visibleItems.length < filtered.length && (
            <div className="mt-1 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVisibleMovieCount((current) => Math.min(current + MOVIE_INITIAL_VISIBLE_CARDS, filtered.length))}
                className="rounded-md border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-1.5 text-xs text-fuchsia-100 hover:bg-fuchsia-400/20"
              >
                さらに{Math.min(MOVIE_INITIAL_VISIBLE_CARDS, filtered.length - visibleItems.length)}件表示
              </button>
              <span className="text-[10px] text-gray-600">
                {visibleItems.length}件表示 / 全{filtered.length}件
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
