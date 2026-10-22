# kimura-kantei

株式会社木村不動産鑑定 Webサイト（リニューアル制作中の確認用ページ）

[Astro](https://astro.build/) で生成する静的サイトです。

## ディレクトリ構成

```
site/                     サイトのソース
├── src/
│   ├── pages/            ページ（URL と 1 対 1 で対応）
│   ├── layouts/          レイアウト（TopLayoutAB：トップ（C2案）／CompareLayout・TopLayout：トップ比較用／SiteLayout・ServiceLayoutD7：D7デザインに移行済みの下層ページ／BaseLayout・ServiceLayout：移行前の下層ページ）
│   ├── components/       共通部品（パンくず・問い合わせ案内・FAQ・カードなど）。components/d7/ は D7 デザインの共通部品（ヘッダー・フッター・固定ボタン・見出し・FAQ など）
│   ├── content/
│   │   ├── cases/        事例（Markdown）
│   │   └── column/       コラム（Markdown）
│   ├── content.config.ts 事例・コラムの項目定義
│   ├── data/             会社情報・サービス・FAQ・プロフィール
│   ├── lib/              URL・構造化データ・日付の補助関数
│   └── styles/           global.css（移行前の下層ページ共通）・top-ab.css（トップ＝C2案）・top.css（旧D7トップ。比較用）・compare.css（比較用の切り替えバー）・d7/（D7 共通基盤：vars＝色・フォント、shell＝ヘッダー/フッター/固定ボタン、base・parts＝下層ページの土台と部品）
├── public/assets/        画像・JavaScript・フォント（そのまま配信。fonts/ は自動生成）
├── fonts/                自前配信フォントの設定・文字一覧・manifest・手順書（fonts/README.md）
├── integrations/         ビルド時の処理（phrase-breaks＝日本語の文節改行 <wbr>／preview-tools＝確認用ページを確認用サイトにだけ入れる）
├── dev-tools/            確認用ページ（動きの比較・ローディングの比較）。確認用サイトにだけ出力され、本番には出ない
└── scripts/              build-pages.mjs＝確認用プレビュー（GitHub Pages）向けのビルド／fonts/＝フォントのサブセット生成・検証
```

リポジトリ直下の HTML（`index.html`・`services/` など）は、`site/` からビルドした確認用の出力です。直接編集しないでください。

## 開発

```sh
cd site
npm install
npm run dev          # 開発用サーバー（http://localhost:4321/）
npm run build        # 本番用ビルド（site/dist/）
npm run build:pages  # 確認用プレビュー向けにビルドし、リポジトリ直下へ出力（確認用ページ dev-preview/ を含む）
npm run build:production # 本番用ビルド（確認用ページが混ざっていないか検査して、混ざっていれば失敗する）
npm run fonts:update # ページ・コラムを追加したら実行：自前配信フォントのサブセットを作り直す（手順は site/fonts/README.md）
```

## 確認用プレビューの設定

- 全ページの上部の「確認用プレビュー」の表示：`site/src/data/site.ts` の `site.preview`（正式公開時は `false`）。
- 検索エンジンへの非公開（noindex）：同じく `site.noindex`（確認用の間は `true`。ここでは変更しない）。
- トップページの比較用ページ（`/compare/` 以下：旧D7・A案・B案・C案・C2案）：`EXCLUDE_COMPARE=1` のビルドでは出力から外れる（`npm run build:pages` は既定で外す）。トップ（`/`）はC2案。ソースは `src/pages/compare/` に残している（開発用ビルドで確認できる）。
- 提案用サンプル（`/samples/`）：`EXCLUDE_SAMPLES=1` のビルドでは出力から外れる（`npm run build:pages` は既定で外す）。ソース・画像は残している。
- お問い合わせフォーム：送信先が未設定の間は「確認用・送信できません」の表示で、送信しない。接続するときは、ビルド時の環境変数
  `PUBLIC_CONTACT_FORM_ENDPOINT`（送信先URL）と `PUBLIC_TURNSTILE_SITE_KEY`（迷惑メール対策の公開サイトキー）を渡す。
  秘密鍵・APIキーは、このリポジトリに含めず、送信を受けるサーバー側の環境変数に置く。
- プライバシーポリシー：`site/src/data/privacy.ts` に、現行サイトの原文をそのまま置いている。変更は、木村様の承認と専門家の確認のあとだけ。

## コンテンツの追加

**ページ・コラム・事例を追加したり、文章を変えたりしたら、`cd site && npm run fonts:update` を実行してください。** 新しい漢字などが自前配信フォントに入っていないと、`npm run build:pages` が止まって知らせます（そのまま公開すると、その文字だけ端末の既定フォントで表示されます）。

- **コラム**：`site/src/content/column/{slug}.md` を追加します（項目は `content.config.ts` を参照）。
- **事例**：`site/src/content/cases/{slug}.md` を追加します。
- **FAQ**：`site/src/data/faq.ts` に追加し、関連するサービスの `relatedFaq` に id を加えます。

関連サービス・関連事例・関連記事のリンクと構造化データは、各ファイルの項目から自動で作られます。

## 日本語の改行（Safari 対応）

CSS の `word-break: auto-phrase` は Chrome だけが対応しています。Safari・Firefox で「始めま／す。」のように語の途中で割れないよう、ビルド時に [BudouX](https://github.com/google/budoux)（Apache-2.0）で文節の切れ目に `<wbr>` を入れています（`site/integrations/phrase-breaks.mjs`。`PHRASE_BREAKS=0` で無効）。

- 配信物に BudouX のコードは含まれません（ビルド時だけ）。`<wbr>` は表示・読み上げ・コピー・検索に影響しません。
- Chrome では `<wbr>` を無効にして（`wbr { display: none }`）従来どおり auto-phrase で改行します。Safari・Firefox では `word-break: keep-all` ＋文節の切れ目（`<wbr>`）で改行します（`d7/shell.css`）。
- 加工したくない場所には `data-no-wbr` を付けます（トップの資格・登録の一覧は、Chrome の約物の詰めを変えないために付けています）。

## 表示の動きの確認ページ（確認用サイト限定）

- `site/dev-tools/dev-preview/`：`/dev-preview/anim/`（動きの比較）・`/dev-preview/loading/`（ローディングの比較。本サイトには未実装）。
- `PREVIEW_TOOLS=1` のときだけ出力に入ります（`npm run build:pages` のみ）。本番用の `npm run build:production` は、混入を検査して失敗させます。`noindex, nofollow`、サイトからはリンクしません。
- 動きの速さ・移動量は `site/src/styles/d7/vars.css` の `--an-*` で決まり、確認用ページはこの変数を書き換えて「修正前」と比べます。
- 動きは、最初の描画のあとに `html.anim-go` が付いてから始まります（Safari で、動きが画面に出る前に終わってしまうのを防ぐため。`d7/shell.css`・各レイアウトの先頭のスクリプト）。
