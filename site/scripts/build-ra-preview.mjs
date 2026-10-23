// R-A案トップページだけを、単独の確認用サイト（別リポジトリの GitHub Pages）として書き出す。
//   cd site && npm run build:ra-preview -- <出力先フォルダ> [ベースパス（既定 /kimura-kantei-ra-preview）]
// 出力先には、トップの index.html と、そのページが実際に読み込む CSS・フォント・画像だけを置く（比較用バー・開発ツール・他のページは含めない）。
// 未制作の下層ページへのリンクは「確認用プレビューです」の案内に置き換わる（RA_PREVIEW=1）。C2案の公開物（リポジトリ直下）には影響しない。
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
const base = (process.argv[3] || '/kimura-kantei-ra-preview').replace(/\/$/, '');
if (!out) { console.error('出力先フォルダを指定してください'); process.exit(1); }
const dist = join(site, '.ra-dist');
rmSync(dist, { recursive: true, force: true });
execSync(`npx astro build --outDir ${dist}`, { cwd: site, stdio: 'inherit', env: { ...process.env, PREVIEW_BASE: base, RA_PREVIEW: '1' } });

const src = join(dist, 'compare/ref-a/index.html');
let html = readFileSync(src, 'utf8');
if (/dev-preview|ra-cmp|compare\//.test(html.replace(/<script type="application\/ld\+json">.*?<\/script>/s, ''))) throw new Error('比較用の要素が残っています');

// 出力先を空にしてから、ページが参照するファイルだけをコピーする（.git は残す）
mkdirSync(out, { recursive: true });
for (const n of readdirSync(out)) if (n !== '.git') rmSync(join(out, n), { recursive: true, force: true });
const copied = new Set();
const copyRef = (ref) => {
  const clean = ref.split(/[?#]/)[0];
  if (!clean.startsWith(base + '/')) return;
  const rel = clean.slice(base.length + 1);
  if (!rel || copied.has(rel)) return;
  const from = join(dist, rel);
  if (!existsSync(from) || statSync(from).isDirectory()) return;
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  cpSync(from, join(out, rel));
  copied.add(rel);
  if (rel.endsWith('.css')) {
    const css = readFileSync(from, 'utf8');
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) copyRef(m[1].startsWith('/') ? m[1] : base + '/' + join(dirname(rel), m[1]));
  }
};
for (const m of html.matchAll(/(?:src|href|srcset|content)="([^"]+)"/g)) for (const part of m[1].split(',')) copyRef(part.trim().split(/\s+/)[0]);
for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) copyRef(m[1]);
// フォントのライセンス（SIL OFL）も同梱する
if (existsSync(join(dist, 'assets/fonts/licenses'))) { mkdirSync(join(out, 'assets/fonts'), { recursive: true }); cpSync(join(dist, 'assets/fonts/licenses'), join(out, 'assets/fonts/licenses'), { recursive: true }); }
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, '.nojekyll'), '');
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(out, '404.html'), `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>確認用プレビュー｜株式会社木村不動産鑑定</title><style>body{font-family:sans-serif;margin:0;padding:64px 24px;line-height:2;color:#141414;text-align:center}a{color:#1a385f}</style></head><body><h1 style="font-size:20px;color:#1a385f">確認用プレビューです</h1><p>このページは制作していません。<br>トップページ（確認用）は<a href="${base}/">こちら</a>です。</p></body></html>`);
writeFileSync(join(out, 'README.md'), `# 木村不動産鑑定 R-A案トップページ（確認用プレビュー）\n\n公開サイトではありません（noindex）。トップページのデザイン確認用の書き出しです。\n\nソース：kawashimamarie/kimura-kantei の design/ref-sogo-top（site/ で \`npm run build:ra-preview\`）。このリポジトリのファイルは自動生成物のため、直接編集しないでください。\n`);
rmSync(dist, { recursive: true, force: true });
console.log(`✓ ${copied.size} ファイル＋index.html などを ${out} に書き出しました（ベース ${base}）`);
