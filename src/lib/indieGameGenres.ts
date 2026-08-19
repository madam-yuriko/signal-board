import type { TopicBoard } from "@/types/topics";

export const INDIE_GAME_GENRES = [
  "アクション",
  "メトロイドヴァニア",
  "ローグライク",
  "ローグライト",
  "ヴァンサバライク",
  "ウィズライク",
  "ソウルライク",
  "ホラー",
  "ノベル",
  "プラットフォームアクション",
  "デッキ構築",
  "タワーディフェンス",
  "ボスラッシュ",
  "放置系",
  "ADV",
  "パズル",
  "クラフト",
  "シミュレーション",
  "ストラテジー",
  "シューティング",
  "RPG",
  "アクションRPG",
  "その他",
] as const;

export type IndieGameGenre = typeof INDIE_GAME_GENRES[number];

const GENRE_RULES: Array<[IndieGameGenre, RegExp]> = [
  ["アクション", /アクション|action/i],
  ["メトロイドヴァニア", /メトロイドヴァニア|metroidvania/i],
  ["ローグライク", /ローグライク|roguelike|rogue[- ]like/i],
  ["ローグライト", /ローグライト|roguelite/i],
  ["ヴァンサバライク", /ヴァンサバ[」』”"']?\s*(?:ライク|風|系)|ヴァンパイアサバイバーズ[」』”"']?\s*(?:ライク|風|系)|vampire survivors?[」』”"']?\s*(?:[- ]like|風|系)|survivors?[- ]like/i],
  ["ウィズライク", /ウィズライク|ウィザードリィライク|wizardry(?:[- ]like|ライク)|wiz(?:[- ]like|ライク)/i],
  ["ソウルライク", /ソウルライク|soulslike|souls[- ]like/i],
  ["ホラー", /ホラー|horror/i],
  ["ノベル", /ビジュアルノベル|ノベル|visual novel/i],
  ["プラットフォームアクション", /プラットフォーマー|platformer|platform action/i],
  ["デッキ構築", /デッキ構築|deck[- ]?builder|deckbuilding/i],
  ["タワーディフェンス", /タワー[・ ]?ディフェンス|tower[- ]?defen[cs]e|tdゲーム/i],
  ["ボスラッシュ", /ボス[・ ]?ラッシュ|boss[- ]?rush/i],
  ["放置系", /放置系|放置ゲーム|放置型|idle[- ]?(?:game|rpg)|incremental/i],
  ["ADV", /(?:^|[\s・/])adv(?:$|[\s・/])|アドベンチャー|adventure/i],
  ["パズル", /パズル|puzzle/i],
  ["クラフト", /クラフト|crafting|craft/i],
  ["シミュレーション", /シミュレーション|simulation|management|農場|生活/i],
  ["ストラテジー", /ストラテジー|strategy|戦略/i],
  ["シューティング", /シューティング|shooter|shooting|弾幕/i],
  ["RPG", /rpg|ロールプレイング|role[- ]?playing/i],
  ["アクションRPG", /アクションRPG|action[- ]?rpg/i],
];

const TITLE_OVERRIDES: Array<[RegExp, IndieGameGenre[]]> = [
  [/balatro/i, ["ローグライト", "デッキ構築"]],
  [/hades/i, ["ローグライト", "アクションRPG"]],
  [/slay the spire/i, ["ローグライト", "デッキ構築"]],
  [/stardew valley/i, ["シミュレーション", "クラフト"]],
  [/noita/i, ["ローグライト"]],
  [/sea of stars/i, ["アクションRPG"]],
  [/constance/i, ["メトロイドヴァニア"]],
];

const GENRE_ALIASES: Record<string, IndieGameGenre> = {
  アクション: "アクション",
  ローグライク: "ローグライク",
  ローグライト: "ローグライト",
  "デッキビルダー": "デッキ構築",
  デッキ構築: "デッキ構築",
  サバイバルホラー: "ホラー",
  RPG: "RPG",
  ロールプレイング: "RPG",
  アクションRPG: "アクションRPG",
};

