// 自前配信フォントの管理コマンド（使い方は fonts/README.md）。
//   node scripts/fonts/cli.mjs fetch     元フォントを取得し、sha256 を検証する
//   node scripts/fonts/cli.mjs collect   サイトをビルドし、実際に表示される文字を書体ごとに収集して fonts/charset.json に書く
//   node scripts/fonts/cli.mjs subset    charset.json からサブセット（WOFF2）・manifest.json・fonts.css を生成する（Python / fonttools）
//   node scripts/fonts/cli.mjs update    fetch → collect → subset → check をまとめて実行する
//   node scripts/fonts/cli.mjs check     最新のビルドの全文字が、いまのフォントに収録されているか検証する（ブラウザを使う）
//   node scripts/fonts/cli.mjs guard     check の簡易版。ブラウザなしで「収録されていない文字」だけを見る（build:pages が実行する）
//   node scripts/fonts/cli.mjs stats     フォントの容量を表示する（--base <git ref> でその時点との差分も表示）
//   node scripts/fonts/cli.mjs doctor    再生成に必要な環境（Python・fonttools・Chromium・元フォント）を確認する
// 共通オプション: --dist <dir>  すでにあるビルド結果を使う（省略時は .fonts-tmp/dist に公開用設定でビルドする）
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = JSON.parse(readFileSync(join(SITE, 'fonts/fonts.config.json'), 'utf8'));
const sources = JSON.parse(readFileSync(join(SITE, 'fonts/sources.json'), 'utf8'));
const CACHE = join(SITE, '.font-cache');
const TMP = join(SITE, '.fonts-tmp');
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const die = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1); };
const cp = (c) => c.codePointAt(0);

// ---------- 収録範囲の読み書き ----------
const parseRanges = (s) => {
  const set = new Set();
  if (!s) return set;
  for (const part of s.split(',')) {
    const [a, b] = part.split('-').map((h) => parseInt(h, 16));
    for (let c = a; c <= (b ?? a); c++) set.add(c);
  }
  return set;
};
const loadManifest = () => {
  const p = join(SITE, 'fonts/manifest.json');
  if (!existsSync(p)) die('fonts/manifest.json がありません。npm run fonts:update を実行してください。');
  return readJson(p);
};
const coverageByFace = (manifest) => Object.fromEntries(Object.entries(manifest.faces).map(([id, f]) => [id, parseRanges(f.coverage)]));

// ---------- fetch ----------
async function fetchSources() {
  mkdirSync(CACHE, { recursive: true });
  for (const s of Object.values(sources.sources)) {
    const path = join(CACHE, s.file);
    if (existsSync(path) && sha256(readFileSync(path)) === s.sha256) { console.log(`✓ キャッシュ済み  ${s.file}`); continue; }
    console.log(`↓ 取得  ${s.file}`);
    const res = await fetch(s.url);
    if (!res.ok) die(`${s.url} の取得に失敗しました（HTTP ${res.status}）`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (sha256(buf) !== s.sha256) die(`${s.file} の sha256 が sources.json と一致しません。取得元が変わった可能性があります。`);
    writeFileSync(path, buf);
  }
  for (const [name, l] of Object.entries(sources.licenses)) {
    const p = join(SITE, cfg.licensesDir, name);
    if (!existsSync(p) || sha256(readFileSync(p)) !== l.sha256) die(`ライセンスファイルがありません、または内容が違います: ${cfg.licensesDir}/${name}`);
  }
  console.log('✓ 元フォントとライセンスファイルを確認しました');
}

// ---------- ビルドと静的サーバー ----------
function buildSite() {
  const dist = join(TMP, 'dist');
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const env = { ...process.env, EXCLUDE_SAMPLES: '1', EXCLUDE_COMPARE: '1' };
  delete env.PREVIEW_BASE; // ルート配信（本番と同じ）でビルドする
  console.log('… 公開用設定でビルド中（.fonts-tmp/dist）');
  const r = spawnSync('npx', ['astro', 'build', '--outDir', dist], { cwd: SITE, env, stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) die('astro build に失敗しました');
  return dist;
}
const distDir = () => (opt('--dist') ? resolve(opt('--dist')) : buildSite());

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function serve(root) {
  const server = createServer((req, res) => {
    let p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(readFileSync(p));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}
async function loadPlaywright() {
  try { return await import('playwright-core'); } catch { /* 下へ */ }
  const alt = process.env.FONTS_PLAYWRIGHT; // 例: /opt/node-tools/node_modules/playwright-core
  if (alt) return createRequire(import.meta.url)(alt);
  die('playwright-core が見つかりません（npm install、または FONTS_PLAYWRIGHT にパスを指定）。');
}

// ---------- 文字の収集 ----------
// JS・CSS の中の文字列リテラル（コメントは除く）から非 ASCII 文字を拾う
function stringLiteralChars(code, isCss) {
  const chars = new Set();
  const add = (s) => { for (const ch of s) if (cp(ch) > 0x7f) chars.add(ch); };
  if (isCss) { for (const m of code.matchAll(/content\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) add(m[1]); return chars; }
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; }
    else if (c === '/' && code[i + 1] === '*') { i = code.indexOf('*/', i + 2); i = i < 0 ? code.length : i + 2; }
    else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c) { if (code[j] === '\\') j++; j++; }
      add(code.slice(i + 1, j)); i = j + 1;
    } else i++;
  }
  return chars;
}

// fonts/extra-chars.txt：ブラウザでは集められない文字（実行時に外部から届く文章など）を、手で足すための一覧。
// 書式：1行に「書体ID: 文字」（書体IDは fonts.config.json の id。* は全書体）。# で始まる行はコメント。
function extraChars() {
  const p = join(SITE, 'fonts/extra-chars.txt');
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w*-]+)\s*:\s*(.+?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    if (m[1] !== '*' && !cfg.faces.some((f) => f.id === m[1])) die(`fonts/extra-chars.txt の書体ID「${m[1]}」が fonts.config.json にありません`);
    out[m[1]] = (out[m[1]] ?? '') + m[2].replace(/\s/g, '');
  }
  return out;
}

