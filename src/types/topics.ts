export type TopicDomain = "hardware" | "redevelopment" | "movie" | "disaster";

export type MovieType = "邦画" | "洋画" | "アニメ/CG";

export type TopicStatusTone = "neutral" | "info" | "warning" | "danger" | "success";

export interface TopicMetric {
  label: string;
  value: string;
}

export interface TopicUpdate {
  at: string;
  text: string;
}

export interface TopicBoard {
  id: string;
  domain: TopicDomain;
  title: string;
  category: string;
  status: string;
  statusLabel: string;
  statusTone: TopicStatusTone;
  dateLabel: string;
  location: string;
  region: string;
  summary: string;
  image: string;
  metrics: TopicMetric[];
  updates: TopicUpdate[];
  tags: string[];
  /** Canonical source page, used by domain-specific live details. */
  sourceUrl?: string;
  /** Movie-only first-level classification used by the movie tag filter. */
  movieType?: MovieType;
  /** Movie-only genre tags. A film may belong to more than one genre. */
  genres?: string[];
}