function normalizeGenre(value: string): IndieGameGenre | undefined {
  if (INDIE_GAME_GENRES.includes(value as IndieGameGenre)) {
    return value as IndieGameGenre;
  }
  return GENRE_ALIASES[value];
}

const EXCLUSIVE_ACTION_GENRES: IndieGameGenre[] = [
  "メトロイドヴァニア",
  "プラットフォームアクション",
  "アクションRPG",
  "アクション",
];

function resolveGenreConflicts(genres: IndieGameGenre[]): IndieGameGenre[] {
  const primaryActionGenre = EXCLUSIVE_ACTION_GENRES.find((genre) => genres.includes(genre));
  if (!primaryActionGenre) return genres;
  const excluded = EXCLUSIVE_ACTION_GENRES.filter((genre) => genre !== primaryActionGenre);
  return genres.filter((genre) =>
    !excluded.includes(genre) && !(primaryActionGenre === "メトロイドヴァニア" && genre === "ADV"),
  );
}

function detectedIndieGameGenres(value: string, title = ""): IndieGameGenre[] {
  const searchable = value.normalize("NFKC");
  const override = TITLE_OVERRIDES.find(([pattern]) => pattern.test(title));
  const detected = GENRE_RULES
    .filter(([, pattern]) => pattern.test(searchable))
    .map(([genre]) => genre);
  const overrideGenres = override?.[1] ?? [];
  const genres = [...new Set([...detected, ...overrideGenres])]
    .filter((genre) => genre !== "その他");
  const hasRoguelike = genres.includes("ローグライク");
  const hasRoguelite = genres.includes("ローグライト");
  if (!hasRoguelike || !hasRoguelite) return resolveGenreConflicts(genres);

  const overrideRogueGenre = overrideGenres.find(
    (genre) => genre === "ローグライク" || genre === "ローグライト",
  );
  const roguelikeIndex = searchable.search(/ローグライク|roguelike|rogue[- ]like/i);
  const rogueliteIndex = searchable.search(/ローグライト|roguelite/i);
  const preferred = overrideRogueGenre ??
    (roguelikeIndex >= 0 && (rogueliteIndex < 0 || roguelikeIndex < rogueliteIndex)
      ? "ローグライク"
      : "ローグライト");
  const rejected = preferred === "ローグライク" ? "ローグライト" : "ローグライク";
  return resolveGenreConflicts(genres.filter((genre) => genre !== rejected));
}

export function indieGameGenresFromText(value: string, title = ""): IndieGameGenre[] {
  const genres = detectedIndieGameGenres(value, title);
  return genres.length > 0 ? genres : ["その他"];
}

export function indieGameGenresFor(item: TopicBoard): IndieGameGenre[] {
  const searchable = [
    item.title,
    item.category,
    item.summary,
    ...item.tags,
    ...(item.genres ?? []),
    ...item.metrics.flatMap((metric) => [metric.label, metric.value]),
  ].join(" ").normalize("NFKC");
  const detected = detectedIndieGameGenres(searchable, item.title);
  const explicit = (item.genres ?? [])
    .map(normalizeGenre)
    .filter((genre): genre is IndieGameGenre => Boolean(genre));
  const explicitRogueGenre = explicit.find(
    (genre) => genre === "ローグライク" || genre === "ローグライト",
  );
  const genres = [...new Set([...explicit, ...detected])]
    .filter((genre) => !explicitRogueGenre ||
      genre === explicitRogueGenre ||
      genre !== (explicitRogueGenre === "ローグライク" ? "ローグライト" : "ローグライク"));
  const ordered = INDIE_GAME_GENRES.filter((genre) => resolveGenreConflicts(genres).includes(genre));
  return ordered.length > 0 ? ordered : ["その他"];
}
