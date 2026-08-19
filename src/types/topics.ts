export type TopicDomain =
  | "hardware"
  | "redevelopment"
  | "movie"
  | "indie-game"
  | "disaster";

export type MovieType = "邦画" | "洋画" | "アニメ/CG";

export type TopicStatusTone = "neutral" | "info" | "warning" | "danger" | "success";

export interface TopicMetric {
  label: string;
  value: string;
}

export interface TopicPrice {
  platform: string;
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
  /** Normalized genre tags. A title may belong to more than one genre. */
  genres?: string[];
  /** Normalized platform tags used by the indie-game platform filter. */
  platforms?: string[];
  /** Platform-specific prices extracted from the source article. */
  prices?: TopicPrice[];
  /** Primary release date used for the indie-game card date and release-window filter. */
  releaseDate?: string;
  /** Article update date shown alongside the primary release date. */
  articleUpdatedLabel?: string;
  /** Platform whose release date was selected for the indie-game card. */
  releasePlatform?: string;
}
