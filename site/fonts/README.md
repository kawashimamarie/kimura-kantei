# 自前配信フォント

Noto Sans JP・Shippori Mincho B1・Inter を、サイトのサーバーから直接配信しています（Google Fonts は使いません）。
配信する WOFF2 は、**サイトに実際に表示される文字だけ**に絞ったサブセットです。ページやコラムを追加したら、下の手順でサブセットを作り直します。

## ファイルの置き場所

| 場所 | 内容 | Git に含める |
|---|---|---|
| `fonts/fonts.config.json` | 書体・ウェイト・基本文字セットの定義 | ○ |
| `fonts/sources.json` | 元フォントの取得元（google/fonts の固定コミット）・バージョン・sha256・ライセンス | ○ |
| `fonts/charset.json` | サイトで使われている文字の一覧（書体ごと）。文章が変わると差分が出るのでレビューできる | ○ |
| `fonts/manifest.json` | 生成したフォントのファイル名・容量・ハッシュ・収録範囲・使用ツールのバージョン | ○ |
| `public/assets/fonts/*.woff2` | 配信するサブセット（ファイル名に内容のハッシュ付き。再生成で古いものは自動削除） | ○ |
| `public/assets/fonts/licenses/OFL-*.txt` | SIL Open Font License 1.1 の全文（再配布の条件として同梱） | ○ |
| `src/styles/d7/fonts.css` | `@font-face`（**自動生成**。手で編集しない） | ○ |
| `.font-cache/` | 元フォント（TTF、各 10〜15MB）。`fonts:fetch` で取得 | ×（.gitignore） |
| `.fonts-tmp/` | 文字の収集用の一時ビルド | × |
| `.venv-fonts/` | Python 仮想環境（fonttools） | × |

## 初回セットアップ（フォントを再生成する人だけ。ふだんのビルド・公開には不要）

| 必要なもの | 確認済みのバージョン | 備考 |
|---|---|---|
| Node.js / npm | v22.22.0 / 10.9.4 | Astro と同じ環境 |
| Python | 3.13（3.9 以上で動く想定） | フォントを作り直すときだけ |
| fonttools / brotli | 4.67.0 / 1.2.0 | `fonts/requirements.txt` で固定。`fonts:setup` が専用の仮想環境 `.venv-fonts` に入れる |
| playwright-core | 1.56.1 | `package.json` の devDependency。**ブラウザ本体は含まれない** |
| Chromium | Playwright 1.56.1 付属のビルド（chromium-1194） | 下の「ブラウザ」参照 |
| 元フォント（TTF 4 ファイル） | `fonts/sources.json` の sha256 のとおり | `fonts:fetch`（`fonts:update` に含まれる）が取得して sha256 を検証 |

```sh
cd site
npm install            # playwright-core を含む依存を、package-lock.json のとおりに入れる
npm run fonts:setup    # Python 仮想環境（.venv-fonts）と fonttools / brotli
npm run fonts:doctor   # Python・fonttools・Chromium・元フォントの準備状況を確認
npm run fonts:update   # 初回は元フォントも取得される
```

**ブラウザ（Chromium）**：文字の収集に使います。次のどれかで用意してください。
1. すでに Playwright 用の Chromium がある環境（Claude Code のクラウド環境など）：そのまま使えます（`PLAYWRIGHT_BROWSERS_PATH` を参照）。
2. 新しい環境：`npx playwright-core install chromium`（ダウンロードします）。
3. 別に入っている Chromium を使う：環境変数 `FONTS_CHROMIUM` に実行ファイルのパスを指定。
別の場所にある Playwright のモジュールを使うときは `FONTS_PLAYWRIGHT`（例：`/opt/node-tools/node_modules/playwright-core`）。

**確認済みの再現手順**：まっさらな clone で、上の手順だけ（`npm install` → `fonts:setup` → `fonts:update`）を実行し、コミット済みの `charset.json`・`manifest.json`・WOFF2・`fonts.css`・公開用ビルド出力と**差分 0** になることを確認しています。`npm run build:pages` は Python・Chromium がなくても実行できます（収録確認はブラウザ不要）。

