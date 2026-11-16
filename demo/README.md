# 確認用デモ（新規集客サービス 2案）

木村不動産鑑定の新しい集客サービスを検討するための、**確認用のデモ**です。正式に公開しているページではありません。
既存の確認用ページ（C2・R-A・R-B）や本番サイトとは独立しており、それらのファイルは参照も変更もしていません。

| 案 | 場所 | 内容 |
|---|---|---|
| 入口 | `index.html` | 2案への入口 |
| A案 | `a-rikon/` | 離婚時の不動産鑑定 ランディングページ（相談予約フォームはデモ表示・非送信） |
| B案 | `b-kachi-check/` | 不動産価値チェック（仮称）のランディングページと、入力から結果の見本までを操作できるデモ |

## 見かた

```sh
cd demo
python3 -m http.server 8810   # http://localhost:8810/
```

ビルドは不要です（静的なHTML・CSS・JavaScript）。`index.html` をブラウザで直接開いても動きます。

## 守っていること

- **外部への通信なし**：フォント・画像・スクリプトはすべてこのフォルダ内。外部のCDN・解析・AIのAPIは使っていません。
- **入力内容の保存・送信なし**：Cookie・localStorage 等を使わず、フォームは送信しません（`js/a.js`・`js/b.js` の冒頭に明記）。
- **B案は価格を計算しません**：結果画面の数値は `b-kachi-check/js/b.js` に書いた架空の固定値で、入力内容とは連動しません。結果画面には、見本であることを常に表示します。
- **未確認の情報は掲載を保留**：金額の目安、電話の受付時間、経歴・実績などは、確認が取れるまで載せていません（画面では点線の「デモ」注記で示しています）。架空の実績・お客様の声は作っていません。
- 検索エンジンに登録させないため、全ページに `noindex, nofollow` を付けています。

## 素材と権利

| 素材 | 出どころ・権利 |
|---|---|
| 書体（A案）Zen Old Mincho／Zen Kaku Gothic New | SIL Open Font License 1.1。使用文字だけのサブセットを同梱。ライセンス全文は `a-rikon/fonts/OFL-*.txt` |
| 書体（B案）M PLUS 2 | SIL Open Font License 1.1。同上（`b-kachi-check/fonts/OFL-mplus2.txt`） |
| 図・イラスト | このデモのために描き下ろしたSVG・CSS。AI生成画像・ストック写真は使っていません |
| ロゴ・代表者の写真 | このリポジトリの既存の確認用ページで使用しているものと同じファイル |

## 作り直すとき

```sh
pip install fonttools brotli
python3 demo/_tools/build_fonts.py --src <元フォントのフォルダ>   # 文章を変えたら実行（使用文字のサブセットを作り直す）
node demo/_tools/gen_town.js                                      # B案の街並みSVGを作り直す
node demo/_tools/verify.js http://localhost:8810/ verify.json     # 実ブラウザでの技術検証（要 playwright・axe-core）
```

元フォント（TTF）は容量が大きいためリポジトリに含めていません。Google Fonts の公開リポジトリ（`google/fonts` の `ofl/zenoldmincho`・`ofl/zenkakugothicnew`・`ofl/mplus2`）から取得します。
