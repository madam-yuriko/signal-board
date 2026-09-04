"use client";

import { ExternalLink, Star } from "lucide-react";
import type { TopicBoard, TopicDomain } from "@/types/topics";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import { indieGameGenresFor } from "@/lib/indieGameGenres";

export type TopicTableView = "standard" | "rating" | "actor";

export function topicMetric(item: TopicBoard, label: string): string | undefined {
  return item.metrics.find((metric) => metric.label === label)?.value;
}

export function movieCast(item: TopicBoard): string[] {
  const value = topicMetric(item, "メインキャスト");
  if (!value || value === "掲載なし") return [];
  return value
    .split(/[\n、,／/]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function ratingFromValue(value: string | undefined): number | undefined {
  const rating = value?.match(/([0-5](?:\.\d+)?)\s*\/\s*5/)?.[1] ?? value?.match(/^[0-5](?:\.\d+)?/)?.[0];
  return rating === undefined ? undefined : Number.parseFloat(rating);
}

interface MovieSourceReview {
  rating?: number;
  count?: number;
  href?: string;
}

function movieSourceReview(item: TopicBoard, source: "映画.com" | "Filmarks"): MovieSourceReview {
  const reviewMetric = item.metrics.find((metric) => metric.label === "レビュー");
  const reviewLine = reviewMetric?.lines?.find((line) => line.label === source);
  const legacyLabel = source === "映画.com" ? "映画.comレビュー" : "Filmarksレビュー";
  const legacyMetric = item.metrics.find((metric) => metric.label === legacyLabel);
  const value = reviewLine?.value ?? legacyMetric?.value;
  const countValue = value?.match(/\(([\d,]+)件\)/)?.[1] ?? value?.match(/([\d,]+)件/)?.[1];
  return {
    rating: ratingFromValue(value),
    count: countValue === undefined ? undefined : Number.parseInt(countValue.replace(/,/g, ""), 10),
    href: reviewLine?.href ?? legacyMetric?.href,
  };
}

function movieSourceRating(item: TopicBoard, source: "映画.com" | "Filmarks"): number | undefined {
  return movieSourceReview(item, source).rating;
}

export function movieEigaRating(item: TopicBoard): number | undefined {
  return movieSourceRating(item, "映画.com");
}

export function movieFilmarksRating(item: TopicBoard): number | undefined {
  return movieSourceRating(item, "Filmarks");
}

export function movieRating(item: TopicBoard): number | undefined {
  const ratings = [movieEigaRating(item), movieFilmarksRating(item)].filter(
    (rating): rating is number => rating !== undefined,
  );
  return ratings.length > 0 ? ratings.reduce((total, rating) => total + rating, 0) : undefined;
}

function movieReleaseTimestamp(item: TopicBoard): number | undefined {
  const value = topicMetric(item, "公開日") ?? item.dateLabel;
  const date = value?.match(/(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})日?/);
  if (!date) return undefined;
  return Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]));
}

function compareMovieRatings(left: TopicBoard, right: TopicBoard): number {
  const leftRating = movieRating(left);
  const rightRating = movieRating(right);
  if (leftRating === undefined && rightRating !== undefined) return 1;
  if (leftRating !== undefined && rightRating === undefined) return -1;
  if (leftRating !== undefined && rightRating !== undefined && leftRating !== rightRating) {
    return rightRating - leftRating;
  }

  const leftDate = movieReleaseTimestamp(left);
  const rightDate = movieReleaseTimestamp(right);
  if (leftDate === undefined && rightDate === undefined) return 0;
  if (leftDate === undefined) return 1;
  if (rightDate === undefined) return -1;
  return rightDate - leftDate;
}

function movieReviewCell(item: TopicBoard, source: "映画.com" | "Filmarks"): React.ReactNode {
  const review = movieSourceReview(item, source);
  if (review.rating === undefined && review.count === undefined) {
    return <span className="text-gray-600">—</span>;
  }

  const content = (
    <>
      {review.rating === undefined ? (
        <span className="text-gray-600">—</span>
      ) : (
        <>
          <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
          <span className="font-semibold text-amber-300">{review.rating.toFixed(1)}</span>
        </>
      )}
      {review.count !== undefined && (
        <span className="text-[10px] text-gray-500">({review.count.toLocaleString("ja-JP")}件)</span>
      )}
    </>
  );
  return review.href ? (
    <a
      href={review.href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums hover:text-cyan-200 hover:underline"
    >
      {content}
    </a>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
      {content}
    </span>
  );
}

function metricSummary(item: TopicBoard): React.ReactNode {
  return (
    <div className="space-y-0.5 text-[11px] leading-relaxed">
      {item.metrics.slice(0, 3).map((metric) => (
        <div key={metric.label} className="flex gap-1.5">
          <span className="shrink-0 text-gray-600">{metric.label}</span>
          <span className="whitespace-pre-line text-gray-300">{metric.value}</span>
        </div>
      ))}
    </div>
  );
}

function statusCell(item: TopicBoard) {
  const toneClass =
    item.statusTone === "danger"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : item.statusTone === "warning"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
        : item.statusTone === "success"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : item.statusTone === "info"
            ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
            : "border-white/15 bg-white/5 text-gray-300";
  return (
    <span className={`inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] ${toneClass}`}>
      {item.statusLabel}
    </span>
  );
}

function titleCell(item: TopicBoard) {
  if (!item.sourceUrl) return item.title;
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-start gap-1 hover:text-sky-200"
    >
      <span>{item.title}</span>
      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-gray-600" />
    </a>
  );
}