const faceFor = (faces, weight) => {
  const dist = (f) => (weight < f.range[0] ? f.range[0] - weight : weight > f.range[1] ? weight - f.range[1] : 0);
  return [...faces].sort((a, b) => dist(a) - dist(b) || b.range[1] - a.range[1])[0];
};

async function collectChars(dist) {
  const { chromium } = await loadPlaywright();
  const { server, port } = await serve(dist);
  const browser = await chromium.launch(process.env.FONTS_CHROMIUM ? { executablePath: process.env.FONTS_CHROMIUM } : {});
  const sets = Object.fromEntries(cfg.faces.map((f) => [f.id, new Set()]));
  const usage = {};
  const other = new Set(); // 自前配信フォントを使わない要素の文字（例：font-family を引き継がない <button>。端末の既定フォントで表示される）
  const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
  const pageFn = () => {
    const out = [];
    const style = (el) => { const cs = getComputedStyle(el); return [cs.fontFamily, parseInt(cs.fontWeight, 10) || 400]; };
    const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest('head,script,style,template')) continue;
      const t = n.data.replace(/\s+/g, '');
      if (t) out.push([...style(p), t]);
    }
    for (const el of document.body.querySelectorAll('*')) {
      for (const ps of ['::before', '::after', '::marker']) {
        const cs = getComputedStyle(el, ps);
        const c = cs.content;
        if (!c || c === 'none' || c === 'normal') continue;
        let t = '';
        for (const m of c.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|attr\(([^)]+)\)/g)) {
          if (m[3]) t += el.getAttribute(m[3].trim()) || '';
          else t += (m[1] ?? m[2]).replace(/\\([0-9a-fA-F]{1,6}) ?|\\(.)/g, (x, h, ch) => (h ? String.fromCodePoint(parseInt(h, 16)) : ch));
        }
        if (t) out.push([cs.fontFamily, parseInt(cs.fontWeight, 10) || 400, t]);
      }
      if (el.placeholder) out.push([...style(el), el.placeholder]);
      for (const a of el.attributes) if (a.name.startsWith('data-') && /[^\x00-\x7f]/.test(a.value)) out.push([...style(el), a.value]); // JS が表示に使う可能性がある
    }
    const scripts = [...document.querySelectorAll('script:not([type="application/ld+json"])')].map((s) => s.textContent).join('\n');
    const styles = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n'); // 小さなCSSはHTMLに埋め込まれる
    return { out, scripts, styles };
  };
  const addText = (famList, weight, text) => {
    const fams = famList.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    if (!fams.some((f) => cfg.faces.some((x) => x.family === f))) for (const ch of text) if (!/\s/.test(ch)) other.add(ch);
    for (const fam of fams) {
      const faces = cfg.faces.filter((f) => f.family === fam);
      if (!faces.length) continue;
      const face = faceFor(faces, weight);
      for (const ch of text) if (!/\s/.test(ch)) sets[face.id].add(ch);
      usage[`${fam} ${weight}`] = (usage[`${fam} ${weight}`] ?? 0) + text.length;
    }
  };
  const scriptChars = new Set();
  const modes = [[390, 844, true], [1440, 900, true], [390, 844, false], [1440, 900, false]]; // 幅 × JavaScript の有無（noscript の中身も拾う）
  for (const [w, h, js] of modes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: js, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const f of htmlFiles) {
      const rel = f.slice(dist.length).replace(/index\.html$/, '');
      await page.goto(`http://127.0.0.1:${port}${rel}`, { waitUntil: 'load' });
      const { out, scripts, styles } = await page.evaluate(pageFn);
      for (const [fam, wt, t] of out) addText(fam, wt, t);
      for (const ch of stringLiteralChars(scripts, false)) scriptChars.add(ch);
      for (const ch of stringLiteralChars(styles, true)) scriptChars.add(ch);
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  for (const f of walk(dist)) {
    if (f.endsWith('.js')) for (const ch of stringLiteralChars(readFileSync(f, 'utf8'), false)) scriptChars.add(ch);
    if (f.endsWith('.css')) for (const ch of stringLiteralChars(readFileSync(f, 'utf8'), true)) scriptChars.add(ch);
  }
  for (const ch of scriptChars) sets[cfg.scriptStringsFace].add(ch); // 画面表示用の文字列は本文の書体で表示される
  const extra = extraChars();
  for (const [face, chars] of Object.entries(extra)) for (const ch of chars) for (const f of face === '*' ? cfg.faces : cfg.faces.filter((x) => x.id === face)) sets[f.id].add(ch);
  return { sets, usage, other, pages: htmlFiles.length, scriptChars: scriptChars.size };
}

