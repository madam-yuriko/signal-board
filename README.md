# Signal Board

CPU・GPU・APU、都市再開発、映画、ボクシング、災害を対象単位のボードで確認する情報監視ダッシュボードです。
各タブは公開Webソースを取得して正規化し、6時間キャッシュして表示します。接続できない場合はタブごとの保存データへフォールバックします。

Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript で構築しています。

## ダッシュボード

- CPU&GPU&APU（`/`）: 1ボード = 1製品。CPU・GPU・APUのカテゴリ、メーカー、用途で絞り込み
- 再開発（`/redevelopment`）: 1ボード = 1再開発案件。状態、種類、地域で絞り込み
- 映画（`/movies`）: 1ボード = 1作品。公開状態、ジャンル、地域で絞り込み
- 飲食店（`/restaurants`）: Tabelog Insightでチェックした行きたい店をSQLite経由で自動同期
- ボクシング（`/boxing`）: 1ボード = 1興行。興行シリーズ、開催状態、国内外で絞り込み
- 災害（`/disasters`）: 1ボード = 1災害事象。警戒状態、種類、地域で絞り込み
- 世界戦一覧（`/world-titles`）: ボクシング内の補助ビュー

## 開発

```bash
npm install
npm run dev
npm run build
npm run lint
```

開発サーバーは通常 `http://localhost:3000` で起動します。

## データ

開催予定・開催済みを問わず、日付・対戦カードの正本はボクシングモバイルの公開スケジュール／月別試合速報と興行詳細ページです。過去興行も `sid` から同じ詳細カードを取得し、6時間ごとに再検証します。
日本ボクシングコミッション（JBC）の公開WordPress APIと公式結果PDFは、ボクシングモバイルのカードへ勝敗・決着方法を補完するためだけに使います。カードの順序や選手名はJBC側で置き換えません。
取得・解析・統合後の完成済みフィードを6時間キャッシュし、通常の画面表示では外部アクセスやPDF再解析を行いません。
CPU・GPU・APUはAMD / NVIDIA公式RSS、再開発は東京都都市整備局・札幌市の公式再開発地区一覧に加え、全国の注目複合案件を選定収録、映画は映画.comの上映中・公開予定、災害は気象庁の地震火山情報XMLを参照します。
Prime Video、Lemino、U-NEXT、TREASURE、3150FIGHTの公式履歴を `src/data/majorBoxingEvents.ts` で補完し、JBCの同日・同会場データと統合します。
接続できない場合も各タブの `src/data/` 保存データを表示します。

| 内容 | ファイル |
| --- | --- |
| ボクシング興行（フォールバック） | `src/data/events.ts` |
| ボクシング主要シリーズ公式台帳 | `src/data/majorBoxingEvents.ts` |
| CPU・GPU・APU製品 | `src/data/hardware.ts` |
| 映画作品 | `src/data/movies.ts` |
| 再開発案件 | `src/data/redevelopments.ts` |
| 災害・防災事象 | `src/data/disasters.ts` |
| 他タブの取得・キャッシュ・フォールバック | `src/lib/topicFeed.ts` |
| 世界王者 | `src/data/champions.ts` |

## 構成

```text
src/
├─ app/                  # 各ダッシュボードのルート
├─ components/           # カード、フィルタ、共通ヘッダー
├─ data/                 # モック・フォールバックデータ
├─ lib/                  # 表示・フィルタロジック
└─ types/                # 型定義
```
