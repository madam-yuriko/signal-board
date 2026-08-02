export type TopicDomain = "hardware" | "redevelopment" | "movie" | "disaster";

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
}