const chunk = (s, n) => (s.match(new RegExp(`.{1,${n}}`, 'gu')) ?? []);
async function collect() {
  const dist = distDir();
  const { sets, usage, other, pages, scriptChars } = await collectChars(dist);
  const faces = {};
  for (const f of cfg.faces) {
    const chars = [...sets[f.id]].sort((a, b) => cp(a) - cp(b)).join('');
    faces[f.id] = { count: [...chars].length, chars: chunk(chars, 64) };
  }
  const usageSorted = Object.fromEntries(Object.entries(usage).sort());
  const otherChars = [...other].sort((a, b) => cp(a) - cp(b)).join('');
  writeFileSync(join(SITE, 'fonts/charset.json'), JSON.stringify({ pages, scriptStringChars: scriptChars, usage: usageSorted, faces, systemFontOnly: { count: [...otherChars].length, chars: chunk(otherChars, 64) } }, null, 2) + '\n');
  console.log(`✓ fonts/charset.json を更新（${pages} ページ、自前フォントを使わない要素の文字 ${[...otherChars].length} 字）`);
  for (const [id, f] of Object.entries(faces)) console.log(`   ${id.padEnd(26)} ${f.count} 文字`);
  console.log('   使われているウェイト（書体 太さ: 文字数）:', JSON.stringify(usageSorted));
  return dist;
}

// ---------- subset（Python） ----------
function subset() {
  const venv = join(SITE, '.venv-fonts/bin/python');
  const py = existsSync(venv) ? venv : 'python3';
  const r = spawnSync(py, ['-I', join(SITE, 'scripts/fonts/subset.py')], { cwd: SITE, stdio: 'inherit' });
  if (r.status !== 0) die('サブセット生成に失敗しました。fonts/README.md の「初回セットアップ」（Python と fonttools）を確認してください。');
}

