// 実ブラウザ（Chromium）での技術検証。 usage: node verify.js http://localhost:8820/ [out.json]
// axe-core が require できる場合のみ、アクセシビリティ検査も行う。
const { chromium } = require('playwright');
let axeSrc = null; try { axeSrc = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) {}
const base = process.argv[2] || 'http://localhost:8820/';
const out = process.argv[3];
const R = []; let fail = 0;
const ok = (name, cond, detail) => { R.push({ name, pass: !!cond, detail: detail === undefined ? '' : detail }); if (!cond) fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail !== undefined && detail !== '' ? '  → ' + JSON.stringify(detail) : '')); };
const WIDTHS = [320, 375, 390, 768, 1024, 1440];

async function common(b, page, label) {
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage(); const errs = []; const ext = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push(String(e)));
    p.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) ext.push(r.url()); });
    const resp = []; p.on('response', r => { if (r.status() >= 400) resp.push(r.url() + ' ' + r.status()); });
    await p.goto(base + page, { waitUntil: 'networkidle' });
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`${label} ${w}px 横スクロールなし`, m.sw <= m.cw, m.sw > m.cw ? m : '');
    if (w === 390 || w === 1440) {
      ok(`${label} ${w}px コンソールエラー0`, errs.length === 0, errs);
      ok(`${label} ${w}px 外部への通信0`, ext.length === 0, ext);
      ok(`${label} ${w}px 読み込み失敗0`, resp.length === 0, resp);
      const t = await p.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        // 文字サイズ：テキストを直接もつ要素の最小サイズ
        let small = [];
        document.querySelectorAll('body *').forEach(e => {
          if (!vis(e) || e.closest('svg')) return;
          const has = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (has) { const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 12) small.push(e.tagName + '.' + e.className + ':' + fs); }
        });
        // 操作対象のサイズ
        let tiny = [];
        document.querySelectorAll('a,button,input,select,textarea,summary').forEach(e => {
          if (!vis(e)) return; if (e.matches('input[type=radio]')) return;
          const r = e.getBoundingClientRect();
          const inline = getComputedStyle(e).display === 'inline';
          if (!inline && (r.width < 24 || r.height < 24)) tiny.push(e.tagName + '.' + e.className + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        });
        const imgsNoAlt = [...document.querySelectorAll('img:not([alt])')].length;
        return { small: [...new Set(small)], tiny, h1: document.querySelectorAll('h1').length, imgsNoAlt, lang: document.documentElement.lang,
          robots: (document.querySelector('meta[name=robots]') || {}).content, storage: localStorage.length + sessionStorage.length, cookie: document.cookie };
      });
      ok(`${label} ${w}px 12px未満の文字なし`, t.small.length === 0, t.small);
      ok(`${label} ${w}px 操作対象 24px以上`, t.tiny.length === 0, t.tiny);
      ok(`${label} ${w}px h1は1つ・lang=ja・noindex`, t.h1 === 1 && t.lang === 'ja' && /noindex/.test(t.robots || ''), t);
      ok(`${label} ${w}px 保存なし（storage/cookie）`, t.storage === 0 && t.cookie === '', { storage: t.storage, cookie: t.cookie });
      // ページ内リンク切れ
      const dead = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.getElementById(h.slice(1))));
      ok(`${label} ${w}px ページ内リンク切れ0`, dead.length === 0, dead);
      if (axeSrc) {
        await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
        await p.addScriptTag({ content: axeSrc });
        const ax = await p.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' | ' + (n.any[0] ? n.any[0].message : '')) })); });
        ok(`${label} ${w}px axe（WCAG 2 A/AA）違反0`, ax.length === 0, ax);
      }
    }
    await ctx.close();
  }
}

async function soudanA(b) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const posts = []; p.on('request', r => { if (r.method() !== 'GET') posts.push(r.url()); });
  await p.goto(base + 'a-rikon/#soudan');
  await p.click('#soudan-form button[type=submit]');
  ok('A フォーム：未入力で送信するとエラー表示', (await p.textContent('#e-name')).length > 0 && (await p.textContent('#e-method')).length > 0);
  await p.fill('#f-name', 'テスト 太郎');
  await p.check('input[name=method][value=tel]', { force: true });
  ok('A フォーム：電話を選ぶと電話番号欄が出る', await p.isVisible('#f-tel') && !(await p.isVisible('#f-mail')));
  await p.fill('#f-tel', 'abc'); await p.click('#soudan-form button[type=submit]');
  ok('A フォーム：不正な電話番号でエラー', (await p.textContent('#e-tel')).length > 0);
  await p.check('input[name=method][value=mail]', { force: true });
  await p.fill('#f-mail', 'bad@'); await p.click('#soudan-form button[type=submit]');
  ok('A フォーム：不正なメールでエラー', (await p.textContent('#e-mail')).length > 0);
  await p.fill('#f-mail', 'test@example.com'); await p.click('#soudan-form button[type=submit]');
  ok('A フォーム：正しい入力でデモ完了表示（送信なし）', await p.isVisible('#soudan-done') && posts.length === 0, posts);
  await p.click('#soudan-back');
  ok('A フォーム：フォームに戻る', await p.isVisible('#soudan-form') && (await p.inputValue('#f-name')) === 'テスト 太郎');
  await p.context().close();
}

