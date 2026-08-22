import type { BoxingEvent } from "@/types";

type MajorEvent = Omit<BoxingEvent, "status" | "bouts"> & {
  bouts?: BoxingEvent["bouts"];
};

const PRIME_HISTORY =
  "https://www.aboutamazon.jp/news/entertainment/prime-video-boxing-14";
const LEMINO_HISTORY =
  "https://lemino.docomo.ne.jp/leminonews/articles/naoya-inoue-archived-broadcast";
const UNEXT_HISTORY =
  "https://www.unext.co.jp/ja/press-room/unext-boxing-2-2024-01-27";
const DYNAMIC_GLOVE_HISTORY = "https://dynamicglove.com/";
const FIGHT_3150_HISTORY = "https://www.3150fight.com/result/";
const TREASURE_HISTORY = "https://tb-promotion.com/archives/";
const LIFETIME_HISTORY = "https://www.lifetime-boxing-fights.tdc.ne.jp/";

function event(
  id: string,
  date: string,
  name: string,
  series: string,
  venue: string,
  city: string,
  sourceName: string,
  sourceUrl: string,
  domestic = true,
  boxmobSid?: string,
  startTime?: string,
): MajorEvent {
  return {
    id: `major-${id}`,
    date,
    name,
    series,
    venue,
    city,
    domestic,
    sourceName,
    sourceUrl,
    ...(boxmobSid ? { boxmobSid } : {}),
    ...(startTime ? { startTime } : {}),
  };
}

/**
 * 配信・主催各社の公式履歴で確認できた主要興行。
 * JBCに同日・同会場のデータがあれば、boxingFeed側で結果URLなどを重ねる。
 */
