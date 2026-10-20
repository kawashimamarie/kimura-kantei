# kimura-kantei

株式会社木村不動産鑑定 Webサイト（リニューアル制作中の確認用ページ）

[Astro](https://astro.build/) で生成する静的サイトです。

## ディレクトリ構成

```
site/                     サイトのソース
├── src/
│   ├── pages/            ページ（URL と 1 対 1 で対応）
│   ├── layouts/          レイアウト（TopLayout：トップ／SiteLayout・ServiceLayoutD7：D7デザインに移行済みの下層ページ／BaseLayout・ServiceLayout：移行前の下層ページ）
│   ├── components/       共通部品（パンくず・問い合わせ案内・FAQ・カードなど）。components/d7/ は D7 デザインの共通部品（ヘッダー・フッター・固定ボタン・見出し・FAQ など）
│   ├── content/
│   │   ├── cases/        事例（Markdown）
│   │   └── column/       コラム（Markdown）
│   ├── content.config.ts 事例・コラムの項目定義
│   ├── data/             会社情報・サービス・FAQ・プロフィール
│   ├── lib/              URL・構造化データ・日付の補助関数
│   └── styles/           global.css（移行前の下層ページ共通）・top.css（トップ専用）・d7/（D7 共通基盤：vars＝色・フォント、shell＝ヘッダー/フッター/固定ボタン、base・parts＝下層ページの土台と部品）
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

## 確認用プレビューの設定

- 全ページの上部の「確認用プレビュー」の表示：`site/src/data/site.ts` の `site.preview`（正式公開時は `false`）。
- 検索エンジンへの非公開（noindex）：同じく `site.noindex`（確認用の間は `true`。ここでは変更しない）。
- 提案用サンプル（`/samples/`）：`EXCLUDE_SAMPLES=1` のビルドでは出力から外れる（`npm run build:pages` は既定で外す）。ソース・画像は残している。
- お問い合わせフォーム：送信先が未設定の間は「確認用・送信できません」の表示で、送信しない。接続するときは、ビルド時の環境変数
  `PUBLIC_CONTACT_FORM_ENDPOINT`（送信先URL）と `PUBLIC_TURNSTILE_SITE_KEY`（迷惑メール対策の公開サイトキー）を渡す。
  秘密鍵・APIキーは、このリポジトリに含めず、送信を受けるサーバー側の環境変数に置く。
- プライバシーポリシー：`site/src/data/privacy.ts` に、現行サイトの原文をそのまま置いている。変更は、木村様の承認と専門家の確認のあとだけ。

## コンテンツの追加

- **コラム**：`site/src/content/column/{slug}.md` を追加します（項目は `content.config.ts` を参照）。
- **事例**：`site/src/content/cases/{slug}.md` を追加します。
- **FAQ**：`site/src/data/faq.ts` に追加し、関連するサービスの `relatedFaq` に id を加えます。

関連サービス・関連事例・関連記事のリンクと構造化データは、各ファイルの項目から自動で作られます。
