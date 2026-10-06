// 確認用プレビュー（GitHub Pages）向けのビルド。
// GitHub Pages は feature/top-page-renewal ブランチのリポジトリ直下を公開しているため、
// site/dist の内容をリポジトリ直下へ同期する。
//
// 安全のため、前回このスクリプトが出力したファイル（site/.pages-manifest.json に記録）だけを削除し、
// それ以外のファイル（site/・README.md・_config.yml など）には触れない。
//
// 使い方：cd site && npm run build:pages
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(siteDir, '..');
const distDir = join(siteDir, 'dist');
const manifestPath = join(siteDir, '.pages-manifest.json');

if (!process.env.PREVIEW_BASE) {
  console.error('PREVIEW_BASE が指定されていません（例：PREVIEW_BASE=/kimura-kantei）');
  process.exit(1);
}

execSync('npx astro build', { cwd: siteDir, stdio: 'inherit' });

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });

// Markdown 本文中のサイト内リンク（"/" 始まり）にも base を付ける。
// コンポーネント側のリンクは u() で付与済みなので、base で始まらないものだけを対象にする。
const base = process.env.PREVIEW_BASE.replace(/\/$/, '');
const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rootRelative = new RegExp(`(href|src)="/(?!/|${escaped.slice(1)}/)`, 'g');
for (const f of listFiles(distDir).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8');
  const fixed = html.replace(rootRelative, `$1="${base}/`);
  if (fixed !== html) writeFileSync(f, fixed);
}

// 前回の出力を削除
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
for (const rel of previous) {
  if (rel.startsWith('site/') || rel.includes('..')) continue; // 念のため
  rmSync(join(repoRoot, rel), { force: true });
}

// 今回の出力をコピー
const files = listFiles(distDir).map((f) => relative(distDir, f));
cpSync(distDir, repoRoot, { recursive: true });
writeFileSync(manifestPath, JSON.stringify(files.sort(), null, 2) + '\n');

// 空になったフォルダを掃除
const pruneEmpty = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory() && !['.git', 'site', 'node_modules', '.private'].includes(name)) {
      pruneEmpty(p);
      if (readdirSync(p).length === 0) rmSync(p, { recursive: true });
    }
  }
};
pruneEmpty(repoRoot);

console.log(`\nGitHub Pages 用に ${files.length} ファイルをリポジトリ直下へ出力しました。`);
