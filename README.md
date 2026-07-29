# Signal Board

ボクシング興行、都市再開発、災害・防災情報を、対象単位のボードで確認する情報監視ダッシュボードです。
現在の表示データはすべてモックです。

Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript で構築しています。

## ダッシュボード

- ボクシング（`/`）: 1ボード = 1興行。興行シリーズ、開催状態、国内外で絞り込み
- 再開発（`/redevelopment`）: 1ボード = 1再開発案件。状態、種類、地域で絞り込み
- 災害情報（`/disasters`）: 1ボード = 1災害事象。警戒状態、種類、地域で絞り込み
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

モックデータは `src/data/` に収録しています。

| 内容 | ファイル |
| --- | --- |
| ボクシング興行 | `src/data/events.ts` |
| 再開発案件 | `src/data/redevelopments.ts` |
| 災害・防災事象 | `src/data/disasters.ts` |
| 世界王者 | `src/data/champions.ts` |

## 構成

```text
src/
├─ app/                  # 各ダッシュボードのルート
├─ components/           # カード、フィルタ、共通ヘッダー
├─ data/                 # モックデータ
├─ lib/                  # 表示・フィルタロジック
└─ types/                # 型定義
```