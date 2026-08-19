import type { TopicBoard } from "@/types/topics";

export const indieGames: TopicBoard[] = [
  {
    id: "indie-balatro",
    domain: "indie-game",
    title: "Balatro",
    category: "カードゲーム",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2024年2月発売",
    location: "PC・コンソール",
    region: "LocalThunk",
    summary:
      "ポーカーの役を組み合わせてデッキを強化するローグライク。短いプレイ単位とビルドの奥深さを追跡します。",
    image:
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "ジャンル", value: "ローグライク・カード" },
      { label: "対応", value: "PC / Switch / PS / Xbox" },
      { label: "開発元", value: "LocalThunk" },
      { label: "特徴", value: "ジョーカー構築" },
    ],
    updates: [
      { at: "継続更新", text: "バランス調整とプラットフォーム対応を確認" },
      { at: "収録", text: "インディーゲーム一覧に追加" },
    ],
    tags: ["ローグライク", "カード", "リプレイ性"],
    sourceUrl: "https://www.playbalatro.com/",
  },
  {
    id: "indie-hades-ii",
    domain: "indie-game",
    title: "Hades II",
    category: "アクション",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2025年9月正式版",
    location: "PC・コンソール",
    region: "Supergiant Games",
    summary:
      "神話をモチーフにした高速アクション。繰り返し遊ぶたびに変化する戦闘と物語の更新を整理します。",
    image:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "ジャンル", value: "ローグライク・アクション" },
      { label: "対応", value: "PC / コンソール" },
      { label: "開発元", value: "Supergiant Games" },
      { label: "特徴", value: "ビルド選択・物語分岐" },
    ],
    updates: [
      { at: "アップデート", text: "新しい武器・イベントの追加を確認" },
      { at: "収録", text: "開発元の公式情報を登録" },
    ],
    tags: ["アクション", "神話", "ローグライク"],
    sourceUrl: "https://www.supergiantgames.com/games/hades-ii/",
  },
  {
    id: "indie-slay-the-spire-2",
    domain: "indie-game",
    title: "Slay the Spire 2",
    category: "デッキ構築",
    status: "development",
    statusLabel: "開発・更新中",
    statusTone: "warning",
    dateLabel: "開発中",
    location: "PC・コンソール",
    region: "Mega Crit",
    summary:
      "カードで戦略を組み立てるデッキ構築型ローグライクの続編。新キャラクターとカードの情報を追跡します。",
    image:
      "https://images.unsplash.com/photo-1605870445919-838d190e8e1b?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "ジャンル", value: "デッキ構築・ローグライク" },
      { label: "対応", value: "PC / コンソール" },
      { label: "開発元", value: "Mega Crit" },
      { label: "注目点", value: "新カード・新キャラクター" },
    ],
    updates: [
      { at: "開発中", text: "ゲームプレイと登場キャラクターの情報を更新" },
      { at: "収録", text: "公式サイトを参照先として登録" },
    ],
    tags: ["カード", "戦略", "ローグライク"],
    sourceUrl: "https://www.megacrit.com/",
  },
  {
    id: "indie-stardew-valley",
    domain: "indie-game",
    title: "Stardew Valley",
    category: "シミュレーション",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2016年2月発売",
    location: "PC・コンソール・モバイル",
    region: "ConcernedApe",
    summary:
      "農場づくりと町の交流を楽しむ生活シミュレーション。長期運営される作品のアップデートを記録します。",
    image:
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "ジャンル", value: "農場・生活シミュレーション" },
      { label: "対応", value: "PC / コンソール / モバイル" },
      { label: "開発元", value: "ConcernedApe" },
      { label: "特徴", value: "農業・クラフト・交流" },
    ],
    updates: [
      { at: "継続更新", text: "追加コンテンツとマルチプレイ対応を確認" },
      { at: "収録", text: "公式サイトを参照先として登録" },
    ],
    tags: ["農場", "生活", "クラフト"],
    sourceUrl: "https://www.stardewvalley.net/",
  },
  {
    id: "indie-noita",
    domain: "indie-game",
    title: "Noita",
    category: "アクション",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2020年9月発売",
    location: "PC",
    region: "Nolla Games",
    summary:
      "すべてのピクセルが物理演算される世界を探索するアクション。呪文の組み合わせと実験性が魅力です。",
    image:
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "ジャンル", value: "アクション・ローグライク" },
      { label: "対応", value: "PC" },
      { label: "開発元", value: "Nolla Games" },
      { label: "特徴", value: "物理演算・呪文作成" },
    ],
    updates: [
      { at: "コミュニティ", text: "新しい発見とプレイ方法を確認" },
      { at: "収録", text: "作品情報を一覧に追加" },
    ],
    tags: ["ピクセル", "物理演算", "探索"],
    sourceUrl: "https://noitagame.com/",
  },
  {
    id: "indie-sea-of-stars",
    domain: "indie-game",
    title: "Sea of Stars",
    category: "RPG",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2023年8月発売",
    location: "PC・コンソール",
    region: "Sabotage Studio",
    summary:
      "クラシックRPGの手触りを現代的に再構成した作品。探索、料理、コンボ攻撃などの要素をまとめます。",
    image:
      "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "ジャンル", value: "ターン制RPG" },
      { label: "対応", value: "PC / コンソール" },
      { label: "開発元", value: "Sabotage Studio" },
      { label: "特徴", value: "ドット絵・協力プレイ" },
    ],
    updates: [
      { at: "追加更新", text: "新しいクエストとゲームモードを確認" },
      { at: "収録", text: "開発元の作品情報を登録" },
    ],
    tags: ["RPG", "ドット絵", "協力プレイ"],
    sourceUrl: "https://seaofstarsgame.co/",
  },
];