## ページ・コラムを追加した／文章を変えたとき

```sh
cd site
npm run fonts:update   # 取得 → 文字の収集 → サブセット生成 → 検証 をまとめて実行
git diff --stat        # charset.json に新しい文字、public/assets/fonts に新しい WOFF2 ができる
```

- `fonts:update` は、公開用と同じ設定でサイトをビルドし、全ページを**ブラウザで開いて**、実際に使われる書体・太さごとに文字を集めます。Astro が生成する文章も、Markdown・JSON・データファイルの文章も、表示されるものはすべて対象です。

### 文字を集める範囲（網羅性）

| 文字の出どころ | 集め方 |
|---|---|
| 全22ページ（404 を含む）の本文 | 全ページを開き、文字ごとに「実際に適用される書体・太さ」を取得（継承・`font-family` の後ろの候補も反映） |
| 開閉するもの（`<details>`、スマホのメニュー、`hidden` の送信完了画面、画面幅で隠れる要素） | 表示されていなくても、DOM の文字とスタイルから取得（スマホ幅・PC幅の2回） |
| JavaScript で表示される文字（エラーメッセージなど） | ページ内・外部の JS の**文字列リテラル**（コメントは除く）を、本文の書体として追加 |
| JavaScript オフのときだけ出る文字（`<noscript>`） | JavaScript オフでも全ページを開く |
| 擬似要素（`::before`/`::after`/`::marker` の `content`） | 適用中のものを取得。`:hover` など状態でだけ出るものは、CSS の `content` の文字列リテラルから追加 |
| プレースホルダー・`data-*` 属性 | 取得して追加（JS が表示に使う場合に備えて、日本語を含む `data-*` はすべて） |
| Markdown・JSON・`src/data` の文章 | ビルド後の HTML に出る時点で上に含まれる |
| **集められない文字**（実行時に外部から届く文章など） | `fonts/extra-chars.txt` に手で書く（書式は同ファイル）。`fonts:update` が取り込む |

**表示されない状態の文字の見つけ方**：ブラウザで見えない文字は「表示」ではなく「DOM とスタイル」から集めるので、閉じた状態・隠れた状態でも漏れません。HTML・属性・スクリプト・CSS のどこにも書かれない文字（サーバーから届く文章など）は、構造上自動では分からないため、`extra-chars.txt` に書いてください。書き忘れた場合、その文字は端末の既定フォントで表示されます（文字化けや欠けにはなりません）。
テンプレート文字列の `${}` の中身のような、実行しないと決まらない文字も同じ扱いです。

- 容量の増減は `fonts:update` の最後と `npm run fonts:stats`（`-- --base <git ref>` でその時点との差分）で確認できます。
- 生成結果は再現できます（同じ文字・同じ元フォント・同じ fonttools なら同じバイト列）。

### うっかり再生成を忘れても

`npm run build:pages` の途中で「サブセットに入っていない文字」を自動で確認し、見つかるとビルドを止めて `npm run fonts:update` を促します（ブラウザ不要の簡易確認。本文・`data-*` 属性・スクリプトの文字列・CSS の `content` を見ます。「ある文字が、どの書体で表示されるか」までは見ないので、厳密な確認は `fonts:check`）。
より厳密な確認（書体ごとの収録・Google Fonts への参照がないこと・ライセンス同梱）は `npm run fonts:check` です。

## 表示を以前（Google Fonts）と同じに保つ設定

自前配信に切り替えても見た目が変わらないよう、次の点を以前の配信に合わせています（`fonts.config.json` に記載）。

- **OpenType 機能（`layoutFeatures`）**：以前の配信が持っていた機能だけを収録。Noto Sans JP は `halt`・`palt` などを持ち、Shippori Mincho B1 の日本語部分は `vert`/`vpal`/`vrt2` だけでした。Shippori に `palt` を足すと、トップの見出し（CSS に `font-feature-settings: "palt"` がある）の字間が詰まって表示が変わるため、足していません。
- **Inter の太さ**：以前は 500・600 だけを配信し、400・700 の文字は近い太さで表示されていました。同じになるよう 500〜600 に絞っています。

