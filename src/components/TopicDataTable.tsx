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

export function movieRating(item: TopicBoard): number | undefined {
  const value = topicMetric(item, "レビュー") ?? topicMetric(item, "視聴評価");
  const rating = value?.match(/\d+(?:\.\d+)?/)?.[0];
  return rating === undefined ? undefined : Number.parseFloat(rating);
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
      id: "rating",
      label: "評価",
      render: (item) => {
        const rating = movieRating(item);
        return rating === undefined ? (
          <span className="text-gray-600">—</span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-amber-300">
            <Star className="h-3 w-3 fill-amber-300" />
            {rating.toFixed(1)}
          </span>
        );
      },
      sortValue: movieRating,
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
  const defaultSort = domain === "movie" && view === "rating"
    ? { columnId: "rating", direction: "desc" as const }
    : undefined;
  return (
    <DataTable
      key={`${domain}-${view}`}
      rows={rows}
      columns={columns}
      rowKey={(item) => item.id}
      defaultSort={defaultSort}
      emptyMessage={view === "actor" ? "この俳優の出演作は、現在の条件では見つかりません。" : undefined}
    />
  );
}
