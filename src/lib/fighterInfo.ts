import { champions } from "@/data/champions";

export interface FighterInfo {
  gym?: string;
  country?: string;
}

const COUNTRY_ALIASES: Record<string, string> = {
  "日本": "日本",
  "日": "日本",
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
  "インド": "インド",
  "キルギス": "キルギス",
  "キルギスタン": "キルギス",
  "ミャンマー": "ミャンマー",
  "コスタリカ": "コスタリカ",
  "モンゴル": "モンゴル",
  "ベネズエラ": "ベネズエラ",
  "パナマ": "パナマ",
  "コロンビア": "コロンビア",
  "エクアドル": "エクアドル",
  "ペルー": "ペルー",
  "チリ": "チリ",
  "ガーナ": "ガーナ",
  "ケニア": "ケニア",
  "タンザニア": "タンザニア",
  "ウガンダ": "ウガンダ",
  "ナイジェリア": "ナイジェリア",
  "南スーダン": "南スーダン",
  "バングラデシュ": "バングラデシュ",
  "ネパール": "ネパール",
  "スリランカ": "スリランカ",
  "パキスタン": "パキスタン",
  "カンボジア": "カンボジア",
  "ベトナム": "ベトナム",
  "ラオス": "ラオス",
  "マレーシア": "マレーシア",
  "シンガポール": "シンガポール",
  "ドミニカ": "ドミニカ共和国",
  "ドミニカ共和国": "ドミニカ共和国",
};

export function normalizeFighterName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** 「未定」やプレースホルダーは、選手別一覧への切り替え対象にしない。 */
export function isSelectableFighter(name: string): boolean {
  return Boolean(name) && name !== "未定" && !name.startsWith("__");
}

export function sameFighterName(left: string, right: string): boolean {
  const a = normalizeFighterName(left);
  const b = normalizeFighterName(right);
  return a.length > 0 && a === b;
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
  // ボクモバの括弧内は国内選手ならジム、海外選手なら国・地域が入る。
  // 過去に国名辞書へ無かった値が gym として保存されていても、表示時に再判定する。
  const affiliation = explicit.country
    ? { gym: explicit.gym }
    : infoFromAffiliation(explicit.gym);
  return {
    gym: affiliation.gym ?? known?.gym,
    country:
      normalizeCountry(explicit.country) ?? affiliation.country ?? known?.country,
  };
}

export function fighterAnnotation(
  name: string,
  explicit: FighterInfo = {},
): string | undefined {
  const info = fighterInfo(name, explicit);
  return info.gym ?? info.country;
}
