# 確認用デモ｜新規集客LP 2案

木村不動産鑑定の新規集客サービス2案の**確認用デモ**です。公開しているページではありません。

| 案 | 場所 | 内容 |
|---|---|---|
| 入口 | `index.html` | 2案への入口 |
| A案 | `a-rikon/` | 離婚・財産分与のための不動産鑑定LP（相談予約フォームはデモ表示・非送信） |
| B案 | `b-kachi-check/` | 不動産価値チェック（仮称）LPと、入力から結果の見本まで操作できるデモ |
| 画面 | `screenshots/` | PC（1440px）・スマホ（390px）のファーストビューと全体、B案の操作画面 |

## 見かた

```sh
cd design/fable-demo
python3 -m http.server 8820   # http://localhost:8820/
```

ビルドは不要です（静的なHTML・CSS・JavaScript、フレームワークなし）。

## このデモについて

- 外部への通信はありません（フォント・画像・スクリプトはすべてフォルダ内）。
- フォームは送信されず、入力内容は保存されません（Cookie・localStorage 等は不使用）。
- B案は価格を計算しません。結果の見本はHTMLに書いた固定の架空データで、入力内容と連動しません。
- 掲載内容は確認前の案です。確認前の項目は、画面上で「デモ」の注記を付けて掲載を保留しています。
- 全ページに `noindex, nofollow` を付けています。

## 素材と権利

| 素材 | 出どころ・権利 |
|---|---|
| しっぽり明朝／Zen Kaku Gothic New／IBM Plex Sans JP | SIL Open Font License 1.1。使用文字だけのサブセットを同梱（各 `fonts/OFL-*.txt`） |
| 図（図面・区画図・帳票・グラフ） | このデモのために描いたSVG・CSS。図面と区画図は架空のもの |
| ロゴ・ファビコン | 木村不動産鑑定のロゴ |

## 作り直すとき

```sh
pip install fonttools brotli
python3 _tools/build_fonts.py --src <元TTFのフォルダ>   # 文章を変えたら実行（使用文字のサブセットを作り直す）
node _tools/gen_map.js                                   # B案FVの区画図SVG（index.html に貼り込み済み）
node _tools/verify.js http://localhost:8820/ out.json    # 実ブラウザでの動作検証（要 playwright）
```

元フォント（TTF）は含めていません。Google Fonts の公開リポジトリ（`google/fonts` の `ofl/shipporimincho`・`ofl/zenkakugothicnew`・`ofl/ibmplexsansjp`）から取得します。
