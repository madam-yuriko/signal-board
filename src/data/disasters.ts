import type { TopicBoard } from "@/types/topics";

export const disasters: TopicBoard[] = [
  {
    id: "ds-heavy-rain-tohoku",
    domain: "disaster",
    title: "東北太平洋側 大雨警戒",
    category: "大雨・洪水",
    status: "warning",
    statusLabel: "警戒",
    statusTone: "danger",
    dateLabel: "最終更新 7月28日 15:20",
    location: "宮城県・岩手県",
    region: "東北",
    summary:
      "線状降水帯を想定した訓練用シナリオ。河川水位、避難情報、交通影響を一つの事象として表示。",
    image:
      "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "警戒地域", value: "12市町村" },
      { label: "避難所", value: "18か所" },
      { label: "交通影響", value: "3路線" },
      { label: "次回更新", value: "16:00" },
    ],
    updates: [
      { at: "15:20", text: "河川水位の想定値を更新" },
      { at: "14:45", text: "避難所6か所を追加" },
    ],
    tags: ["訓練", "河川", "避難情報"],
  },
  {
    id: "ds-earthquake-kanto",
    domain: "disaster",
    title: "関東北部 地震情報",
    category: "地震",
    status: "monitoring",
    statusLabel: "経過観察",
    statusTone: "warning",
    dateLabel: "最終更新 7月28日 13:40",
    location: "茨城県・栃木県",
    region: "関東",
    summary:
      "最大震度5弱を想定したモック事象。被害報告、ライフライン、鉄道運行を集約。",
    image:
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "最大震度", value: "5弱" },
      { label: "停電", value: "約1,200戸" },
      { label: "運転見合せ", value: "2路線" },
      { label: "次回更新", value: "14:30" },
    ],
    updates: [
      { at: "13:40", text: "鉄道の点検区間を更新" },
      { at: "13:10", text: "自治体の被害確認を反映" },
    ],
    tags: ["訓練", "震度5弱", "ライフライン"],
  },
  {
    id: "ds-volcano-kyushu",
    domain: "disaster",
    title: "九州南部 火山活動",
    category: "火山",
    status: "monitoring",
    statusLabel: "監視中",
    statusTone: "warning",
    dateLabel: "最終更新 7月28日 11:10",
    location: "鹿児島県",
    region: "九州",
    summary:
      "噴火警戒レベル上昇を想定したモック。降灰予測、規制区域、航空便への影響を確認。",
    image:
      "https://images.unsplash.com/photo-1565610222536-ef125c59da2e?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "警戒レベル", value: "3想定" },
      { label: "規制範囲", value: "火口3km" },
      { label: "航空影響", value: "4便" },
      { label: "次回更新", value: "17:00" },
    ],
    updates: [
      { at: "11:10", text: "降灰予測エリアを更新" },
      { at: "09:30", text: "登山道の規制情報を追加" },
    ],
    tags: ["訓練", "降灰", "交通規制"],
  },
  {
    id: "ds-heat-kansai",
    domain: "disaster",
    title: "近畿地方 猛暑対応",
    category: "猛暑",
    status: "warning",
    statusLabel: "警戒",
    statusTone: "danger",
    dateLabel: "最終更新 7月28日 10:00",
    location: "大阪府・京都府・兵庫県",
    region: "近畿",
    summary:
      "広域の熱中症警戒を想定。暑さ指数、救急搬送、クーリングシェルターの状況を集約。",
    image:
      "https://images.unsplash.com/photo-1504370805625-d32c54b16100?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "危険地域", value: "8地点" },
      { label: "一時休止施設", value: "14件" },
      { label: "開放施設", value: "93か所" },
      { label: "次回更新", value: "15:00" },
    ],
    updates: [
      { at: "10:00", text: "暑さ指数の予測値を更新" },
      { at: "08:30", text: "開放施設の一覧を更新" },
    ],
    tags: ["訓練", "熱中症", "避難施設"],
  },
  {
    id: "ds-snow-hokkaido",
    domain: "disaster",
    title: "道央 大雪交通障害",
    category: "大雪",
    status: "resolved",
    statusLabel: "対応終了",
    statusTone: "success",
    dateLabel: "最終更新 2月18日 18:30",
    location: "北海道道央",
    region: "北海道",
    summary:
      "冬季訓練用の完了事象。道路通行止め、航空便、除雪進捗の履歴を保持。",
    image:
      "https://images.unsplash.com/photo-1483664852095-d6cc6870702d?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "通行止め", value: "解除済み" },
      { label: "欠航便", value: "36便" },
      { label: "除雪進捗", value: "100%" },
      { label: "終了時刻", value: "18:30" },
    ],
    updates: [
      { at: "18:30", text: "全規制解除、対応終了" },
      { at: "16:10", text: "主要国道の除雪完了" },
    ],
    tags: ["訓練", "大雪", "対応履歴"],
  },
  {
    id: "ds-tsunami-shikoku",
    domain: "disaster",
    title: "四国沿岸 津波避難訓練",
    category: "津波",
    status: "prepared",
    statusLabel: "準備中",
    statusTone: "info",
    dateLabel: "訓練予定 8月30日 09:00",
    location: "高知県沿岸部",
    region: "四国",
    summary:
      "広域避難訓練の事前ボード。参加自治体、避難ルート、情報伝達テストの準備状況を管理。",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "参加自治体", value: "9市町村" },
      { label: "避難ルート", value: "42経路" },
      { label: "参加予定", value: "約8,000人" },
      { label: "次回確認", value: "8月10日" },
    ],
    updates: [
      { at: "7月25日", text: "訓練シナリオを確定" },
      { at: "7月12日", text: "避難ルート点検を開始" },
    ],
    tags: ["訓練", "津波", "事前準備"],
  },
];
