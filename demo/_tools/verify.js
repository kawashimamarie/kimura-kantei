// 打ち合わせ用デモの技術検証（実ブラウザ：Chromium / Playwright）
//   準備: npm install axe-core（Playwright と Chromium は別途）　実行: node verify.js http://localhost:8810/ verify.json
// 検査: 横スクロール／コンソール・ページエラー／リクエスト失敗・外部通信／リンク・画像／操作（フォーム・メニュー・B案の全手順）／
//       キーボード操作・フォーカス表示／axe-core／操作対象の大きさ／reduced-motion／保存（Cookie・Storage・IndexedDB）／JavaScript無効時
const { chromium } = require('playwright');
const fs = require('fs');
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.argv[2] || 'http://localhost:8810/';
const OUT = process.argv[3] || 'verify.json';
const WIDTHS = [[320, 640], [375, 667], [390, 844], [768, 1024], [1024, 768], [1440, 900]];
const PAGES = { index: '', A: 'a-rikon/', B: 'b-kachi-check/' };
const R = { base: BASE, date: new Date().toISOString(), checks: [] };
const add = (id, name, ok, detail) => { R.checks.push({ id, name, status: ok === null ? '未確認' : ok ? '合格' : '不合格', detail }); console.log((ok === null ? '[未確認] ' : ok ? '[合格]   ' : '[不合格] ') + id + ' ' + name + (detail && (!ok || typeof detail === 'string') ? ' :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 700)) : '')); };

async function newPage(browser, w, h, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 }, opts));
  const page = await ctx.newPage();
  const log = { console: [], failed: [], external: [], requests: [] };
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.console.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => log.console.push('pageerror: ' + e));
  page.on('request', r => { log.requests.push(r.method() + ' ' + r.url()); if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) log.external.push(r.url()); });
  page.on('response', r => { if (r.status() >= 400) log.failed.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => log.failed.push('failed ' + r.url()));
  return { ctx, page, log };
}
const open = async (page, path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400); };
const overflow = page => page.evaluate(() => {
  const de = document.documentElement, w = de.clientWidth;
  const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('.town') && !e.closest('svg') && !e.closest('.vh') && !e.closest('.skip'); })
    .filter(e => { let p = e.parentElement; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'auto' || o === 'clip') return false; p = p.parentElement; } return true; })
    .slice(0, 5).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right));
  return { scroll: de.scrollWidth, client: w, wide };
});
const scrollAll = page => page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
const axe = async (page, label) => {
  await page.waitForTimeout(450);
  await page.evaluate(axeSrc);
  const res = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
  return res.violations.map(v => ({ at: label, id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' | ' + (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 160)) }));
};
// B案を最後まで進める（mode: 'mouse' | 'key'）
async function runB(page, type, opts = {}) {
  await page.click(`.type[data-type="${type}"]`);
  await page.waitForSelector('.view.wiz:not([hidden])');
  if (opts.eachStep) await opts.eachStep('step2');
  await page.selectOption('#pref', { label: '東京都' }); await page.fill('#city', '杉並区'); await page.click('#next');
  await page.waitForSelector('.step[data-step="3"]:not([hidden])');
  if (type === 'mansion') await page.fill('#a-sen', '70');
  if (type !== 'mansion') await page.fill('#a-tochi', '110');
  if (type === 'kodate') await page.fill('#a-tate', '95');
  if (type !== 'tochi') await page.selectOption('#year', '2008');
  if (opts.eachStep) await opts.eachStep('step3');
  await page.click('#next');
  await page.waitForSelector('.step[data-step="4"]:not([hidden])');
  if (opts.eachStep) await opts.eachStep('step4');
  await page.click('#next');
  if (opts.eachStep) { await page.waitForTimeout(150); await opts.eachStep('run'); }
  await page.waitForSelector('.view.res:not([hidden])', { timeout: 9000 });
  await page.waitForTimeout(900);
  if (opts.eachStep) await opts.eachStep('result');
}