// ---------- check / guard ----------
function verifyFiles(manifest) {
  const problems = [];
  for (const [id, f] of Object.entries(manifest.faces)) {
    const p = join(SITE, cfg.outDir, f.file);
    if (!existsSync(p)) problems.push(`${id}: ${f.file} がありません`);
    else if (sha256(readFileSync(p)) !== f.sha256) problems.push(`${id}: ${f.file} の内容が manifest.json と一致しません`);
  }
  for (const [name, l] of Object.entries(sources.licenses)) {
    const p = join(SITE, cfg.licensesDir, name);
    if (!existsSync(p) || sha256(readFileSync(p)) !== l.sha256) problems.push(`ライセンスファイル ${name} がありません、または内容が違います`);
  }
  const css = readFileSync(join(SITE, cfg.cssFile), 'utf8');
  for (const f of Object.values(manifest.faces)) if (!css.includes(f.file)) problems.push(`${cfg.cssFile} が ${f.file} を参照していません（fonts:subset をやり直してください）`);
  return problems;
}
function reportMissing(missingByFace, unavailable) {
  let fail = false;
  for (const [id, chars] of Object.entries(missingByFace)) {
    const real = chars.filter((c) => !unavailable[id]?.has(c));
    const fb = chars.filter((c) => unavailable[id]?.has(c));
    if (fb.length) console.log(`  ⚠ ${id}: 元フォントに字形がない文字（端末の既定フォントで表示）: ${fb.join('')}`);
    if (real.length) { fail = true; console.error(`  ✗ ${id}: サブセットに入っていない文字 ${real.length} 字: ${real.join('')}`); }
  }
  return fail;
}
const unavailableOf = (manifest) => Object.fromEntries(Object.entries(manifest.faces).map(([id, f]) => [id, new Set([...(f.unavailable ?? '')])]));

async function check() {
  const manifest = loadManifest();
  const dist = distDir();
  const problems = verifyFiles(manifest);
  const cov = coverageByFace(manifest);
  const { sets } = await collectChars(dist);
  const missing = {};
  for (const [id, set] of Object.entries(sets)) {
    const face = cfg.faces.find((f) => f.id === id);
    const need = [...set].filter((c) => !cov[id].has(cp(c)));
    if (need.length) missing[id] = need;
    void face;
  }
  // 公開物の確認：Google Fonts を参照していないこと、参照しているフォントが公開物にあること
  for (const f of walk(dist)) {
    if (!/\.(html|css)$/.test(f)) continue;
    const t = readFileSync(f, 'utf8');
    if (/fonts\.(googleapis|gstatic)\.com/.test(t)) problems.push(`${f.slice(dist.length)} が Google Fonts を参照しています`);
    for (const m of t.matchAll(/\/assets\/fonts\/([\w.-]+\.woff2)/g)) if (!existsSync(join(dist, 'assets/fonts', m[1]))) problems.push(`${f.slice(dist.length)} が参照する ${m[1]} が公開物にありません`);
  }
  // 公開物の @font-face が、いまの manifest のファイルを参照していること（古いビルドを検証していないか）
  const allCss = walk(dist).filter((f) => /\.(html|css)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const f of Object.values(manifest.faces)) if (!allCss.includes(f.file)) problems.push(`公開物が ${f.file} を参照していません（ビルドが古い可能性。fonts:update でビルドし直されます）`);
  problems.forEach((p) => console.error(`  ✗ ${p}`));
  const fail = reportMissing(missing, unavailableOf(manifest));
  if (problems.length || fail) die('フォントの検証に失敗しました。npm run fonts:update を実行して再生成してください。');
  console.log('✓ フォントの検証に成功（全ページの全文字がサブセットに収録済み・外部フォント参照なし・ライセンス同梱）');
  stats();
}

