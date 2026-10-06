// @ts-check
import { defineConfig } from 'astro/config';

// 確認用プレビュー（GitHub Pages：/kimura-kantei/ 配下）では PREVIEW_BASE を指定してビルドする。
// 本番（https://www.kimurakantei.jp/）では指定しない。
const base = process.env.PREVIEW_BASE || '/';

export default defineConfig({
  site: 'https://www.kimurakantei.jp',
  base,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // GitHub Pages（Jekyll）は「_」で始まるフォルダを公開しないため、既定の _astro から変更
    assets: 'assets/build',
  },
});
