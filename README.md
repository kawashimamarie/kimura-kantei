# kimura-kantei

株式会社木村不動産鑑定 Webサイト（リニューアル制作中の確認用ページ）

[Astro](https://astro.build/) で生成する静的サイトです。

## ディレクトリ構成

```
site/                     サイトのソース
├── src/
│   ├── pages/            ページ（URL と 1 対 1 で対応）
│   ├── layouts/          共通レイアウト（BaseLayout：head・ヘッダー・フッター／ServiceLayout：サービスページ）
│   ├── components/       共通部品（パンくず・問い合わせ案内・FAQ・カードなど）
│   ├── content/
│   │   ├── cases/        事例（Markdown）
│   │   └── column/       コラム（Markdown）
│   ├── content.config.ts 事例・コラムの項目定義
│   ├── data/             会社情報・サービス・FAQ・プロフィール
│   ├── lib/              URL・構造化データ・日付の補助関数
│   └── styles/global.css 共通スタイル
├── public/assets/        画像・JavaScript（そのまま配信）
└── scripts/build-pages.mjs  確認用プレビュー（GitHub Pages）向けのビルド
```

リポジトリ直下の HTML（`index.html`・`services/` など）は、`site/` からビルドした確認用の出力です。直接編集しないでください。

## 開発

```sh
cd site
npm install
npm run dev          # 開発用サーバー（http://localhost:4321/）
npm run build        # 本番用ビルド（site/dist/）
npm run build:pages  # 確認用プレビュー向けにビルドし、リポジトリ直下へ出力
```

## コンテンツの追加

- **コラム**：`site/src/content/column/{slug}.md` を追加します（項目は `content.config.ts` を参照）。
- **事例**：`site/src/content/cases/{slug}.md` を追加します。
- **FAQ**：`site/src/data/faq.ts` に追加し、関連するサービスの `relatedFaq` に id を加えます。

関連サービス・関連事例・関連記事のリンクと構造化データは、各ファイルの項目から自動で作られます。
