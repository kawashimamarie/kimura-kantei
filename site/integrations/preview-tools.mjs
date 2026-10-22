// 確認用ページ（動きの確認・ローディングの比較）を、確認用サイトの出力にだけ入れる。
//
// 本番には絶対に出さないための仕組み：
//  1. 環境変数 PREVIEW_TOOLS=1 のときだけ、dev-tools/dev-preview/ を dist/dev-preview/ にコピーする（既定はコピーしない）。
//     npm run build:pages（確認用サイト用）だけが PREVIEW_TOOLS=1 を付ける。npm run build（本番用）は付けない。
//  2. 本番用は npm run build:production（ビルド後に scripts/check-production.mjs が dev-preview の混入を検査して失敗させる）。
//  3. 確認用ページは noindex, nofollow で、サイトのどこからもリンクしない。
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function previewTools() {
  return {
    name: 'preview-tools',
    hooks: {
      'astro:build:done': ({ dir }) => {
        if (process.env.PREVIEW_TOOLS !== '1') return;
        const src = fileURLToPath(new URL('../dev-tools/dev-preview', import.meta.url));
        if (!existsSync(src)) return;
        cpSync(src, join(fileURLToPath(dir), 'dev-preview'), { recursive: true });
        console.log('[preview-tools] 確認用ページ（dev-preview/）を出力に追加しました（確認用サイトのみ）');
      },
    },
  };
}