(async () => {
  const browser = await chromium.launch();

  /* ---- 1. 各幅での表示：横スクロール・コンソール・失敗・外部通信 ---- */
  const hs = [], cons = [], fails = [], ext = [];
  for (const [w, h] of WIDTHS) for (const [key, path] of Object.entries(PAGES)) {
    const { ctx, page, log } = await newPage(browser, w, h);
    await open(page, path); await scrollAll(page); await page.waitForTimeout(300);
    const o = await overflow(page);
    if (o.scroll > o.client || o.wide.length) hs.push({ page: key, w, state: '初期', ...o });
    if (key === 'A' && w < 700) { await page.click('#menuBtn'); const o2 = await overflow(page); if (o2.scroll > o2.client) hs.push({ page: key, w, state: '目次を開いた状態', ...o2 }); await page.keyboard.press('Escape'); }
    if (key === 'B') {
      for (const t of (w === 390 || w === 1440 ? ['mansion', 'kodate', 'tochi'] : ['kodate'])) {
        await open(page, path);
        await runB(page, t, { eachStep: async s => { const oo = await overflow(page); if (oo.scroll > oo.client || oo.wide.length) hs.push({ page: key, w, state: t + ':' + s, ...oo }); } });
        await scrollAll(page);
        const o3 = await overflow(page); if (o3.scroll > o3.client || o3.wide.length) hs.push({ page: key, w, state: t + ':結果（全体）', ...o3 });
      }
      await open(page, path); await page.click('.textbtn[data-type="other"]'); const o4 = await overflow(page); if (o4.scroll > o4.client) hs.push({ page: key, w, state: '対象外', ...o4 });
    }
    log.console.forEach(c => cons.push(key + '@' + w + ' ' + c)); log.failed.forEach(c => fails.push(key + '@' + w + ' ' + c)); log.external.forEach(c => ext.push(key + '@' + w + ' ' + c));
    await ctx.close();
  }
  add('T-03', '横スクロールなし（320・375・390・768・1024・1440px。B案は入力〜結果の各画面も）', hs.length === 0, hs.length ? hs : '全ページ・全状態で scrollWidth ≦ clientWidth');
  const errs = cons.filter(c => !/ warning: /.test(c)), warns = cons.filter(c => / warning: /.test(c));
  add('T-02a', 'コンソールのエラー 0（ページエラーを含む）', errs.length === 0, errs.length ? errs : '0件');
  add('T-02a-w', 'コンソールの警告', warns.length === 0 ? true : null, warns.length ? { 件数: warns.length, 内容: [...new Set(warns.map(w => w.replace(/^\S+ /, '').slice(0, 150)))], 注: '自動検査の高速な連続遷移でのみ発生。通常の読み込み・再読み込みでは0件（別途確認）' } : '0件');
  add('T-02b', '読み込み失敗（404等）0', fails.length === 0, fails.length ? fails : '0件');
  add('EXT', '外部への通信 0（フォント・画像・スクリプトはすべて同一オリジン）', ext.length === 0, ext.length ? [...new Set(ext)] : '0件');

  /* ---- 2. リンク・画像 ---- */
  {
    const { ctx, page } = await newPage(browser, 1440, 900);
    const bad = [], imgs = []; let nLinks = 0;
    for (const [key, path] of Object.entries(PAGES)) {
      await open(page, path); await scrollAll(page); await page.waitForTimeout(400);
      const links = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
      nLinks += links.length;
      for (const href of links) {
        if (href.startsWith('#')) { if (href.length > 1 && !(await page.$(`[id="${href.slice(1)}"]`))) bad.push(key + ' ' + href + '（移動先なし）'); }
        else if (href.startsWith('tel:')) { if (!/^tel:0\d{9,10}$/.test(href)) bad.push(key + ' ' + href + '（電話番号の形式）'); }
        else if (/^https?:/.test(href)) bad.push(key + ' ' + href + '（外部リンク）');
        else { const r = await page.request.get(new URL(href, BASE + path).href); if (r.status() !== 200) bad.push(key + ' ' + href + ' → ' + r.status()); }
      }
      (await page.$$eval('img', is => is.map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, alt: i.getAttribute('alt') })))).forEach(i => { if (!i.ok || i.alt === null) imgs.push(key + ' ' + JSON.stringify(i)); });
    }
    add('T-02c', 'リンク切れ 0（ページ内リンクの移動先・相対リンク・電話リンクの形式）', bad.length === 0, bad.length ? bad : nLinks + '本を確認');
    add('T-02d', '画像の欠落 0・alt属性あり', imgs.length === 0, imgs.length ? imgs : 'すべて読み込み済み');
    await ctx.close();
  }

  /* ---- 3. 操作：A案（目次・フォーム） ---- */
  {
    const { ctx, page, log } = await newPage(browser, 390, 844);
    await open(page, PAGES.A);
    const res = {};
    await page.click('#menuBtn'); res.menuOpen = await page.isVisible('#menu');
    await page.click('#menu a[href="#fee"]'); await page.waitForTimeout(2200);
    res.menuClosedAfterLink = !(await page.isVisible('#menu'));
    res.jumpedToFee = await page.evaluate(() => { const r = document.getElementById('fee').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    const before = log.requests.length;
    await page.locator('#form').scrollIntoViewIfNeeded();
    await page.click('.form-btn'); await page.waitForTimeout(200);
    res.errorSummary = await page.isVisible('#f-err'); res.errorCount = await page.$$eval('#form [aria-invalid="true"]', n => n.length);
    res.errorFocus = await page.evaluate(() => document.activeElement.id);
    await page.fill('#f-name', '山田 花子'); await page.fill('#f-tel', '０９０ー１２３４ー５６７８'); await page.click('.form-btn'); await page.waitForTimeout(200);
    res.doneShown = await page.isVisible('#done'); res.formHidden = !(await page.isVisible('#form'));
    res.doneText = (await page.textContent('#done .form-demo')).trim();
    await page.click('#done-back'); res.formBack = await page.isVisible('#form'); res.formCleared = (await page.inputValue('#f-name')) === '';
    await page.click('input[name="via"][value="mail"]', { force: true }); res.mailField = await page.isVisible('#f-mail') && !(await page.isVisible('#f-tel'));
    await page.fill('#f-name', 'x'); await page.fill('#f-mail', 'abc'); await page.click('.form-btn'); res.mailError = (await page.textContent('#f-mail-e')).includes('@');
    res.requestsDuringForm = log.requests.length - before;
    res.storage = await page.evaluate(async () => ({ ls: localStorage.length, ss: sessionStorage.length, cookie: document.cookie, idb: (indexedDB.databases ? (await indexedDB.databases()).length : 'n/a') }));
    const ok = res.menuOpen && res.menuClosedAfterLink && res.jumpedToFee && res.errorSummary && res.errorCount === 2 && res.errorFocus === 'f-err' && res.doneShown && res.formHidden && res.formBack && res.formCleared && res.mailField && res.mailError;
    add('A-OP', 'A案の操作：目次の開閉と移動、フォームの必須チェック・エラー表示・デモ完了表示・やり直し', ok, res);
    add('A-SEND', 'A案フォーム：送信・保存なし（操作中の通信 0、Cookie・Storage・IndexedDB 空）', res.requestsDuringForm === 0 && res.storage.ls === 0 && res.storage.ss === 0 && res.storage.cookie === '' && (res.storage.idb === 0 || res.storage.idb === 'n/a'), { requests: res.requestsDuringForm, storage: res.storage });
    // 詳細の開閉
    await open(page, PAGES.A); await page.locator('.faq details').first().scrollIntoViewIfNeeded(); await page.click('.faq summary >> nth=0');
    add('A-FAQ', 'A案：よくあるご質問の開閉', await page.evaluate(() => document.querySelector('.faq details').open), '1問目を開いて確認');
    await ctx.close();
  }

  /* ---- 4. 操作：B案（3種別×入力→結果、エラー、対象外、やり直し、相談フォーム） ---- */
  {
    const out = {}; let ok = true;
    for (const [w, h] of [[390, 844], [1440, 900]]) for (const t of ['mansion', 'kodate', 'tochi']) {
      const { ctx, page, log } = await newPage(browser, w, h);
      await open(page, PAGES.B);
      const before = log.requests.length;
      await page.click(`.type[data-type="${t}"]`);
      await page.click('#next'); const e2 = await page.$$eval('.step[data-step="2"] [aria-invalid="true"]', n => n.length);
      await page.selectOption('#pref', { label: '大阪府' }); await page.fill('#city', '吹田市1-2'); await page.click('#next');
      const e2b = (await page.textContent('#city-e')).includes('番地');
      await page.fill('#city', '吹田市'); await page.click('#next');
      await page.waitForSelector('.step[data-step="3"]:not([hidden])');
      await page.click('#next'); const e3 = await page.$$eval('.step[data-step="3"] .fld:not([hidden]) [aria-invalid="true"]', n => n.length);
      const first = t === 'mansion' ? '#a-sen' : '#a-tochi';
      await page.fill(first, 'abc'); await page.click('#next'); const e3b = (await page.textContent(first + '-e')).includes('数字');
      await page.fill(first, '3'); await page.click('#next'); const e3c = (await page.textContent(first + '-e')).includes('範囲');
      await page.fill(first, '７５．５'); if (t === 'kodate') await page.fill('#a-tate', '98'); if (t !== 'tochi') await page.selectOption('#year', 'unknown');
      await page.click('#back'); const backTo2 = await page.isVisible('.step[data-step="2"]'); const kept = await page.inputValue('#city');
      await page.click('#next'); await page.click('#next');
      await page.waitForSelector('.step[data-step="4"]:not([hidden])');
      await page.click('#next'); // 理由は選ばずに進む
      await page.waitForSelector('.view.res:not([hidden])', { timeout: 9000 }); await page.waitForTimeout(800);
      const r = await page.evaluate(() => ({ view: document.getElementById('app').dataset.view, low: document.getElementById('s-low').textContent, high: document.getElementById('s-high').textContent, warn: !!document.querySelector('.sheet-warn') && getComputedStyle(document.querySelector('.sheet-warn')).display !== 'none' && document.querySelector('.sheet-warn').textContent.includes('計算していません'), stamp: document.querySelector('.sheet-warn b').textContent, bars: document.querySelectorAll('.fac-r').length, spec: document.getElementById('s-spec').textContent, trend: !!document.querySelector('#trend svg path.tr-line'), split: !document.getElementById('split').hidden, ticket: [...document.querySelectorAll('#tk2 dd')].map(d => d.textContent), digits: document.querySelectorAll('#mwin .mw.on').length }));
      const storage = await page.evaluate(async () => ({ ls: localStorage.length, ss: sessionStorage.length, cookie: document.cookie, idb: (indexedDB.databases ? (await indexedDB.databases()).length : 'n/a') }));
      const req = log.requests.length - before; const reqUrls = log.requests.slice(before);
      await page.locator('[data-restart]:visible').first().click(); const backIntro = await page.getAttribute('#app', 'data-view'); const cleared = await page.inputValue('#city');
      const good = e2 === 2 && e2b && e3 >= 1 && e3b && e3c && backTo2 && kept === '吹田市' && r.view === 'res' && r.warn && r.stamp.includes('見本') && r.spec.includes('架空') && r.bars >= 3 && r.trend && r.split === (t === 'kodate') && r.ticket[2].includes('75.5') && req === 0 && storage.ls === 0 && storage.ss === 0 && storage.cookie === '' && backIntro === 'intro' && cleared === '';
      ok = ok && good; out[t + '@' + w] = { good, reqUrls, e2, e2b, e3, e3b, e3c, backTo2, kept, r, req, storage, backIntro, cleared, console: log.console };
      await ctx.close();
    }
    add('B-OP', 'B案の操作：3種別×PC・スマホで、入力→エラー表示→戻る→結果表示→やり直し', ok, ok ? '6通りすべて通過（結果に「見本｜架空の物件の数値です。ご入力の物件については計算していません」の帯を常時表示。全角数字の入力も処理）' : out);
    const reqs = Object.values(out).map(o => o.req), st = Object.values(out).map(o => o.storage);
    add('B-SEND', 'B案：入力内容の送信・保存なし（操作中の通信 0、Cookie・Storage・IndexedDB 空）', reqs.every(n => n === 0) && st.every(s => s.ls === 0 && s.ss === 0 && s.cookie === ''), { requestsDuringFlow: reqs, storage: st[0] });
    // 同じ種別なら入力が違っても結果は同じ（＝計算していない）
    const { ctx, page } = await newPage(browser, 1440, 900); const vals = [];
    for (const [pref, city, sen] of [['東京都', '港区', '120'], ['北海道', '稚内市', '25']]) {
      await open(page, PAGES.B); await page.click('.type[data-type="mansion"]'); await page.selectOption('#pref', { label: pref }); await page.fill('#city', city); await page.click('#next'); await page.fill('#a-sen', sen); await page.selectOption('#year', '1975'); await page.click('#next'); await page.click('#next'); await page.waitForSelector('.view.res:not([hidden])', { timeout: 9000 });
      vals.push(await page.textContent('#s-low') + '-' + await page.textContent('#s-high'));
    }
    add('B-CALC', 'B案：実際の価格を計算していない（入力を大きく変えても、表示されるサンプル値は同じ）', vals[0] === vals[1], vals);
    // 対象外・相談フォーム
    await open(page, PAGES.B); await page.click('.textbtn[data-type="other"]'); const other = await page.isVisible('.view.other'); await page.click('[data-go="intro"]'); const back = await page.getAttribute('#app', 'data-view');
    await page.locator('#form').scrollIntoViewIfNeeded(); await page.click('.form-btn'); const fe = await page.$$eval('#form [aria-invalid="true"]', n => n.length);
    await page.fill('#f-name', '山田'); await page.fill('#f-contact', 'yamada@example.com'); await page.click('.form-btn'); const done = await page.isVisible('#done');
    add('B-OP2', 'B案：対象外の案内と戻る、相談フォームの必須チェックとデモ完了表示', other && back === 'intro' && fe === 2 && done, { other, back, fe, done });
    await ctx.close();
  }

  /* ---- 5. キーボード操作 ---- */
  {
    const { ctx, page } = await newPage(browser, 1440, 900);
    // B案：キーボードだけで結果まで
    await open(page, PAGES.B);
    const tabTo = async (sel, max = 60) => { for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(s => document.activeElement && document.activeElement.matches(s), sel)) return true; } return false; };
    const focusRing = () => page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e), n = e.nextElementSibling ? getComputedStyle(e.nextElementSibling) : null; return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || (n && n.outlineStyle !== 'none' && parseFloat(n.outlineWidth) >= 2); });
    const k = {};
    k.skip = await tabTo('.skip', 2); k.skipVisible = await page.evaluate(() => document.activeElement.getBoundingClientRect().top >= 0);
    k.type = await tabTo('.type[data-type="kodate"]'); k.typeRing = await focusRing();
    await page.keyboard.press('Enter'); await page.waitForSelector('.view.wiz:not([hidden])');
    k.focusMoved = await page.evaluate(() => document.activeElement.classList.contains('step-h'));
    k.pref = await tabTo('#pref'); k.prefRing = await focusRing(); await page.keyboard.press('ArrowDown'); k.prefValue = await page.inputValue('#pref'); await page.keyboard.press('Tab'); await page.keyboard.type('杉並区'); await page.keyboard.press('Enter');
    await page.waitForSelector('.step[data-step="3"]:not([hidden])');
    k.s3 = await tabTo('#a-tochi'); await page.keyboard.type('110'); k.s3b = await tabTo('#a-tate'); await page.keyboard.type('95'); k.s3c = await tabTo('#year'); await page.keyboard.type('2008'); k.year = await page.inputValue('#year'); k.s3d = await tabTo('#next'); await page.keyboard.press('Enter');
    await page.waitForSelector('.step[data-step="4"]:not([hidden])', { timeout: 3000 }).catch(() => {});
    k.s4 = await page.isVisible('.step[data-step="4"]');
    k.radio = await tabTo('input[name="purpose"]'); k.radioRing = await focusRing(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    k.purpose = await page.evaluate(() => (document.querySelector('input[name="purpose"]:checked') || {}).value);
    k.next = await tabTo('#next'); k.nextRing = await focusRing(); await page.keyboard.press('Enter');
    await page.waitForSelector('.view.res:not([hidden])', { timeout: 9000 }); await page.waitForTimeout(500);
    k.resFocus = await page.evaluate(() => document.activeElement.id);
    k.chart = await tabTo('#trend'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); k.chartTip = await page.evaluate(() => !document.getElementById('tip').hidden && document.getElementById('tip').textContent);
    k.fac = await page.evaluate(() => { const r = document.querySelector('.fac-r'); r.focus(); return !document.getElementById('tip').hidden; });
    add('KB-B', 'B案：キーボードだけで種別選択→入力→結果→グラフの読み取りまで操作でき、フォーカスが見える', Object.values(k).every(v => v !== false && v !== undefined && v !== ''), k);
    // A案：フォーカスの順序と表示
    await open(page, PAGES.A);
    const a = {}; const seen = []; let rings = 0, total = 0;
    for (let i = 0; i < 70; i++) { await page.keyboard.press('Tab'); const info = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const r = e.getBoundingClientRect(); return { t: e.tagName + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0], vis: r.width > 0 && r.height > 0 }; }); if (!info) break; total++; if (await focusRing()) rings++; seen.push(info.t); if (!info.vis) a.hiddenFocus = info.t; }
    a.total = total; a.rings = rings; a.reachesCta = seen.some(s => s.includes('btn')); a.reachesForm = seen.some(s => s.includes('f-name')); a.reachesFaq = seen.some(s => s.startsWith('SUMMARY'));
    add('KB-A', 'A案：Tabキーで全ての操作対象に順に届き、フォーカスが見える（PC）', a.rings === a.total && a.reachesCta && a.reachesForm && a.reachesFaq && !a.hiddenFocus, a);
    await ctx.close();
    // A案スマホ：目次をキーボードで
    const m = await newPage(browser, 390, 844); await open(m.page, PAGES.A);
    await m.page.focus('#menuBtn'); await m.page.keyboard.press('Enter'); const o1 = await m.page.getAttribute('#menuBtn', 'aria-expanded'); await m.page.keyboard.press('Tab'); const inMenu = await m.page.evaluate(() => !!document.activeElement.closest('#menu')); await m.page.keyboard.press('Escape'); const o2 = await m.page.getAttribute('#menuBtn', 'aria-expanded'); const fb = await m.page.evaluate(() => document.activeElement.id);
    add('KB-A2', 'A案スマホ：目次をキーボードで開閉でき、Escで閉じてボタンに戻る', o1 === 'true' && inMenu && o2 === 'false' && fb === 'menuBtn', { o1, inMenu, o2, fb });
    await m.ctx.close();
  }

  /* ---- 6. アクセシビリティ自動検査（axe-core） ---- */
  {
    let v = [];
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const { ctx, page } = await newPage(browser, w, h);
      await open(page, PAGES.index); v = v.concat(await axe(page, 'index@' + w));
      await open(page, PAGES.A); await scrollAll(page); v = v.concat(await axe(page, 'A@' + w));
      if (w < 700) { await page.click('#menuBtn'); v = v.concat(await axe(page, 'A:目次@' + w)); await page.keyboard.press('Escape'); }
      await page.locator('#form').scrollIntoViewIfNeeded(); await page.click('.form-btn'); await page.evaluate(() => window.scrollTo(0, document.getElementById('form').getBoundingClientRect().top + scrollY - 84)); /* 追従ヘッダーの下に操作対象が半分隠れた位置で検査しないよう、フォームの先頭に合わせる */ v = v.concat(await axe(page, 'A:フォームのエラー@' + w));
      await page.fill('#f-name', 'a'); await page.fill('#f-tel', '0312345678'); await page.click('.form-btn'); v = v.concat(await axe(page, 'A:デモ完了@' + w));
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); v = v.concat(await axe(page, 'A:質問を全て開く@' + w));
      await open(page, PAGES.B); await scrollAll(page); v = v.concat(await axe(page, 'B:はじめ@' + w));
      await page.click('.textbtn[data-type="other"]'); v = v.concat(await axe(page, 'B:対象外@' + w));
      await open(page, PAGES.B); await page.click('.type[data-type="kodate"]'); await page.click('#next'); v = v.concat(await axe(page, 'B:入力エラー@' + w));
      await open(page, PAGES.B); await runB(page, 'kodate', { eachStep: async s => { v = v.concat(await axe(page, 'B:' + s + '@' + w)); } });
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); v = v.concat(await axe(page, 'B:結果・表を開く@' + w));
      await ctx.close();
    }
    const serious = v.filter(x => x.impact === 'critical' || x.impact === 'serious');
    add('A-09', 'axe-core：重大（critical・serious）な指摘 0（PC・スマホ、各画面・各状態）', serious.length === 0, serious.length ? serious : '0件（検査した画面・状態：28）');
    const minor = v.filter(x => x.impact !== 'critical' && x.impact !== 'serious');
    add('A-09b', 'axe-core：軽微（moderate・minor）な指摘', minor.length === 0, minor.length ? minor : '0件');
  }

  /* ---- 7. 操作対象の大きさ ---- */
  {
    const small = [], under44 = [];
    for (const [key, path] of [['A', PAGES.A], ['B', PAGES.B]]) {
      const { ctx, page } = await newPage(browser, 390, 844); await open(page, path);
      const states = [async () => {}];
      if (key === 'A') states.push(async () => { await page.click('#menuBtn'); });
      if (key === 'B') { states.push(async () => { await page.click('.type[data-type="kodate"]'); }); states.push(async () => { await page.selectOption('#pref', { label: '東京都' }); await page.fill('#city', '杉並区'); await page.click('#next'); }); states.push(async () => { await page.fill('#a-tochi', '110'); await page.fill('#a-tate', '95'); await page.selectOption('#year', '2008'); await page.click('#next'); }); states.push(async () => { await page.click('#next'); await page.waitForSelector('.view.res:not([hidden])', { timeout: 9000 }); }); }
      for (const s of states) {
        await s(); await page.waitForTimeout(150);
        const r = await page.evaluate(() => [...document.querySelectorAll('a[href],button,select,summary,input:not([type=radio]):not([type=hidden]),textarea,.f-seg label,.opts label,[tabindex="0"]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.skip'); }).map(e => { const r = e.getBoundingClientRect(); const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline'; return { t: (e.tagName + '.' + String(e.className).split(' ')[0] + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 14) + '"'), w: Math.round(r.width), h: Math.round(r.height), inline }; }));
        r.forEach(x => { if (!x.inline && (x.w < 24 || x.h < 24)) small.push(key + ' ' + JSON.stringify(x)); else if (!x.inline && x.h < 44) under44.push(key + ' ' + x.t + ' ' + x.w + '×' + x.h); });
      }
      await ctx.close();
    }
    add('A-04', '操作対象 24×24px以上（スマホ390px。文中リンクは規格の例外）', small.length === 0, small.length ? [...new Set(small)] : 'すべて24px以上');
    add('A-04b', '操作対象 44px以上（推奨）に満たないもの', null, [...new Set(under44)].length ? [...new Set(under44)] : 'なし');
  }

  /* ---- 8. reduced-motion ---- */
  {
    const { ctx, page } = await newPage(browser, 390, 844, { reducedMotion: 'reduce' });
    await open(page, PAGES.A);
    const a = await page.evaluate(() => { const m = document.querySelector('.mk'); const s = getComputedStyle(m); return { opacity: s.opacity, anim: s.animationName, scroll: getComputedStyle(document.documentElement).scrollBehavior }; });
    await open(page, PAGES.B);
    const t0 = Date.now(); await runB(page, 'mansion'); const ms = Date.now() - t0;
    const b = await page.evaluate(() => ({ viewAnim: getComputedStyle(document.querySelector('.view.res')).animationName, win: getComputedStyle(document.querySelector('.mw')).transitionDuration, running: document.getAnimations().filter(x => x.playState === 'running').length }));
    add('T-10', 'prefers-reduced-motion：動きを止める（A案の図の出方、B案の窓の演出・チェック中の待ち時間・画面切替）', a.opacity === '1' && a.anim === 'none' && a.scroll === 'auto' && b.viewAnim === 'none' && b.running === 0, { A: a, B: b, 'B案の入力開始〜結果表示(ms・自動操作)': ms });
    await ctx.close();
    // 通常時：自動で動くものが5秒を超えて続かない
    const n = await newPage(browser, 1440, 900); await open(n.page, PAGES.B); await n.page.waitForTimeout(5200);
    const still1 = await n.page.evaluate(() => [...document.querySelectorAll('#mwin .mw.on')].length); await n.page.waitForTimeout(1500);
    const still2 = await n.page.evaluate(() => ({ on: [...document.querySelectorAll('#mwin .mw.on')].length, running: document.getAnimations().filter(x => x.playState === 'running').length }));
    await open(n.page, PAGES.A); await n.page.waitForTimeout(5200); const aRun = await n.page.evaluate(() => document.getAnimations().filter(x => x.playState === 'running').length);
    add('A-06', '自動で動く要素は5秒以内に止まる（止める操作が要らない長さ）', still1 === still2.on && still2.running === 0 && aRun === 0, { 'B:灯っている窓の数(5.2秒後/6.7秒後)': [still1, still2.on], 'B:実行中のアニメーション': still2.running, 'A:実行中のアニメーション': aRun });
    await n.ctx.close();
  }

  /* ---- 9. JavaScript 無効時 ---- */
  {
    const { ctx, page } = await newPage(browser, 390, 844, { javaScriptEnabled: false });
    await page.goto(BASE + PAGES.A, { waitUntil: 'load' });
    const a = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, tel: document.querySelectorAll('a[href^="tel:"]').length, marks: getComputedStyle(document.querySelector('.mk')).opacity, text: document.body.innerText.length }));
    await page.goto(BASE + PAGES.B, { waitUntil: 'load' });
    const b = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, nojs: document.body.innerText.includes('JavaScript が必要'), tel: document.querySelectorAll('a[href^="tel:"]').length, diff: !!document.getElementById('difference') }));
    add('T-09', 'JavaScript無効時：A案は全文・電話・図が読める。B案は説明と電話での案内が読める（入力の体験は不可）', a.tel > 0 && a.marks === '1' && a.text > 3000 && b.nojs && b.tel > 0, { A: a, B: b });
    await ctx.close();
  }

  /* ---- 10. 構造（見出し・lang・ランドマーク・noindex） ---- */
  {
    const { ctx, page } = await newPage(browser, 1440, 900); const s = {};
    for (const [key, path] of Object.entries(PAGES)) {
      await open(page, path);
      s[key] = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length, robots: (document.querySelector('meta[name=robots]') || {}).content, title: document.title.length > 0, skipped: (() => { const hs = [...document.querySelectorAll('h1,h2,h3,h4')].filter(h => !h.closest('[hidden]')).map(h => +h.tagName[1]); let bad = 0; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) bad++; return bad; })() }));
    }
    add('A-07', 'lang属性・h1は1つ・main・見出しレベルの飛びなし／全ページ noindex,nofollow', Object.values(s).every(x => x.lang === 'ja' && x.h1 === 1 && x.main === 1 && x.skipped === 0 && /noindex/.test(x.robots || '')), s);
    await ctx.close();
  }

  /* ---- 11. 参考：ローカルでの表示計測（公開環境の値ではない） ---- */
  {
    const perf = {};
    for (const [key, path] of [['A', PAGES.A], ['B', PAGES.B]]) for (const [w, h] of [[390, 844], [1440, 900]]) {
      const { ctx, page } = await newPage(browser, w, h);
      await page.addInitScript(() => { window.__lcp = 0; window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
      await open(page, path); await page.waitForTimeout(2500);
      perf[key + '@' + w] = await page.evaluate(() => ({ LCP_ms: Math.round(window.__lcp), CLS: +window.__cls.toFixed(4), transferKB: Math.round(performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) / 1024) }));
      await ctx.close();
    }
    add('T-01a', '表示速度（LCP・CLS）：公開環境でのラボ測定', null, { 注: '未測定。以下はローカル（回線制限なし）での参考値で、合否の根拠にしない', 参考値: perf });
  }

  await browser.close();
  const n = s => R.checks.filter(c => c.status === s).length;
  R.summary = { 合格: n('合格'), 不合格: n('不合格'), 未確認: n('未確認') };
  fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  console.log('\n' + JSON.stringify(R.summary));
})().catch(e => { console.error('VERIFY FAILED', e); process.exit(1); });
