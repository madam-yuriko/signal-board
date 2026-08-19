import type { Bout, BoutResult } from "@/types";

export interface BoxingResultEvent {
  date: string;
  series: string;
  bouts: Bout[];
}

type BoutOptions = Partial<Pick<Bout, "weightClass" | "organizations" | "notes" | "isMainEvent">>;

function bout(
  id: string,
  jpFighter: string,
  opponent: string,
  result: BoutResult,
  method: string,
  options: BoutOptions = {},
): Bout {
  return {
    id,
    jpFighter,
    opponent,
    weightClass: options.weightClass ?? "契約階級",
    organizations: options.organizations ?? [],
    result,
    method,
    ...options,
  };
}

const prime = "Prime Video Boxing";

/**
 * Historical result catalog used to join the complete Boxmob card list with
 * results from JBC and public event result reports.  The first fighter in
 * each record is the reference fighter for `result`; boxingFeed adapts the
 * result when the live card is presented in the opposite corner order.
 */
export const boxingResultEvents: BoxingResultEvent[] = [
  {
    date: "2026-04-11",
    series: prime,
    bouts: [
      bout("result-20260411-1", "那須川天心", "ファン・フランシスコ・エストラーダ", "win", "TKO 9R終了時", { isMainEvent: true, organizations: ["WBC"] }),
      bout("result-20260411-2", "坪井智也", "ペドロ・ゲバラ", "no-contest", "無効試合 2R 23秒（偶発的バッティング）", { organizations: ["WBA", "WBC", "IBF", "WBO"] }),
      bout("result-20260411-3", "秋次克真", "ホセ・カルデロン", "loss", "判定 0-2"),
      bout("result-20260411-4", "久保寺啓太", "クリサルディ・ベルトラン", "win", "KO 5R 59秒"),
      bout("result-20260411-5", "高見亨介", "アンヘル・アヤラ", "cancelled", "前日中止（高見の体調不良）"),
    ],
  },
  {
    date: "2025-11-24",
    series: prime,
    bouts: [
      bout("result-20251124-1", "井上拓真", "那須川天心", "win", "判定 3-0", { isMainEvent: true, organizations: ["WBC"] }),
      bout("result-20251124-2", "中野幹士", "ライース・アリーム", "loss", "判定", { organizations: ["IBF"] }),
      bout("result-20251124-3", "坪井智也", "カルロス・クアドラス", "win", "TKO 8R 2分59秒"),
      bout("result-20251124-4", "増田陸", "ホセ・カルデロン", "win", "負傷判定 5R 1分27秒"),
      bout("result-20251124-5", "佐藤竜冴", "梶原孝司", "win", "TKO 3R 58秒"),
      bout("result-20251124-6", "澤田翔瑠", "為我井慧惟", "loss", "判定 0-3"),
    ],
  },
  {
    date: "2025-06-08",
    series: prime,
    bouts: [
      bout("result-20250608-1", "中谷潤人", "西田凌佑", "win", "TKO 6R終了時", { isMainEvent: true, organizations: ["WBC", "IBF"] }),
      bout("result-20250608-2", "那須川天心", "ビクトル・サンティリャン", "win", "判定 3-0"),
      bout("result-20250608-3", "坪井智也", "バン・タオ・トラン", "win", "判定 3-0", { organizations: ["WBO"] }),
      bout("result-20250608-4", "増田陸", "ミシェル・バンケス", "win", "KO 1R 2分27秒"),
      bout("result-20250608-5", "大久保るきあ", "米谷匠生", "win", "KO 3R 52秒"),
      bout("result-20250608-6", "宮下陸", "大島冬也", "win", "判定 3-0"),
    ],
  },
  {
    date: "2025-05-04",
    series: prime,
    bouts: [
      bout("result-20250504-1", "井上尚弥", "ラモン・カルデナス", "win", "TKO 8R 45秒", { isMainEvent: true, organizations: ["WBA", "WBC", "IBF", "WBO"] }),
      bout("result-20250504-2", "ラファエル・エスピノサ", "エドワード・バスケス", "win", "KO 7R 1分47秒", { organizations: ["WBO"] }),
      bout("result-20250504-3", "ロハン・ポランコ", "ファビアン・マイダナ", "win", "判定", { organizations: ["WBO"] }),
      bout("result-20250504-4", "エミリアーノ・バルガス", "ジョン レオン", "win", "TKO 2R 1分40秒"),
      bout("result-20250504-5", "中野幹士", "ペドロ・マルケス・メディナ", "win", "TKO 4R 1分58秒"),
      bout("result-20250504-6", "アート・バレラ Jr.", "ファン・カルロス・グエラ Jr.", "win", "TKO 6R"),
      bout("result-20250504-7", "ラエッセ・アレーム", "ルディ・ガルシア", "win", "判定 3-0"),
    ],
  },
  {
    date: "2025-02-24",
    series: prime,
    bouts: [
      bout("result-20250224-1", "中谷潤人", "ダビド・クエジャル", "win", "KO 3R 3分04秒", { isMainEvent: true, organizations: ["WBC"] }),
      bout("result-20250224-2", "那須川天心", "ジェーソン・モロニー", "win", "判定 3-0"),
      bout("result-20250224-3", "堤聖也", "比嘉大吾", "draw", "判定 0-0", { organizations: ["WBA"] }),
      bout("result-20250224-4", "赤井英五郎", "盛合竜也", "win", "TKO 2R 1分15秒"),
      bout("result-20250224-5", "木内凌祐", "フエンテス北嶋", "win", "判定 3-0"),
      bout("result-20250224-6", "愛甲隼士", "佐藤結希", "win", "判定 3-0"),
    ],
  },
  {
    date: "2024-10-14",
    series: prime,
    bouts: [
      bout("result-20241014-1", "中谷潤人", "ペッチ・ソー・チットパッタナ", "win", "KO 6R 2分59秒", { isMainEvent: true, organizations: ["WBC"] }),
      bout("result-20241014-2", "那須川天心", "ジェルウィン・アシロ", "win", "判定 3-0", { organizations: ["WBO"] }),
      bout("result-20241014-3", "田中恒成", "プメレレ・カフ", "loss", "判定 1-2", { organizations: ["WBO"] }),
      bout("result-20241014-4", "アンソニー・オラスクアガ", "ジョナサン・ゴンサレス", "no-contest", "無効試合 1R 2分25秒（偶発的なバッティング）", { organizations: ["WBO"] }),
      bout("result-20241014-5", "エクセルジェームス ジュニア", "小林彩都", "draw", "判定 引き分け"),
    ],
  },
  {
    date: "2024-10-13",
    series: prime,
    bouts: [
      bout("result-20241013-1", "井上拓真", "堤聖也", "loss", "判定 0-3", { isMainEvent: true, organizations: ["WBA"] }),
      bout("result-20241013-2", "寺地拳四朗", "クリストファー・ロサレス", "win", "TKO 11R 6秒", { organizations: ["WBC"] }),
      bout("result-20241013-3", "ユーリ阿久井政悟", "タナンチャイ・チャルンパック", "win", "判定 2-1", { organizations: ["WBA"] }),
      bout("result-20241013-4", "岩田翔吉", "ハイロ・ノリエガ", "win", "TKO 3R終了時", { organizations: ["WBO"] }),
      bout("result-20241013-5", "佐藤竜冴", "佐藤麻人", "draw", "判定 引き分け"),
    ],
  },
  {
    date: "2024-07-20",
    series: prime,
    bouts: [
      bout("result-20240720-1", "中谷潤人", "ビンセント・アストロラビオ", "win", "KO 1R 2分37秒", { isMainEvent: true, organizations: ["WBC"] }),
      bout("result-20240720-2", "那須川天心", "ジョナサン・ロドリゲス", "win", "KO 3R 1分49秒"),
      bout("result-20240720-3", "アンソニー・オラスクアガ", "加納陸", "win", "KO 3R 2分50秒", { organizations: ["WBO"] }),
      bout("result-20240720-4", "荒本一成", "モンゴンスー ナンディナーデネ", "win", "TKO 6R 1分09秒"),
      bout("result-20240720-5", "田中恒成", "ジョナタン・ロドリゲス", "cancelled", "中止（相手の計量失格）", { organizations: ["WBO"] }),
    ],
  },
  {
    date: "2024-05-06",
    series: prime,
    bouts: [
      bout("result-20240506-1", "井上尚弥", "ルイス・ネリ", "win", "TKO 6R 1分22秒", { isMainEvent: true, organizations: ["WBA", "WBC", "IBF", "WBO"] }),
      bout("result-20240506-2", "武居由樹", "ジェイソン マロニー", "win", "判定 3-0", { organizations: ["WBO"] }),
      bout("result-20240506-3", "井上拓真", "石田匠", "win", "判定 3-0", { organizations: ["WBA"] }),
      bout("result-20240506-4", "ユーリ阿久井政悟", "桑原拓", "win", "判定 3-0", { organizations: ["WBA"] }),
      bout("result-20240506-5", "TJ・ドヘニー", "ブリル・バヨゴス", "win", "TKO 4R 2分51秒"),
    ],
  },
  {
    date: "2024-02-24",
    series: prime,
    bouts: [
      bout("result-20240224-1", "井上拓真", "ジェルウィン・アンカハス", "win", "TKO 9R 44秒", { isMainEvent: true, organizations: ["WBA"] }),
      bout("result-20240224-2", "中谷潤人", "アレハンドロ・サンティアゴ・バリオス", "win", "TKO 6R 1分12秒", { organizations: ["WBC"] }),
      bout("result-20240224-3", "田中恒成", "クリスチャン・エドゥアルド・バカセグア", "win", "判定 3-0", { organizations: ["WBO"] }),
      bout("result-20240224-4", "増田陸", "ジョナス・スルタン", "win", "KO 1R 2分21秒"),
      bout("result-20240224-5", "小林蓮", "小山田憲昇", "win", "TKO 4R 1分51秒"),
    ],
  },
  {
    date: "2024-01-23",
    series: prime,
    bouts: [
      bout("result-20240123-1", "寺地拳四朗", "カルロス・カニサレス", "win", "判定 2-0", { isMainEvent: true, organizations: ["WBA", "WBC"] }),
      bout("result-20240123-2", "那須川天心", "ルイス・ロブレス・パチェコ", "win", "TKO 3R終了時"),
      bout("result-20240123-3", "ユーリ阿久井政悟", "アルテム・ダラキアン", "win", "判定 3-0", { organizations: ["WBA"] }),
      bout("result-20240123-4", "辰吉寿以輝", "与那覇勇気", "win", "判定 2-0"),
      bout("result-20240123-5", "藤原勇生", "西岡聖哉", "win", "判定 3-0"),
      bout("result-20240123-6", "竹中るいじ", "小田浩輝", "win", "判定 3-0"),
    ],
  },
  {
    date: "2023-09-18",
    series: prime,
    bouts: [
      bout("result-20230918-1", "寺地拳四朗", "ヘッキー・ブドラー", "win", "TKO 9R 2分19秒", { isMainEvent: true, organizations: ["WBA", "WBC"] }),
      bout("result-20230918-2", "那須川天心", "ルイス・グスマン", "win", "判定 3-0"),
      bout("result-20230918-3", "中谷潤人", "アルヒ・コルテス", "win", "判定 3-0", { organizations: ["WBO"] }),
      bout("result-20230918-4", "アンソニー・オラスクアガ", "ジーメル・マグラモ", "win", "TKO 7R 2分57秒"),
      bout("result-20230918-5", "玉川拓夢", "横山隼人", "win", "判定 2-1"),
    ],
  },
  {
    date: "2023-04-08",
    series: prime,
    bouts: [
      bout("result-20230408-1", "寺地拳四朗", "アンソニー・オラスクアガ", "win", "TKO 9R 58秒", { isMainEvent: true, organizations: ["WBA", "WBC"] }),
      bout("result-20230408-2", "井上拓真", "リボリオ・ソリス", "win", "判定 3-0", { organizations: ["WBA"] }),
      bout("result-20230408-3", "那須川天心", "与那覇勇気", "win", "判定 3-0"),
      bout("result-20230408-4", "佐々木尽", "小原佳太", "win", "TKO 3R 1分13秒", { organizations: ["WBO"] }),
      bout("result-20230408-5", "阿部麗也", "キコ・マルチネス", "win", "判定 3-0", { organizations: ["IBF"] }),
      bout("result-20230408-6", "田中一聖", "為我井泰我", "draw", "判定 引き分け"),
    ],
  },
  {
    date: "2022-11-01",
    series: prime,
    bouts: [
      bout("result-20221101-1", "寺地拳四朗", "京口紘人", "win", "KO 7R", { isMainEvent: true, organizations: ["WBA", "WBC"] }),
      bout("result-20221101-2", "岩田翔吉", "ジョナサン・ゴンサレス", "loss", "判定 0-3", { organizations: ["WBO"] }),
      bout("result-20221101-3", "中谷潤人", "フランシスコ・ロドリゲス Jr.", "win", "判定 3-0"),
      bout("result-20221101-4", "吉野修一郎", "中谷正義", "win", "KO 6R 1分14秒", { organizations: ["WBO"] }),
      bout("result-20221101-5", "村上雄大", "藤﨑光志", "win", "負傷判定 5R 2分39秒"),
      bout("result-20221101-6", "エクセルジェームス ジュニア", "沼田康生", "win", "判定 3-0"),
    ],
  },
  {
    date: "2022-06-07",
    series: prime,
    bouts: [
      bout("result-20220607-1", "井上尚弥", "ノニト・ドネア", "win", "TKO 2R 1分24秒", { isMainEvent: true, organizations: ["WBA", "WBC", "IBF"] }),
      bout("result-20220607-2", "平岡アンディ", "赤岩俊", "win", "TKO 6R 1分24秒", { organizations: ["WBO"] }),
      bout("result-20220607-3", "井上拓真", "古橋岳也", "win", "判定 3-0", { organizations: ["WBO"] }),
      bout("result-20220607-4", "石井渡士也", "福永輝", "win", "TKO 6R 1分16秒"),
      bout("result-20220607-5", "坂間叶夢", "石垣芙季", "win", "TKO 2R 1分34秒"),
      bout("result-20220607-6", "松野晃汰", "岡村弥徳", "win", "判定 3-0"),
      bout("result-20220607-7", "岩下千紘", "山名生竜", "win", "判定 3-0"),
    ],
  },
  {
    date: "2022-04-09",
    series: prime,
    bouts: [
      bout("result-20220409-1", "村田諒太", "ゲンナジー・ゴロフキン", "loss", "TKO 9R 2分11秒", { isMainEvent: true, organizations: ["WBA", "IBF"] }),
      bout("result-20220409-2", "中谷潤人", "山内涼太", "win", "TKO 8R 2分20秒", { organizations: ["WBO"] }),
      bout("result-20220409-3", "吉野修一郎", "伊藤雅雪", "win", "負傷判定 11R 2分06秒"),
      bout("result-20220409-4", "穴口一輝", "山本龍児", "win", "TKO 3R 56秒"),
      bout("result-20220409-5", "加藤大河", "雨木拓翔", "win", "判定 3-0"),
      bout("result-20220409-6", "梶谷有樹", "佐藤友紀", "win", "TKO 1R 1分35秒"),
    ],
  },
  {
    date: "2023-07-25",
    series: "Lemino Boxing",
    bouts: [
      bout("result-20230725-1", "井上尚弥", "スティーブン・フルトン", "win", "TKO 8R 1分14秒", { isMainEvent: true, organizations: ["WBC", "WBO"] }),
    ],
  },
  {
    date: "2023-12-26",
    series: "Lemino Boxing",
    bouts: [
      bout("result-20231226-1", "井上尚弥", "マーロン・タパレス", "win", "KO 10R", { isMainEvent: true, organizations: ["WBA", "WBC", "IBF", "WBO"] }),
    ],
  },
];
