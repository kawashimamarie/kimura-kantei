// 本番用ビルド（npm run build:production）の後に実行する検査。確認用の仕組みが本番の出力に混ざっていたら失敗させる。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const problems = [];
if (existsSync(join(dist, 'dev-preview'))) problems.push('dev-preview/（確認用ページ）が出力に含まれています');
for (const f of walk(dist)) {
  if (f.includes('/dev-preview/')) problems.push(`確認用ファイル: ${f.slice(dist.length)}`);
  if (f.endsWith('.html') && /dev-preview/.test(readFileSync(f, 'utf8'))) problems.push(`${f.slice(dist.length)} が dev-preview を参照しています`);
}
if (problems.length) { console.error('\n✗ 本番用の出力に確認用の仕組みが混ざっています：\n  - ' + [...new Set(problems)].slice(0, 10).join('\n  - ')); process.exit(1); }
console.log('✓ 本番用の出力の検査に成功（確認用ページの混入なし）');
