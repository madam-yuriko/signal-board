// 主要4団体
export type Organization = "WBA" | "WBC" | "IBF" | "WBO";

export const ORGANIZATIONS: Organization[] = ["WBA", "WBC", "IBF", "WBO"];

/** その試合に懸かるタイトル。複数王座の同時開催にも対応する。 */
export type BoutTitle =
  | { kind: "world"; organization: Organization }
  | { kind: "wbo-ap" }
  | { kind: "opbf" }
  | { kind: "japan" }
  | { kind: "japan-youth" }
  | { kind: "regional"; label: string }
  | { kind: "non-title" };

// 日本側選手から見た結果。scheduled = 試合予定、no-contest = 無効試合、cancelled = 中止
export type BoutResult =
  | "win"
  | "loss"
  | "draw"
  | "scheduled"
  | "no-contest"
  | "cancelled";

// 1試合（カード）
export interface Bout {
  id: string;
  /** 日本ジム所属選手 */
  jpFighter: string;
  /** 日本側選手の所属ジム（取得できる場合） */
  jpFighterGym?: string;
  /** 左側選手の国・地域（海外カードなどで取得できる場合） */
  jpFighterCountry?: string;
  /** 日本側選手の戦績（任意） */
  jpRecord?: string;
  /** 対戦相手 */
  opponent: string;
  /** 対戦相手の国・地域（任意） */
  opponentCountry?: string;
  /** 対戦相手が日本人の場合の所属ジム（取得できる場合） */
  opponentGym?: string;
  /** 階級 */
  weightClass: string;
  /** 懸かるタイトルの団体 */
  organizations: Organization[];
  /** 世界・地域・国内を区別したタイトル区分 */
  titles?: BoutTitle[];
  /** 日本側選手から見た結果 */
  result: BoutResult;
  /** 決着方法（例: "判定 3-0", "TKO 8R", "KO 2R"） */
  method?: string;
  /** メインイベントか */
  isMainEvent?: boolean;
  /** 王者の防衛/挑戦などの補足 */
  notes?: string;
}

// 興行（大会）
export interface BoxingEvent {
  id: string;
  /** 開催日 yyyy-mm-dd */
  date: string;
  /** 開始時刻 HH:mm（任意） */
  startTime?: string;
  /** Source-defined event status; falls back to the date when omitted. */
  status?: "scheduled" | "finished";
  /** 興行名 */
  name: string;
  /**
   * 興行名の確度。JBCのプロモーター情報から推測した場合は inferred。
   * 公式名称を取得できた場合は official。
   */
  nameStatus?: "official" | "inferred";
  /** Event series / promotion name used for grouping and filtering. */
  series?: string;
  /** 会場 */
  venue: string;
  /** 都市・地域 */
  city: string;
  /** 国内開催か（false = 海外） */
  domestic: boolean;
  /** 放送・配信（任意） */
  broadcaster?: string;
  /** 代表画像 URL（任意。未指定時は lib/eventImage が自動で割り当てる） */
  image?: string;
  /** Source name. */
  sourceName?: string;
  /** Source page URL. */
  sourceUrl?: string;
  /** Official bout card or results document URL. */
  detailsUrl?: string;
  /** Boxing Mobile event ID when a historical event needs an explicit match. */
  boxmobSid?: string;
  /** Source update timestamp in ISO 8601 format. */
  sourceUpdatedAt?: string;

  /** カード一覧 */
  bouts: Bout[];
}

// 現役日本人世界王者
export interface Champion {
  name: string;
  weightClass: string;
  organizations: Organization[];
  gym: string;
  gender: "male" | "female";
}
