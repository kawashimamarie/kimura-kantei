// @ts-check
import { defineConfig } from 'astro/config';
import { readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 確認用プレビュー（GitHub Pages：/kimura-kantei/ 配下）では PREVIEW_BASE を指定してビルドする。
// 本番（https://www.kimurakantei.jp/）では指定しない。
const base = process.env.PREVIEW_BASE || '/';

// EXCLUDE_SAMPLES=1 のビルドでは、提案用サンプル（/samples/ 以下）を出力から外す（確認用プレビュー用）。
// サンプルのソース・画像・図解は src/ と public/ にそのまま残り、環境変数なしのビルド（開発用）では出力される。
const excludeSamples = {
  name: 'exclude-samples',
  hooks: {
    'astro:build:done': ({ dir }) => {
      if (process.env.EXCLUDE_SAMPLES !== '1') return;
      const out = fileURLToPath(dir);
      rmSync(`${out}samples`, { recursive: true, force: true });
      rmSync(`${out}assets/img/samples`, { recursive: true, force: true });
      const chunks = `${out}assets/build`;
      for (const f of readdirSync(chunks)) {
        if (/^(case-suginami-rental-insight|column-inheritance-fair-division|visual|SampleNotice)\./.test(f)) rmSync(`${chunks}/${f}`, { force: true });
      }
    },
  },
};

export default defineConfig({
  integrations: [excludeSamples],
  site: 'https://www.kimurakantei.jp',
  base,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // GitHub Pages（Jekyll）は「_」で始まるフォルダを公開しないため、既定の _astro から変更
    assets: 'assets/build',
  },
});
