import { champions } from "@/data/champions";

export interface FighterInfo {
  gym?: string;
  country?: string;
}

const COUNTRY_ALIASES: Record<string, string> = {
  "豪": "オーストラリア",
  "豪州": "オーストラリア",
  "オーストラリア": "オーストラリア",
  "米": "米国",
  "米国": "米国",
  "アメリカ": "米国",
  "USA": "米国",
  "U.S.A.": "米国",
  "比": "フィリピン",
  "フィリピン": "フィリピン",
  "泰": "タイ",
  "南ア": "南アフリカ",
  "南アフリカ": "南アフリカ",
  "メキシコ": "メキシコ",
  "メ": "メキシコ",
  "墨": "メキシコ",
  "タイ": "タイ",
  "韓": "韓国",
  "韓国": "韓国",
  "中": "中国",
  "中国": "中国",
  "プエルトリコ": "プエルトリコ",
  "ウズベキスタン": "ウズベキスタン",
  "ニカラグア": "ニカラグア",
  "アルゼンチン": "アルゼンチン",
  "亜": "アルゼンチン",
  "ドミニカ共": "ドミニカ共和国",
  "英国": "英国",
  "イギリス": "英国",
  "英": "英国",
  "フランス": "フランス",
  "仏": "フランス",
  "ロシア": "ロシア",
  "露": "ロシア",
  "カザフスタン": "カザフスタン",
  "スペイン": "スペイン",
  "西": "スペイン",
  "ブラジル": "ブラジル",
  "伯": "ブラジル",
  "カナダ": "カナダ",
  "加": "カナダ",
  "インドネシア": "インドネシア",
  "尼": "インドネシア",
  "ドミニカ": "ドミニカ共和国",
  "ドミニカ共和国": "ドミニカ共和国",
};

function normalizeFighterName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const KNOWN_FIGHTER_INFO = new Map<string, FighterInfo>(
  champions.map((champion) => [
    normalizeFighterName(champion.name),
    { gym: champion.gym },
  ]),
);

export function normalizeCountry(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.normalize("NFKC").replace(/[\s・･]/g, "");
  const fallback = value.trim();
  return COUNTRY_ALIASES[normalized] ?? (fallback || undefined);
}

export function infoFromAffiliation(value?: string): FighterInfo {
  if (!value) return {};
  const country = COUNTRY_ALIASES[value.normalize("NFKC").replace(/[\s・･]/g, "")];
  return country ? { country } : { gym: value.trim() || undefined };
}

export function fighterInfo(
  name: string,
  explicit: FighterInfo = {},
): FighterInfo {
  const known = KNOWN_FIGHTER_INFO.get(normalizeFighterName(name));
  return {
    gym: explicit.gym ?? known?.gym,
    country: explicit.country ?? known?.country,
  };
}

export function fighterAnnotation(
  name: string,
  explicit: FighterInfo = {},
): string | undefined {
  const info = fighterInfo(name, explicit);
  return info.gym ?? info.country;
}
