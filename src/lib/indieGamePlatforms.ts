import type { TopicBoard } from "@/types/topics";

export const INDIE_GAME_PLATFORMS = [
  "Steam",
  "PS",
  "Switch",
  "XBOX",
  "その他",
] as const;

export type IndieGamePlatform = typeof INDIE_GAME_PLATFORMS[number];

const PLATFORM_RULES: Array<[IndieGamePlatform, RegExp]> = [
  ["Steam", /steam|pc\b|windows|mac(?:os)?|linux/i],
  ["PS", /playstation|プレイステーション|\bPS(?:4|5)?\b/i],
  ["Switch", /nintendo\s+switch|switch\s*2|ニンテンドー(?:スイッチ|Switch)/i],
  ["XBOX", /xbox|XBOX/i],
];

export function indieGamePlatformsFor(item: TopicBoard): IndieGamePlatform[] {
  const searchable = [
    item.location,
    item.summary,
    ...item.tags,
    ...(item.platforms ?? []),
    ...item.metrics.flatMap((metric) => [metric.label, metric.value]),
  ].join(" ").normalize("NFKC");
  const detected = PLATFORM_RULES
    .filter(([, pattern]) => pattern.test(searchable))
    .map(([platform]) => platform);
  const ordered = INDIE_GAME_PLATFORMS.filter((platform) => detected.includes(platform));
  return ordered.length > 0 ? ordered : ["その他"];
}