function movieColumns(): DataTableColumn<TopicBoard>[] {
  return [
    {
      id: "title",
      label: "作品",
      render: titleCell,
      sortValue: (item) => item.title,
      primary: true,
      className: "min-w-44",
    },
    {
      id: "eiga-rating",
      label: "映画.com評価",
      render: (item) => movieReviewCell(item, "映画.com"),
      sortValue: movieEigaRating,
      align: "right",
    },
    {
      id: "filmarks-rating",
      label: "Filmarks評価",
      render: (item) => movieReviewCell(item, "Filmarks"),
      sortValue: movieFilmarksRating,
      align: "right",
    },
    {
      id: "status",
      label: "状態",
      render: statusCell,
      sortValue: (item) => item.statusLabel,
    },
    {
      id: "date",
      label: "公開日",
      render: (item) => item.dateLabel,
      sortValue: (item) => item.dateLabel,
      className: "whitespace-nowrap",
    },
    {
      id: "type",
      label: "区分",
      render: (item) => item.movieType ?? item.category,
      sortValue: (item) => item.movieType ?? item.category,
      hideOnMobile: true,
    },
    {
      id: "genres",
      label: "ジャンル",
      render: (item) => (
        <div className="flex max-w-52 flex-wrap gap-1">
          {(item.genres ?? [item.category]).map((genre) => (
            <span key={genre} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
              {genre}
            </span>
          ))}
        </div>
      ),
      sortValue: (item) => (item.genres ?? [item.category]).join(" "),
      hideOnMobile: true,
    },
    {
      id: "director",
      label: "監督",
      render: (item) => topicMetric(item, "監督") ?? "—",
      sortValue: (item) => topicMetric(item, "監督"),
      hideOnMobile: true,
    },
    {
      id: "cast",
      label: "メインキャスト",
      render: (item) => {
        const cast = movieCast(item);
        return cast.length > 0 ? (
          <span className="whitespace-pre-line leading-relaxed">{cast.join("\n")}</span>
        ) : (
          <span className="text-gray-600">—</span>
        );
      },
      sortValue: (item) => movieCast(item).join(" "),
      hideOnMobile: true,
      className: "min-w-32",
    },
  ];
}

function standardColumns(domain: TopicDomain): DataTableColumn<TopicBoard>[] {
  const labels: Record<Exclude<TopicDomain, "movie">, { title: string; category: string; region: string; date: string }> = {
    hardware: { title: "製品・情報", category: "種類", region: "メーカー", date: "日付" },
    redevelopment: { title: "再開発案件", category: "種類", region: "地域", date: "予定" },
    "indie-game": { title: "ゲーム", category: "ゲームジャンル", region: "情報源", date: "発売日" },
    disaster: { title: "災害事象", category: "種類", region: "地域", date: "最終更新" },
  };
  const domainLabels = labels[domain as Exclude<TopicDomain, "movie">];
  const columns: DataTableColumn<TopicBoard>[] = [
    {
      id: "title",
      label: domainLabels.title,
      render: titleCell,
      sortValue: (item) => item.title,
      primary: true,
      className: "min-w-48",
    },
    ...(domain === "indie-game" ? [] : [{
      id: "status",
      label: "状態",
      render: statusCell,
      sortValue: (item) => item.statusLabel,
    } satisfies DataTableColumn<TopicBoard>]),
    {
      id: "category",
      label: domainLabels.category,
      render: (item) => domain === "indie-game"
        ? indieGameGenresFor(item).join("・")
        : item.category,
      sortValue: (item) => domain === "indie-game"
        ? indieGameGenresFor(item).join(" ")
        : item.category,
    },
    {
      id: "region",
      label: domainLabels.region,
      render: (item) => item.region,
      sortValue: (item) => item.region,
    },
    {
      id: "date",
      label: domainLabels.date,
      render: (item) => domain === "indie-game" ? (
        <div>
          <div>{item.dateLabel}</div>
          {item.articleUpdatedLabel && <div className="text-[10px] text-gray-500">{item.articleUpdatedLabel}</div>}
        </div>
      ) : item.dateLabel,
      sortValue: (item) => item.releaseDate ?? item.dateLabel,
      className: "whitespace-nowrap",
    },
    {
      id: "location",
      label: "場所・対象",
      render: (item) => item.location,
      sortValue: (item) => item.location,
      hideOnMobile: true,
    },
    {
      id: "metrics",
      label: "主な情報",
      render: metricSummary,
      hideOnMobile: true,
      className: "min-w-52",
    },
  ];
  return columns;
}

export default function TopicDataTable({
  domain,
  rows,
  view,
}: {
  domain: TopicDomain;
  rows: TopicBoard[];
  view: TopicTableView;
}) {
  const columns = domain === "movie" ? movieColumns() : standardColumns(domain);
  const defaultSort = domain === "movie"
    ? { columnId: "movie-rating-total", direction: "desc" as const }
    : undefined;
  return (
    <DataTable
      key={`${domain}-${view}`}
      rows={rows}
      columns={columns}
      rowKey={(item) => item.id}
      defaultSort={defaultSort}
      defaultCompareRows={domain === "movie" ? compareMovieRatings : undefined}
      emptyMessage={view === "actor" ? "この俳優の出演作は、現在の条件では見つかりません。" : undefined}
    />
  );
}
