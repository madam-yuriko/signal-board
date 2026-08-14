// 主要4団体
export type Organization = "WBA" | "WBC" | "IBF" | "WBO";

export const ORGANIZATIONS: Organization[] = ["WBA", "WBC", "IBF", "WBO"];

// 日本側選手から見た結果。scheduled = 試合予定（未開催）
export type BoutResult = "win" | "loss" | "draw" | "scheduled";

// 1試合（カード）
export interface Bout {
  id: string;
  /** 日本ジム所属選手 */
  jpFighter: string;
  /** 日本側選手の戦績（任意） */
  jpRecord?: string;
  /** 対戦相手 */
  opponent: string;
  /** 対戦相手の国・地域（任意） */
  opponentCountry?: string;
  /** 階級 */
  weightClass: string;
  /** 懸かるタイトルの団体 */
  organizations: Organization[];
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