## 文字が収録できない場合の方針

元フォントに字形がない文字（ごく稀な記号・異体字など）は、サブセットにも入りません。その文字だけ、端末の既定の日本語フォント（CSS の font-family の後ろに書いてある Hiragino・Yu Gothic・Meiryo など）で表示されます。
`fonts:update` / `fonts:check` は、そのような文字を「⚠ 元フォントに字形がない文字」として表示します（エラーにはしません）。`manifest.json` の `unavailable` にも記録されます。

## 自前フォントを使っていない文字

`<button>` は font-family を引き継がない（ブラウザ既定の Arial 系になる）ため、現在のサイトでは「MENU」「送信する」「入力画面に戻る」などのボタン文字は、もともと自前フォント（以前は Google Fonts）ではなく端末の既定フォントで表示されています。デザインは変えず、そのままにしています。
こうした文字は `charset.json` の `systemFontOnly` に記録され、サブセットには含めません（`build:pages` の簡易確認でも対象外）。ボタンにも本文の書体を使うように CSS を変えたときは、`npm run fonts:update` で自動的にサブセットへ入ります。

## ウェイトや書体を増やすとき

1. `fonts/fonts.config.json` に face を追加（可変フォントは `range` と `instance` で太さの範囲を絞る）
2. 元フォントを使う場合は `fonts/sources.json` に URL・sha256・ライセンスを追加し、ライセンス全文を `public/assets/fonts/licenses/` に置く
3. `npm run fonts:update`

使っていない太さを増やさないでください（容量が増えます）。

## 元フォント・ライセンス

| 書体 | バージョン | 取得元 | ライセンス |
|---|---|---|---|
| Noto Sans JP | 2.004-H2（可変、太さ 400〜700 のみ使用） | google/fonts `ofl/notosansjp`（元は notofonts/noto-cjk） | SIL OFL 1.1（予約名 'Source'：本サイトでは「Noto Sans JP」の名前のまま配信し、'Source' を名乗らない） |
| Shippori Mincho B1 | 3.110（Bold・ExtraBold のみ使用） | google/fonts `ofl/shipporiminchob1`（元は fontdasu/ShipporiMincho） | SIL OFL 1.1 |
| Inter | 4.001（可変、opsz 14・太さ 500〜600 のみ使用） | google/fonts `ofl/inter`（元は rsms/inter） | SIL OFL 1.1 |

取得元は google/fonts のコミット `45e3d5269e4a17d823f6d84470bc084dc5ae46f6`（2026-10-22 時点）に固定し、sha256 で検証しています。
OFL は、サブセット化・Web 埋め込み・商用サイトでの利用を認めています。条件は、ライセンス全文と著作権表示を同梱すること、フォント単体で販売しないことです。

## 配信（お名前.com など Apache のサーバー）

- `.woff2` の MIME タイプは `font/woff2` です。サーバーが未対応なら `.htaccess` に `AddType font/woff2 .woff2` を足してください。
- ファイル名にハッシュが入っているので、`Cache-Control: max-age=31536000, immutable` のような長期キャッシュにできます（フォントを作り直すとファイル名が変わります）。
- `@font-face` の URL は `/assets/fonts/…`（ルート配信）です。GitHub Pages の確認用ビルド（`/kimura-kantei/`）では、Astro が自動でベースパスを付けます。

## ツール選定の記録（Python fonttools か Node.js か）

- **fonttools（Python）を採用**：可変フォントの太さ・opsz の範囲を絞る（instancer）、OpenType 機能の取捨、WOFF2 出力、ハッシュまで再現できる出力、と必要なことが揃っていて、Google Fonts 自身の標準ツールでもあります。
- Node.js の `subset-font`（harfbuzz）は軽くて導入が簡単ですが、可変フォントの軸の範囲を絞れず、可変の Noto Sans JP が大きくなります。
- 文字の収集・検証・ビルドへの組み込みは Node.js（Astro と同じ環境）で書き、Python が必要なのは「フォントを作り直すときだけ」にしています。通常のビルド・公開には Python は不要です（生成済みの WOFF2 をコミットしているため）。