export const majorBoxingEvents: MajorEvent[] = [
  // Prime Video Boxing（公式の「Prime Video Boxingの歴史」＋個別発表）
  event("prime-01", "2022-04-09", "Prime Video Presents Live Boxing 1", "Prime Video Boxing", "さいたまスーパーアリーナ", "埼玉", "Prime Video", PRIME_HISTORY, true, "6262"),
  event("prime-02", "2022-06-07", "Prime Video Presents Live Boxing 2", "Prime Video Boxing", "さいたまスーパーアリーナ", "埼玉", "Prime Video", PRIME_HISTORY),
  event("prime-03", "2022-11-01", "Prime Video Presents Live Boxing 3", "Prime Video Boxing", "さいたまスーパーアリーナ", "埼玉", "Prime Video", PRIME_HISTORY),
  event("prime-04", "2023-04-08", "Prime Video Presents Live Boxing 4", "Prime Video Boxing", "有明アリーナ", "東京", "Prime Video", PRIME_HISTORY),
  event("prime-05", "2023-09-18", "Prime Video Presents Live Boxing 5", "Prime Video Boxing", "有明アリーナ", "東京", "Prime Video", PRIME_HISTORY),
  event("prime-06", "2024-01-23", "Prime Video Presents Live Boxing 6", "Prime Video Boxing", "エディオンアリーナ大阪", "大阪", "Prime Video", PRIME_HISTORY),
  event("prime-07", "2024-02-24", "Prime Video Presents Live Boxing 7", "Prime Video Boxing", "両国国技館", "東京", "Prime Video", PRIME_HISTORY),
  event("prime-08", "2024-05-06", "Prime Video Presents Live Boxing 8", "Prime Video Boxing", "東京ドーム", "東京", "Prime Video", PRIME_HISTORY),
  event("prime-09", "2024-07-20", "Prime Video Presents Live Boxing 9", "Prime Video Boxing", "両国国技館", "東京", "Prime Video", PRIME_HISTORY),
  event("prime-10-1", "2024-10-13", "Prime Video Boxing 10 DAY 1", "Prime Video Boxing", "有明アリーナ", "東京", "Prime Video", PRIME_HISTORY),
  event("prime-10-2", "2024-10-14", "Prime Video Boxing 10 DAY 2", "Prime Video Boxing", "有明アリーナ", "東京", "Prime Video", PRIME_HISTORY),
  event("prime-11", "2025-02-24", "Prime Video Boxing 11", "Prime Video Boxing", "有明アリーナ", "東京", "Prime Video", PRIME_HISTORY, true, "7429"),
  event("prime-12", "2025-05-04", "Prime Video Boxing 12 in Las Vegas", "Prime Video Boxing", "T-モバイル・アリーナ", "ラスベガス", "Prime Video", PRIME_HISTORY, false),
  event("prime-13", "2025-06-08", "Prime Video Boxing 13", "Prime Video Boxing", "有明コロシアム", "東京", "Prime Video", PRIME_HISTORY),
  event("prime-14", "2025-11-24", "Prime Video Boxing 14", "Prime Video Boxing", "TOYOTA ARENA TOKYO", "東京", "Prime Video", PRIME_HISTORY),
  event("prime-15", "2026-04-11", "Prime Video Boxing 15", "Prime Video Boxing", "両国国技館", "東京", "Prime Video", "https://www.aboutamazon.jp/news/entertainment/prime-video-boxing-15"),
  event("prime-16", "2026-09-27", "Prime Video Boxing 16", "Prime Video Boxing", "TOYOTA ARENA TOKYO", "東京", "Prime Video", "https://www.aboutamazon.jp/news/entertainment/prime-boxing-16"),

  // Lemino名義の大型世界戦。PHOENIX BATTLEはJBC主催者名から別途補完する。
  event("lemino-20230725", "2023-07-25", "Lemino BOXING 井上尚弥 vs スティーブン・フルトン", "Lemino Boxing", "有明アリーナ", "東京", "Lemino", LEMINO_HISTORY),
  event("lemino-20231226", "2023-12-26", "Lemino BOXING 井上尚弥 vs マーロン・タパレス", "Lemino Boxing", "有明アリーナ", "東京", "Lemino", LEMINO_HISTORY),
  event("lemino-20240903", "2024-09-03", "Lemino BOXING ダブル世界タイトルマッチ", "Lemino Boxing", "有明アリーナ", "東京", "Lemino", LEMINO_HISTORY),
  event("lemino-20250124", "2025-01-24", "Lemino BOXING 世界タイトルマッチ", "Lemino Boxing", "有明アリーナ", "東京", "Lemino", LEMINO_HISTORY),
  event("lemino-20250619", "2025-06-19", "Lemino BOXING WBO世界ウェルター級タイトルマッチ", "Lemino Boxing", "大田区総合体育館", "東京", "Lemino", "https://lemino.docomo.ne.jp/leminonews/articles/1046705590102917122"),
  event("lemino-20250914", "2025-09-14", "Lemino BOXING トリプル世界タイトルマッチ", "Lemino Boxing", "IGアリーナ", "愛知", "Lemino", "https://lemino.docomo.ne.jp/leminonews/articles/naoya-inoue-dna-t-shirt-furusato-tax"),
  event("lemino-20260502", "2026-05-02", "Lemino BOXING ダブル世界タイトルマッチ", "Lemino Boxing", "東京ドーム", "東京", "Lemino", "https://lemino.docomo.ne.jp/leminonews/articles/0502-double-world-title-match-matchup-lineup"),
  event("lemino-20260902", "2026-09-02", "Lemino BOXING ダブル世界タイトルマッチ", "Lemino Boxing", "横浜BUNTAI", "横浜", "Lemino", "https://lemino.docomo.ne.jp/ft/0000002/"),

  // DYNAMIC GLOVE on U-NEXT（公式シリーズ／ボクシングモバイル履歴）
  event("dynamic-glove-41", "2026-03-07", "DYNAMIC GLOVE on U-NEXT 41[WBO-AP][OPBF]", "Dynamic Glove", "後楽園ホール", "東京", "U-NEXT", DYNAMIC_GLOVE_HISTORY),
  event("dynamic-glove-42", "2026-04-04", "DYNAMIC GLOVE on U-NEXT 42[WBO-AP]", "Dynamic Glove", "後楽園ホール", "東京", "U-NEXT", DYNAMIC_GLOVE_HISTORY),
  event("dynamic-glove-43", "2026-05-06", "DYNAMIC GLOVE on U-NEXT 43[WBO-AP]", "Dynamic Glove", "後楽園ホール", "東京", "U-NEXT", DYNAMIC_GLOVE_HISTORY),
  event("dynamic-glove-44", "2026-06-06", "DYNAMIC GLOVE on U-NEXT 44[WBO-AP]", "Dynamic Glove", "後楽園ホール", "東京", "U-NEXT", DYNAMIC_GLOVE_HISTORY),
  event("dynamic-glove-45", "2026-07-04", "DYNAMIC GLOVE on U-NEXT 45[OPBF]", "Dynamic Glove", "後楽園ホール", "東京", "U-NEXT", DYNAMIC_GLOVE_HISTORY),
  event("dynamic-glove-46", "2026-08-01", "DYNAMIC GLOVE on U-NEXT 46[日本][OPBF]", "Dynamic Glove", "後楽園ホール", "東京", "U-NEXT", DYNAMIC_GLOVE_HISTORY),

  // U-NEXT BOXING（番号シリーズ）
  event("unext-01", "2024-12-15", "U-NEXT BOXING", "U-NEXT Boxing", "住吉スポーツセンター", "大阪", "U-NEXT", UNEXT_HISTORY),
  event("unext-02", "2025-03-13", "U-NEXT BOXING 2", "U-NEXT Boxing", "両国国技館", "東京", "U-NEXT", UNEXT_HISTORY),
  event("unext-03", "2025-07-30", "U-NEXT BOXING.3", "U-NEXT Boxing", "横浜BUNTAI", "横浜", "U-NEXT", "https://www.unext.co.jp/ja/press-room/unext-boxing-live-2025-06-11"),
  event("unext-04", "2025-12-17", "U-NEXT BOXING.4", "U-NEXT Boxing", "両国国技館", "東京", "U-NEXT", "https://www.unext.co.jp/en/press-room/2025-12-unext-lineups"),
  event("unext-05", "2026-03-15", "U-NEXT BOXING.5", "U-NEXT Boxing", "横浜BUNTAI", "横浜", "U-NEXT", "https://www.unext.co.jp/en/press-room/2026-03-unext-lineups"),
  event("unext-06", "2026-07-20", "U-NEXT BOXING.6", "U-NEXT Boxing", "両国国技館", "東京", "U-NEXT", "https://www.video.unext.jp/po2/unext_boxing"),

  // TREASURE BOXING PROMOTION（公式イベントアーカイブ）
  event("treasure-01", "2022-12-03", "TREASURE BOXING PROMOTION 1", "Treasure-Boxing", "PARADISE CITY", "仁川", "TREASURE BOXING PROMOTION", TREASURE_HISTORY, false),
  event("treasure-02", "2023-04-15", "TREASURE BOXING PROMOTION 2", "Treasure-Boxing", "PARADISE CITY", "仁川", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/61/", false),
  event("treasure-03", "2023-05-13", "TREASURE BOXING PROMOTION 3", "Treasure-Boxing", "OKADA Manila", "マニラ", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/177/", false),
  event("treasure-04", "2023-10-12", "TREASURE BOXING PROMOTION 4", "Treasure-Boxing", "有明アリーナ", "東京", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/187/"),
  event("treasure-05", "2024-01-26", "TREASURE BOXING PROMOTION 5", "Treasure-Boxing", "NUSTAR RESORT & CASINO", "セブ", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/207/", false),
  event("treasure-06", "2024-05-11", "TREASURE BOXING PROMOTION 6", "Treasure-Boxing", "PARADISE CITY", "仁川", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/392/", false),
  event("treasure-07", "2024-10-13", "TREASURE BOXING PROMOTION 7", "Treasure-Boxing", "横浜武道館", "横浜", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/402/"),
  event("treasure-08", "2025-05-20", "TREASURE BOXING PROMOTION 8", "Treasure-Boxing", "後楽園ホール", "東京", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/415/"),
  event("treasure-09", "2025-09-17", "TREASURE BOXING PROMOTION 9", "Treasure-Boxing", "後楽園ホール", "東京", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/429/"),
  event("treasure-10", "2025-10-01", "TREASURE BOXING PROMOTION 10", "Treasure-Boxing", "後楽園ホール", "東京", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/433/"),
  event("treasure-11", "2026-03-12", "TREASURE BOXING PROMOTION 11", "Treasure-Boxing", "後楽園ホール", "東京", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/events/443/"),
  event("treasure-12", "2026-04-03", "TREASURE BOXING PROMOTION 12", "Treasure-Boxing", "後楽園ホール", "東京", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/archives/445/"),
  event("treasure-13", "2026-07-15", "TREASURE BOXING PROMOTION 13", "Treasure-Boxing", "後楽園ホール", "東京", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/events/462/"),
  event("treasure-14", "2026-08-16", "TREASURE BOXING PROMOTION 14", "Treasure-Boxing", "後楽園ホール", "東京", "TREASURE BOXING PROMOTION", "https://tb-promotion.com/events/468/"),

  // LIFETIME BOXING FIGHTS（志成プロモーション公式履歴）
  event("lifetime-19", "2024-02-16", "Lifetime Boxing Fights 19", "Lifetime Boxing Fights", "後楽園ホール", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-20", "2024-04-17", "Lifetime Boxing Fights 20", "Lifetime Boxing Fights", "後楽園ホール", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-21", "2024-06-27", "Lifetime Boxing Fights 21", "Lifetime Boxing Fights", "後楽園ホール", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-22", "2024-07-07", "Lifetime Boxing Fights 22", "Lifetime Boxing Fights", "両国国技館", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-23", "2024-08-22", "Lifetime Boxing Fights 23", "Lifetime Boxing Fights", "後楽園ホール", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-24", "2024-10-31", "Lifetime Boxing Fights 24", "Lifetime Boxing Fights", "後楽園ホール", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-25", "2024-12-31", "Lifetime Boxing Fights 25", "Lifetime Boxing Fights", "大田区総合体育館", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-26", "2025-03-21", "Lifetime Boxing Fights 26", "Lifetime Boxing Fights", "後楽園ホール", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-27", "2025-05-11", "Lifetime Boxing Fights 27", "Lifetime Boxing Fights", "大田区総合体育館", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-28", "2025-08-04", "Lifetime Boxing Fights 28", "Lifetime Boxing Fights", "後楽園ホール", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-29", "2025-10-29", "Lifetime Boxing Fights 29", "Lifetime Boxing Fights", "後楽園ホール", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-30", "2025-12-31", "Lifetime Boxing Fights 30", "Lifetime Boxing Fights", "大田区総合体育館", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),
  event("lifetime-31", "2026-03-09", "Lifetime Boxing Fights 31", "Lifetime Boxing Fights", "後楽園ホール", "東京", "Lifetime Boxing Fights", LIFETIME_HISTORY),

  // Phoenix Battleは大橋プロモーション主催。志成ジム所属選手が出場していても、LBFではない。
  event("phoenix-158", "2026-07-14", "Lemino BOXING フェニックスバトル 158", "Phoenix Battle", "後楽園ホール", "東京", "Lemino", "https://www.lifetime-boxing-fights.tdc.ne.jp/"),
  event("phoenix-159", "2026-08-19", "Lemino BOXING PHOENIX BATTLE 159", "Phoenix Battle", "後楽園ホール", "東京", "Lemino", "https://www.lifetime-boxing-fights.tdc.ne.jp/"),

  // 3150FIGHT（公式試合結果一覧）
  event("3150-survival-0", "2022-05-14", "3150FIGHT ～SURVIVAL～ vol.0", "3150 FIGHT", "176BOX", "大阪", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-survival-1", "2022-09-17", "3150FIGHT SURVIVAL vol.1", "3150 FIGHT", "メルパルクホール大阪", "大阪", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-survival-2", "2022-11-27", "3150FIGHT SURVIVAL vol.2", "3150 FIGHT", "176BOX", "大阪", "3150FIGHT", FIGHT_3150_HISTORY, true, undefined, "12:00"),
  event("3150-survival-3", "2022-11-27", "3150FIGHT SURVIVAL vol.3", "3150 FIGHT", "176BOX", "大阪", "3150FIGHT", FIGHT_3150_HISTORY, true, undefined, "17:00"),
  event("3150-survival-4", "2023-04-01", "3150FIGHT SURVIVAL vol.4", "3150 FIGHT", "エディオンアリーナ大阪 第2競技場", "大阪", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-survival-5", "2023-06-10", "3150FIGHT SURVIVAL vol.5", "3150 FIGHT", "エディオンアリーナ大阪 第2競技場", "大阪", "3150FIGHT", FIGHT_3150_HISTORY, true, undefined, "12:30"),
  event("3150-survival-6", "2023-06-10", "3150FIGHT SURVIVAL vol.6", "3150 FIGHT", "エディオンアリーナ大阪 第2競技場", "大阪", "3150FIGHT", FIGHT_3150_HISTORY, true, undefined, "17:15"),
  event("3150-survival-7", "2023-07-20", "3150FIGHT SURVIVAL vol.7", "3150 FIGHT", "後楽園ホール", "東京", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-survival-8", "2023-09-03", "3150FIGHT SURVIVAL vol.8", "3150 FIGHT", "コンベックス岡山・中展示場", "岡山", "3150FIGHT", FIGHT_3150_HISTORY),
  event("lushbomu-03", "2024-05-04", "LUSHBOMU vol.3 feat.3150FIGHT", "3150 FIGHT", "エディオンアリーナ大阪", "大阪", "3150FIGHT / LUSHBOMU", FIGHT_3150_HISTORY),
  event("lushbomu-01", "2024-08-24", "3150×LUSHBOMU vol.1", "3150 FIGHT", "大和アリーナ", "大阪", "3150FIGHT / LUSHBOMU", "https://www.3150fight.com/schedule/25/"),
  event("lushbomu-02", "2024-10-12", "3150×LUSHBOMU vol.2", "3150 FIGHT", "愛知県国際展示場", "愛知", "3150FIGHT / LUSHBOMU", FIGHT_3150_HISTORY),
  event("lushbomu-03-winter", "2024-12-21", "3150×LUSHBOMU vol.3", "3150 FIGHT", "ツインメッセ静岡", "静岡", "3150FIGHT / LUSHBOMU", FIGHT_3150_HISTORY),
  event("lushbomu-04", "2025-03-29", "3150×LUSHBOMU vol.4", "3150 FIGHT", "愛知県国際展示場", "愛知", "3150FIGHT / LUSHBOMU", FIGHT_3150_HISTORY),
  event("lushbomu-05", "2025-03-30", "3150×LUSHBOMU vol.5", "3150 FIGHT", "愛知県国際展示場", "愛知", "3150FIGHT / LUSHBOMU", FIGHT_3150_HISTORY),
  event("lushbomu-06", "2025-05-24", "3150×LUSHBOMU vol.6", "3150 FIGHT", "インテックス大阪", "大阪", "3150FIGHT / LUSHBOMU", FIGHT_3150_HISTORY),
  event("saikoulush-01", "2025-07-20", "3150×LUSHBOMU vol.7 ＆ SAIKOU×LUSH vol.1", "3150 FIGHT", "ビシュケク・アリーナ", "ビシュケク", "3150FIGHT / LUSH", FIGHT_3150_HISTORY, false),
  event("saikoulush-02", "2025-10-25", "SAIKOU×LUSH vol.2", "3150 FIGHT", "ビシュケク・アリーナ", "ビシュケク", "3150FIGHT / LUSH", FIGHT_3150_HISTORY, false),
  event("saikoulush-03", "2025-10-26", "SAIKOU×LUSH vol.3", "3150 FIGHT", "ビシュケク・アリーナ", "ビシュケク", "3150FIGHT / LUSH", FIGHT_3150_HISTORY, false),
  event("saikoulush-04", "2025-12-27", "SAIKOU×LUSH vol.4 in JAPAN", "3150 FIGHT", "愛知県国際展示場", "愛知", "3150FIGHT / LUSH", FIGHT_3150_HISTORY),
  event("3150-01", "2021-12-16", "3150FIGHT vol.1", "3150 FIGHT", "メルパルクホール大阪", "大阪", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-02", "2022-04-29", "3150FIGHT vol.2", "3150 FIGHT", "メルパルクホール大阪", "大阪", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-03", "2022-08-14", "3150FIGHT vol.3", "3150 FIGHT", "エディオンアリーナ大阪 第1競技場", "大阪", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-04", "2023-01-06", "3150FIGHT vol.4", "3150 FIGHT", "エディオンアリーナ大阪 第1競技場", "大阪", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-05", "2023-04-16", "3150FIGHT vol.5", "3150 FIGHT", "国立代々木競技場 第二体育館", "東京", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-06", "2023-08-11", "3150FIGHT vol.6", "3150 FIGHT", "エディオンアリーナ大阪 第1競技場", "大阪", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-07", "2023-10-07", "3150FIGHT vol.7", "3150 FIGHT", "大田区総合体育館", "東京", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-08", "2024-03-31", "3150FIGHT vol.8", "3150 FIGHT", "名古屋国際会議場 イベントホール", "愛知", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-09", "2024-07-28", "3150FIGHT vol.9", "3150 FIGHT", "滋賀ダイハツアリーナ", "滋賀", "3150FIGHT", FIGHT_3150_HISTORY),
  event("3150-10", "2026-06-06", "3150FIGHT 10", "3150 FIGHT", "愛知県国際展示場（AICHI SKY EXPO）", "愛知", "3150FIGHT", FIGHT_3150_HISTORY),
];