const decodeEntities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()] ?? m;
});
function guard() {
  const manifest = loadManifest();
  const dist = resolve(opt('--dist') ?? join(SITE, 'dist'));
  const cov = coverageByFace(manifest);
  const all = new Set(Object.values(cov).flatMap((s) => [...s]));
  const skip = new Set(Object.values(unavailableOf(manifest)).flatMap((s) => [...s]));
  const cs = readJson(join(SITE, 'fonts/charset.json'));
  for (const ch of (cs.systemFontOnly?.chars ?? []).join('')) skip.add(ch); // 端末の既定フォントで表示している要素の文字は対象外
  const found = new Map();
  const check = (chars, where) => { for (const ch of chars) if (cp(ch) > 0x7f && !/\s/.test(ch) && !all.has(cp(ch)) && !skip.has(ch) && !found.has(ch)) found.set(ch, where); };
  for (const f of walk(dist)) {
    const rel = f.slice(dist.length);
    if (f.endsWith('.html')) {
      const raw = readFileSync(f, 'utf8');
      check(decodeEntities(raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')), `${rel}（本文）`);
      for (const m of raw.matchAll(/\sdata-[\w-]+="([^"]*)"/g)) check(decodeEntities(m[1]), `${rel}（data-属性）`);
      for (const m of raw.matchAll(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) check(stringLiteralChars(m[1], false), `${rel}（スクリプト内の文字列）`);
      for (const m of raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) check(stringLiteralChars(m[1], true), `${rel}（CSSのcontent）`);
    } else if (f.endsWith('.js')) check(stringLiteralChars(readFileSync(f, 'utf8'), false), `${rel}（スクリプト内の文字列）`);
    else if (f.endsWith('.css')) check(stringLiteralChars(readFileSync(f, 'utf8'), true), `${rel}（CSSのcontent）`);
  }
  if (found.size) {
    console.error(`\n✗ 自前配信フォントに入っていない文字が ${found.size} 字あります（例: ${[...found.keys()].slice(0, 30).join('')}）`);
    for (const [ch, where] of [...found].slice(0, 5)) console.error(`    「${ch}」 ${where}`);
    die('npm run fonts:update を実行してフォントを再生成してから、もう一度ビルドしてください。');
  }
  console.log('✓ フォントの収録確認 OK（本文・data-属性・スクリプト内の文字列・CSSの content の文字は、すべて自前配信フォントに収録されています）');
}

// ---------- stats ----------
function stats() {
  const m = loadManifest();
  let base = null;
  if (opt('--base')) {
    const r = spawnSync('git', ['show', `${opt('--base')}:site/fonts/manifest.json`], { cwd: SITE, encoding: 'utf8' });
    if (r.status === 0) base = JSON.parse(r.stdout);
  }
  console.log('\nface'.padEnd(28) + 'バイト'.padStart(10) + 'codepoints'.padStart(12) + (base ? '   差分' : ''));
  for (const [id, f] of Object.entries(m.faces)) {
    const prev = base?.faces?.[id]?.bytes;
    console.log(id.padEnd(27) + String(f.bytes).padStart(10) + String(f.codepoints).padStart(12) + (base ? `   ${prev == null ? '(新規)' : `${f.bytes - prev >= 0 ? '+' : ''}${f.bytes - prev}`}` : ''));
  }
  console.log('合計'.padEnd(27) + String(m.totalBytes).padStart(10));
}

// ---------- doctor（再生成に必要な環境の確認） ----------
async function doctor() {
  const ok = (m) => console.log(`✓ ${m}`);
  const ng = (m) => { console.error(`✗ ${m}`); bad = true; };
  let bad = false;
  ok(`Node.js ${process.version}（確認済み: v22）`);
  const venv = join(SITE, '.venv-fonts/bin/python');
  if (!existsSync(venv)) ng('Python 仮想環境がありません → npm run fonts:setup');
  else {
    const r = spawnSync(venv, ['-c', 'import fontTools,brotli,sys;print(sys.version.split()[0],fontTools.version,brotli.__version__)'], { encoding: 'utf8' });
    const want = readFileSync(join(SITE, 'fonts/requirements.txt'), 'utf8');
    r.status === 0 ? ok(`Python / fonttools / brotli = ${r.stdout.trim()}（要求: ${want.trim().split('\n').join(', ')}）`) : ng('fonttools が使えません → npm run fonts:setup');
  }
  try {
    const { chromium } = await loadPlaywright();
    const b = await chromium.launch(process.env.FONTS_CHROMIUM ? { executablePath: process.env.FONTS_CHROMIUM } : {});
    ok(`Chromium を起動できました（${b.version()}）`);
    await b.close();
  } catch (e) { ng(`Chromium を起動できません（${String(e.message).split('\n')[0]}）→ npx playwright-core install chromium、または FONTS_CHROMIUM / PLAYWRIGHT_BROWSERS_PATH を指定`); }
  existsSync(join(CACHE, sources.sources['noto-sans-jp'].file)) ? ok('元フォントを取得済み') : ng('元フォントが未取得 → npm run fonts:fetch（fonts:update でも取得されます）');
  process.exit(bad ? 1 : 0);
}

// ---------- main ----------
switch (cmd) {
  case 'fetch': await fetchSources(); break;
  case 'collect': await collect(); break;
  case 'subset': subset(); break;
  case 'update': {
    await fetchSources();
    await collect();
    subset();
    args.push('--dist', buildSite()); // 新しいフォントを含めてビルドし直したもので検証する
    await check();
    break;
  }
  case 'check': await check(); break;
  case 'guard': guard(); break;
  case 'stats': stats(); break;
  case 'doctor': await doctor(); break;
  default: console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
}
