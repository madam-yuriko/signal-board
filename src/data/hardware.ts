import type { TopicBoard } from "@/types/topics";

export const hardware: TopicBoard[] = [
  {
    id: "hw-ryzen-9950x3d",
    domain: "hardware",
    title: "Ryzen 9 9950X3D",
    category: "CPU",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2025年3月発売",
    location: "デスクトップ向け",
    region: "AMD",
    summary:
      "3D V-Cacheを搭載したハイエンドCPU。ゲーム性能とマルチスレッド性能の両方を重視する構成向け。",
    image:
      "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "コア / スレッド", value: "16C / 32T" },
      { label: "最大クロック", value: "5.7GHz" },
      { label: "L3キャッシュ", value: "128MB" },
      { label: "TDP", value: "170W" },
    ],
    updates: [
      { at: "7月24日", text: "対応マザーボードBIOSを更新" },
      { at: "6月18日", text: "ゲームベンチマークを追加" },
    ],
    tags: ["Zen 5", "3D V-Cache", "AM5"],
  },
  {
    id: "hw-core-ultra-285k",
    domain: "hardware",
    title: "Core Ultra 9 285K",
    category: "CPU",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2024年10月発売",
    location: "デスクトップ向け",
    region: "Intel",
    summary:
      "NPUを内蔵したデスクトップ向けCore Ultra。省電力性とAI処理を含む総合性能を確認するためのモック項目。",
    image:
      "https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "コア / スレッド", value: "24C / 24T" },
      { label: "最大クロック", value: "5.7GHz" },
      { label: "NPU性能", value: "13 TOPS" },
      { label: "最大電力", value: "250W" },
    ],
    updates: [
      { at: "7月19日", text: "対応チップセット情報を更新" },
      { at: "6月28日", text: "内蔵NPUの用途メモを追加" },
    ],
    tags: ["Arrow Lake", "NPU", "LGA1851"],
  },
  {
    id: "hw-geforce-rtx-5090",
    domain: "hardware",
    title: "GeForce RTX 5090",
    category: "GPU",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2025年1月発売",
    location: "ハイエンドGPU",
    region: "NVIDIA",
    summary:
      "大容量VRAMとレイトレーシング性能を重視する最上位GPU。電源容量とケースサイズも併せて確認。",
    image:
      "https://images.unsplash.com/photo-1591405351990-4726e331f141?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "CUDAコア", value: "21,760" },
      { label: "メモリ", value: "32GB GDDR7" },
      { label: "メモリバス", value: "512-bit" },
      { label: "推奨電源", value: "1000W" },
    ],
    updates: [
      { at: "7月26日", text: "ドライバ対応タイトルを更新" },
      { at: "7月4日", text: "消費電力の目安を補足" },
    ],
    tags: ["Blackwell", "DLSS", "レイトレーシング"],
  },
  {
    id: "hw-radeon-rx-9070-xt",
    domain: "hardware",
    title: "Radeon RX 9070 XT",
    category: "GPU",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2025年3月発売",
    location: "ミドルハイGPU",
    region: "AMD",
    summary:
      "1440pゲーミングを軸にしたGPU。主要ゲームのフレームレートとアップスケーリング対応を整理。",
    image:
      "https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "ストリームプロセッサ", value: "4,096" },
      { label: "メモリ", value: "16GB GDDR6" },
      { label: "メモリバス", value: "256-bit" },
      { label: "TBP", value: "304W" },
    ],
    updates: [
      { at: "7月20日", text: "FSR対応ゲームを追加" },
      { at: "6月29日", text: "カード長の目安を更新" },
    ],
    tags: ["RDNA 4", "FSR", "1440p"],
  },
  {
    id: "hw-ryzen-ai-max-395",
    domain: "hardware",
    title: "Ryzen AI Max+ 395",
    category: "APU",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2025年3月発表",
    location: "薄型モバイル向け",
    region: "AMD",
    summary:
      "CPU・GPU・NPUを一つにまとめたモバイル向けAPU。小型筐体でのクリエイティブ用途を想定。",
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "CPUコア", value: "16C / 32T" },
      { label: "GPU", value: "Radeon 8060S" },
      { label: "AI性能", value: "50 TOPS" },
      { label: "メモリ", value: "最大128GB" },
    ],
    updates: [
      { at: "7月12日", text: "対応ノートPCの情報を追加" },
      { at: "6月21日", text: "内蔵GPUの共有メモリを補足" },
    ],
    tags: ["Zen 5", "RDNA 3.5", "Ryzen AI"],
  },
  {
    id: "hw-snapdragon-x-elite",
    domain: "hardware",
    title: "Snapdragon X Elite",
    category: "APU",
    status: "released",
    statusLabel: "発売済み",
    statusTone: "success",
    dateLabel: "2024年6月搭載開始",
    location: "Windowsノート向け",
    region: "Qualcomm",
    summary:
      "長時間駆動を重視するArmベースの統合プラットフォーム。CPU・GPU・NPUのバランスを確認。",
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80",
    metrics: [
      { label: "CPUコア", value: "12コア" },
      { label: "GPU性能", value: "最大4.6 TFLOPS" },
      { label: "AI性能", value: "45 TOPS" },
      { label: "公称消費電力", value: "23〜80W" },
    ],
    updates: [
      { at: "7月8日", text: "互換アプリの確認結果を更新" },
      { at: "6月16日", text: "バッテリー動作の比較項目を追加" },
    ],
    tags: ["Arm", "Copilot+ PC", "省電力"],
  },
];
