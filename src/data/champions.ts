import type { Champion } from "@/types";

/**
 * 現役の日本人ボクシング世界王者一覧（2026-06 時点の調査値・主要4団体）。
 * 出典: tora2ro.com ほか公開情報。更新時はこの配列を編集する。
 */
export const champions: Champion[] = [
  {
    name: "井上尚弥",
    weightClass: "スーパーバンタム級",
    organizations: ["WBA", "WBC", "IBF", "WBO"],
    gym: "大橋",
    gender: "male",
  },
  {
    name: "堤聖也",
    weightClass: "バンタム級",
    organizations: ["WBA"],
    gym: "角海老宝石",
    gender: "male",
  },
  {
    name: "井上拓真",
    weightClass: "バンタム級",
    organizations: ["WBC"],
    gym: "大橋",
    gender: "male",
  },
  {
    name: "矢吹正道",
    weightClass: "フライ級",
    organizations: ["IBF"],
    gym: "緑",
    gender: "male",
  },
  {
    name: "岩田翔吉",
    weightClass: "ライトフライ級",
    organizations: ["WBC"],
    gym: "帝拳",
    gender: "male",
  },
  {
    name: "松本流星",
    weightClass: "ミニマム級",
    organizations: ["WBA"],
    gym: "帝拳",
    gender: "male",
  },
  {
    name: "山中菫",
    weightClass: "女子アトム級",
    organizations: ["IBF"],
    gym: "真正",
    gender: "female",
  },
  {
    name: "晝田瑞希",
    weightClass: "女子スーパーフライ級",
    organizations: ["WBO"],
    gym: "三迫",
    gender: "female",
  },
];
