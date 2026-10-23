// 既存の GitHub Pages（C2案）に /ra/ を足す前の安全確認。
//   node scripts/check-ra-overlay.mjs <リポジトリのパス> <基準のgit参照（例 origin/feature/top-page-renewal）>
// 次をすべて満たさなければ失敗（終了コード1）：既存ファイルの変更・削除が0／追加はすべて ra/ 以下／ra/index.html が ra/ の外のファイルを参照しない／
// ra/ に先頭が「_」「.」のファイルがない／比較用バー・開発ツールの痕跡がない／noindex がある。
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [repo, ref] = process.argv.slice(2);
if (!repo || !ref) { console.error('使い方: node scripts/check-ra-overlay.mjs <repo> <ref>'); process.exit(1); }
const sh = (c) => execSync(c, { cwd: repo, encoding: 'utf8' });
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };

sh('git add -A -N ra 2>/dev/null || true');
const status = sh(`git diff --name-status ${ref} --`).split('\n').filter(Boolean).map((l) => l.split('\t'));
const nonAdd = status.filter(([s]) => s !== 'A');
const outside = status.filter(([, f]) => !f.startsWith('ra/'));
const untracked = sh('git ls-files --others --exclude-standard').split('\n').filter(Boolean);
ok(nonAdd.length === 0, `既存ファイルの変更・削除が 0（${nonAdd.length}）${nonAdd.map((x) => x.join(' ')).join(', ')}`);
ok(outside.length === 0 && untracked.filter((f) => !f.startsWith('ra/')).length === 0, `追加ファイルはすべて ra/ 以下（${status.length} 件）`);
ok(!status.some(([, f]) => f.split('/').some((p) => /^[_.]/.test(p))), '先頭が「_」「.」のファイル・フォルダがない（Jekyll で除外されるため）');

const htmlPath = join(repo, 'ra/index.html');
ok(existsSync(htmlPath), 'ra/index.html がある');
const html = readFileSync(htmlPath, 'utf8');
const refs = [...html.matchAll(/(?:src|href|srcset)="([^"]+)"|url\(([^)]+)\)/g)].flatMap((m) => (m[1] ?? m[2]).split(',').map((x) => x.trim().split(/\s+/)[0]));
const local = refs.filter((r) => r.startsWith('/'));
ok(local.length > 0 && local.every((r) => r.startsWith('/kimura-kantei/ra/')), `参照するサイト内パスは /kimura-kantei/ra/ 以下だけ（${local.length} 件）`);
ok(local.every((r) => existsSync(join(repo, r.replace('/kimura-kantei/', '').split(/[?#]/)[0]))), '参照先のファイルがすべて存在する');
ok(!/ra-cmp|dev-preview|compare\/c2/.test(html), '比較用バー・開発ツールの痕跡がない');
ok(/<meta name="robots" content="noindex, nofollow">/.test(html), 'noindex がある');
ok(!/ra-pv/.test(html) && !/このサイトは/.test(html.replace(/<wbr>/g, '')), 'サイト説明文「このサイトは〜」（バナー）がない');
ok(!/<form|<input|<textarea/.test(html), 'フォームがない（送信できない）');
ok(!/class="ra-cards tri"/.test(html), 'サービスカードは三角装飾なし（標準）');
const text = html.replace(/<wbr>/g, '');
ok(!/data-pending|preview-note|<dialog|ra-dialog|ra-note|確認用プレビューです/.test(text), '説明ダイアログ（HTML・文言・JS）が残っていない');
const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
ok(hrefs.every((h) => /^(#top|#main|tel:)/.test(h)), `リンクは tel:・#top・#main だけ（未制作ページへのリンクなし）：${[...new Set(hrefs)].join(' ')}`);
if (fails.length) { console.error(`\n✗ ${fails.length} 項目が不合格です。公開しないでください。`); process.exit(1); }
console.log('\n✓ すべて合格');
