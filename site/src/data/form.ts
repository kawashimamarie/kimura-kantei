// お問い合わせフォームの接続設定。
// 送信先（エンドポイント）と Turnstile のサイトキーは、ビルド時の環境変数で渡す。どちらも未設定の間は「確認用・送信できません」の表示になる。
// 秘密鍵・APIキーはここに書かない（公開ソースに含めない）。送信を受けるサーバー側（別途構築）の環境変数に置く。
//   PUBLIC_CONTACT_FORM_ENDPOINT … 送信先のURL（例：https://example.invalid/api/contact）
//   PUBLIC_TURNSTILE_SITE_KEY   … 迷惑メール対策（Cloudflare Turnstile）の公開サイトキー
const env = import.meta.env;
const endpoint = String(env.PUBLIC_CONTACT_FORM_ENDPOINT ?? '').trim();

export const formConfig = {
  endpoint,
  enabled: endpoint !== '',
  turnstileSiteKey: String(env.PUBLIC_TURNSTILE_SITE_KEY ?? '').trim(),
  previewNotice: '確認用プレビューのため、現在フォーム送信はできません。',
};