async function wizard(b, vw) {
  const L = `B 診断(${vw}px)`;
  const p = await (await b.newContext({ viewport: { width: vw, height: 844 } })).newPage();
  const reqs = []; p.on('request', r => { if (r.method() !== 'GET' || !r.url().startsWith(base)) reqs.push(r.method() + ' ' + r.url()); });
  await p.goto(base + 'b-kachi-check/');
  const sample = () => p.evaluate(() => document.querySelector('.rs').innerText);
  const before = await sample();
  await p.click('#hero-start button[data-type=land]'); await p.waitForTimeout(600);
  ok(`${L} FVの種別ボタン：種別が入り、所在地の入力から始まる`, await p.evaluate(() => document.querySelector('.ck-step:not([hidden])').dataset.step === '2' && document.querySelector('input[name=type][value=land]').checked));
  await p.click('#ck-back'); await p.evaluate(() => { document.getElementById('ck-form').reset(); });
  ok(`${L} 開始ボタンで入力欄へ移動`, await p.evaluate(() => { const r = document.getElementById('check').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
  const next = () => p.click('#ck-next');
  const cur = () => p.evaluate(() => document.querySelector('.ck-step:not([hidden])').dataset.step);
  await next();
  ok(`${L} 1 種別未選択でエラー・進まない`, (await cur()) === '1' && (await p.textContent('#e-type')).length > 0);
  ok(`${L} 1 「戻る」は非表示`, !(await p.isVisible('#ck-back')));
  await p.check('input[name=type][value=house]', { force: true }); await next();
  ok(`${L} 2 へ進む`, (await cur()) === '2');
  await next();
  ok(`${L} 2 未入力でエラー`, (await cur()) === '2' && (await p.textContent('#e-pref')).length > 0 && (await p.textContent('#e-city')).length > 0);
  await p.selectOption('#ck-pref', '東京都'); await p.fill('#ck-city', '阿佐谷北1-3'); await next();
  ok(`${L} 2 番地入りはエラー`, (await cur()) === '2' && /番地/.test(await p.textContent('#e-city')));
  await p.fill('#ck-city', '杉並区'); await next();
  ok(`${L} 3 へ進む（一戸建て：土地・建物・築年の3欄）`, (await cur()) === '3' && await p.isVisible('#ck-tochi') && await p.isVisible('#ck-tatemono') && await p.isVisible('#ck-chiku') && !(await p.isVisible('#ck-senyu')));
  await next();
  ok(`${L} 3 未入力でエラー`, (await cur()) === '3' && (await p.textContent('#e-tochi')).length > 0);
  await p.fill('#ck-tochi', 'ひろい'); await p.fill('#ck-tatemono', '5'); await p.fill('#ck-chiku', '150'); await next();
  ok(`${L} 3 文字・範囲外でエラー`, (await cur()) === '3' && /数字/.test(await p.textContent('#e-tochi')) && (await p.textContent('#e-tatemono')).length > 0 && (await p.textContent('#e-chiku')).length > 0);
  await p.fill('#ck-tochi', '１２０'); await p.fill('#ck-tatemono', '95.5'); await p.fill('#ck-chiku', '18');
  ok(`${L} 3 坪数の換算表示`, /36\.3/.test(await p.textContent('#t-tochi')), await p.textContent('#t-tochi'));
  await next();
  const conf = await p.innerText('#ck-confirm');
  ok(`${L} 4 確認に入力内容が出る`, (await cur()) === '4' && /一戸建て/.test(conf) && /東京都 杉並区/.test(conf) && /120㎡/.test(conf) && /95\.5㎡/.test(conf) && /18年/.test(conf), conf);
  await p.click('#ck-back');
  ok(`${L} 戻る：3 に戻り入力が残る`, (await cur()) === '3' && (await p.inputValue('#ck-chiku')) === '18');
  await p.click('#ck-back'); await p.click('#ck-back');
  ok(`${L} 戻る：1 まで戻れる`, (await cur()) === '1' && await p.isChecked('input[name=type][value=house]'));
  await p.check('input[name=type][value=mansion]', { force: true }); await next(); await next();
  ok(`${L} 種別変更：マンションは専有面積・築年の2欄`, await p.isVisible('#ck-senyu') && !(await p.isVisible('#ck-tochi')) && await p.isVisible('#ck-chiku'));
  await p.fill('#ck-senyu', '70'); await p.fill('#ck-chiku', ''); await next();
  ok(`${L} 3 築年数が空ならエラー`, (await cur()) === '3' && (await p.textContent('#e-chiku')).length > 0);
  await p.check('#ck-chiku-unknown'); await next();
  ok(`${L} 3 築年数「わからない」で進める`, (await cur()) === '4' && /わからない/.test(await p.innerText('#ck-confirm')));
  await next(); await p.waitForTimeout(500);
  const after1 = await sample();
  ok(`${L} 結果：入力内容の表示と「反映していません」`, await p.isVisible('#rs-echo') && /マンション/.test(await p.innerText('#rs-echo')) && /無関係/.test(await p.innerText('#rs-echo')));
  ok(`${L} 結果：見本は入力前と同一（計算なし）`, before === after1);
  ok(`${L} 結果：金額の近くに「見本・架空データ」`, await p.evaluate(() => { const b = document.querySelector('.rs-price-block'); return !!b.querySelector('.tag-sample') && /見本・架空データ/.test(document.querySelector('.rs-banner').innerText); }));
  await p.click('#rs-edit'); await p.waitForTimeout(400);
  ok(`${L} 入力を修正する：確認ステップへ戻る`, (await cur()) === '4' && !(await p.isHidden('#ck-form')));
  await p.click('#ck-back'); await p.fill('#ck-senyu', '45'); await next(); await next(); await p.waitForTimeout(400);
  ok(`${L} 入力を変えても見本は同一`, (await sample()) === before && /45㎡/.test(await p.innerText('#rs-echo')));
  await p.click('#rs-reset'); await p.waitForTimeout(400);
  const st = await p.evaluate(() => ({ step: document.querySelector('.ck-step:not([hidden])').dataset.step, type: !!document.querySelector('input[name=type]:checked'), pref: document.getElementById('ck-pref').value, city: document.getElementById('ck-city').value, echo: document.getElementById('rs-echo').hidden, sum: document.getElementById('ck-summary').innerText.replace(/\s+/g, ' ') }));
  ok(`${L} 最初からやり直す：入力が消え 1 に戻る`, st.step === '1' && !st.type && !st.pref && !st.city && st.echo, st);
  // 土地
  await p.check('input[name=type][value=land]', { force: true }); await next(); await p.selectOption('#ck-pref', '大阪府'); await p.fill('#ck-city', '吹田市'); await next();
  ok(`${L} 土地：土地面積の1欄のみ`, await p.isVisible('#ck-tochi') && !(await p.isVisible('#ck-chiku')) && !(await p.isVisible('#ck-tatemono')));
  await p.fill('#ck-tochi', '99999'); await next();
  ok(`${L} 土地：上限超でエラー（対象外の案内）`, (await cur()) === '3' && /対象外/.test(await p.textContent('#e-tochi')));
  await p.fill('#ck-tochi', '200'); await next(); await next(); await p.waitForTimeout(300);
  ok(`${L} 土地でも見本は同一`, (await sample()) === before);
  ok(`${L} 通信：POSTなし・外部通信なし`, reqs.length === 0, reqs);
  const store = await p.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length);
  ok(`${L} 保存なし`, store === 0);
  // キーボード操作
  await p.click('#rs-reset'); await p.waitForTimeout(300);
  await p.focus('input[name=type][value=mansion]'); await p.keyboard.press('Space'); await p.keyboard.press('Enter');
  ok(`${L} キーボード：選択→Enterで次へ`, (await cur()) === '2');
  // 相談フォーム
  await p.click('#soudan-form button[type=submit]');
  ok(`${L} 相談フォーム：未入力でエラー`, (await p.textContent('#e-name')).length > 0 && (await p.textContent('#e-contact')).length > 0);
  await p.fill('#f-name', 'テスト'); await p.fill('#f-contact', '03-1234-5678'); await p.click('#soudan-form button[type=submit]');
  ok(`${L} 相談フォーム：デモ完了表示・送信なし`, await p.isVisible('#soudan-done') && reqs.length === 0);
  await p.click('#soudan-back');
  ok(`${L} 相談フォーム：戻る`, await p.isVisible('#soudan-form'));
  await p.context().close();
}

(async () => {
  const b = await chromium.launch();
  await common(b, 'a-rikon/', 'A');
  await common(b, 'b-kachi-check/', 'B');
  await common(b, '', '入口');
  await soudanA(b);
  await wizard(b, 390);
  await wizard(b, 1440);
  // reduced motion
  const ctx = await b.newContext({ reducedMotion: 'reduce' }); const p = await ctx.newPage(); await p.goto(base + 'b-kachi-check/');
  ok('reduced-motion：スムーズスクロール無効', (await p.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)) === 'auto');
  await b.close();
  console.log(`\n${R.length - fail}/${R.length} PASS` + (axeSrc ? '' : '（axe-core なし：アクセシビリティ自動検査は未実施）'));
  if (out) require('fs').writeFileSync(out, JSON.stringify({ base, date: new Date().toISOString(), axe: !!axeSrc, total: R.length, failed: fail, results: R }, null, 1));
  process.exit(fail ? 1 : 0);
})();
