/* B案｜不動産価値チェック（仮称。打ち合わせ用コンセプトデモ）
   ・入力内容は、ページを表示している間だけメモリ上に持つ。
     保存（Cookie・localStorage・sessionStorage・IndexedDB）も、送信（fetch・XHR・フォーム送信・画像ビーコン）もしない。
   ・価格の計算はしない。結果画面の数値は、下の SAMPLE に書いた架空の固定値（ひとつだけ）で、入力内容とは連動しない。
   ・AI・外部APIには接続しない。 */
(function () {
  'use strict';

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var app = $('app');
  var town = $('town');
  if (!app) return;

  /* ====================================================================
     架空の見本データ（種別ごとに固定。入力内容からは作らない）
     ==================================================================== */
  /* 見本はひとつだけ。入力した種別・エリア・広さ・築年のどれを変えても、同じ見本を表示する。
     要因は、構想中のサービスが入力と公開データから言える範囲に限る（道路・法令上の制限・階数などは扱わない）。
     影響の大きさは 2＝大きく、1＝やや（＋は押し上げ、−は押し下げ）。細かい％は出さない。 */
  var SAMPLE = {
    kind: '架空のマンション', spec: '専有面積 68m²／築16年',
    low: 3480, mid: 3960, high: 4440, min: 3000, max: 5000,
    unit: ['約58万円', '（見本のまんなかの価格を、', '専有面積で割った値）'],
    why: '同じ広さ・同じ築年でも、階数や向き、室内の状態などで価格は変わります。このチェックではそこまで見ていないため、ひとつの数字ではなく幅で示します。',
    factors: [
      ['地域の取引の動き', 2, '見本の地域では、この1年、マンションの取引価格が上がっている'],
      ['広さ', 1, '68m²は、見本の地域で取引されたマンションの平均より、やや広い'],
      ['築年数', -2, '築16年。見本の地域で取引された物件の平均より古い']
    ]
  };
  var TYPE_LABEL = { mansion: 'マンション', kodate: '一戸建て', tochi: '土地' };
  var NOYEAR = '不要（土地のため）';
  var STEP_LABEL = { 2: '所在エリア', 3: '広さ・築年', 4: '知りたい理由' };

  /* 入力内容（メモリ上だけ） */
  var state = { type: '', pref: '', city: '', sen: '', tochi: '', tate: '', year: '', purpose: null, step: 2 };

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ====================================================================
     街並み：マンションの窓をドット表示にする
     ==================================================================== */
  var COLS = 23, ROWS = 11, TOP = 2; // 表示に使うのは上から3〜9段目
  var GLYPH = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['01110', '10001', '00001', '00110', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
  };
  /* 2段で表示するときの小さい数字（3列×5段） */
  var GLYPH3 = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '010', '010'],
    '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111']
  };
  var wins = town ? all('#mwin .mw', town) : [];
  var timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  /* 3文字なら 5列＋4列あき、4文字なら 5列＋1列あき で並べる */
  function pattern(text) {
    var on = [], pitch = text.length <= 3 ? 9 : 6, i, g, r, c, rows;
    for (i = 0; i < COLS * ROWS; i++) on.push(false);
    for (g = 0; g < text.length && g < 4; g++) {
      rows = GLYPH[text.charAt(g)] || GLYPH[' '];
      for (r = 0; r < 7; r++) for (c = 0; c < 5; c++) {
        if (rows[r].charAt(c) === '1') on[(TOP + r) * COLS + g * pitch + c] = true;
      }
    }
    return on;
  }
  /* 上の段に下限、下の段に上限（どちらも4桁） */
  function rangePattern(lo, hi) {
    var on = [], i, g, r, c, rows, left = Math.floor((COLS - 15) / 2);
    for (i = 0; i < COLS * ROWS; i++) on.push(false);
    [lo, hi].forEach(function (text, line) {
      for (g = 0; g < 4; g++) {
        rows = GLYPH3[String(text).charAt(g)];
        if (!rows) continue;
        for (r = 0; r < 5; r++) for (c = 0; c < 3; c++) {
          if (rows[r].charAt(c) === '1') on[(line * 6 + r) * COLS + left + g * 4 + c] = true;
        }
      }
    });
    return on;
  }
  function paint(on) { wins.forEach(function (w, i) { w.classList.toggle('on', !!on[i]); }); }
  function townSet(text) { clearTimers(); paint(pattern(text)); }
  /* 下の階から順に、窓の明かりが灯っていく（1回だけ・約0.8秒）。数字を入れ替える演出はしない */
  function townRise(on) {
    clearTimers();
    if (reduce || !wins.length) { paint(on); return; }
    paint([]);
    for (var r = ROWS - 1; r >= 0; r--) (function (r) {
      later(function () {
        for (var c = 0; c < COLS; c++) wins[r * COLS + c].classList.toggle('on', on[r * COLS + c]);
      }, 120 + (ROWS - 1 - r) * 70);
    })(r);
  }
  /* 上の段に見本の下限、下の段に上限 */
  function townRange(lo, hi) { townRise(rangePattern(lo, hi)); }
  function townWipe(text) { townRise(pattern(text)); }
  if (wins.length) townWipe('???');

  /* ====================================================================
     画面の切り替え
     ==================================================================== */
  var views = all('.view', app);
  function show(name, focusTarget) {
    views.forEach(function (v) {
      var on = v.getAttribute('data-view') === name;
      v.hidden = !on;
      v.classList.toggle('is-in', on);
    });
    app.setAttribute('data-view', name);
    frameTown(name);
    var top = app.getBoundingClientRect().top + window.pageYOffset - (document.querySelector('.hd') || {}).offsetHeight || 0;
    if (Math.abs(window.pageYOffset - top) > 4) window.scrollTo(0, Math.max(0, top));
    if (focusTarget) { try { focusTarget.focus({ preventScroll: true }); } catch (e) { focusTarget.focus(); } }
  }

  /* 結果の画面では街並みの帯を低くする。横長の帯でも建物が切れないよう、絵全体を縮めて中央に置き、
     左右は遠景の街並みだけが続くようにする（スマホ幅では従来どおり切り抜き） */
  var townSvg = town ? town.querySelector('.town-svg') : null;
  function frameTown(name) {
    if (!townSvg) return;
    var box = town.getBoundingClientRect();
    var wide = name === 'res' && box.height > 0 && box.width / box.height > 1440 / 236;
    townSvg.setAttribute('viewBox', name === 'res' ? '0 16 1440 236' : '0 0 1440 260');
    townSvg.setAttribute('preserveAspectRatio', wide ? 'xMidYMax meet' : 'xMidYMax slice');
  }
  window.addEventListener('resize', function () { frameTown(app.getAttribute('data-view')); });

  /* ---------- はじめの画面：種別を選ぶ ---------- */
  all('[data-type]', document.querySelector('.start')).forEach(function (b) {
    var t = b.getAttribute('data-type');
    if (t !== 'other') {
      var on = function () { town.setAttribute('data-hl', t); };
      var off = function () { town.removeAttribute('data-hl'); };
      b.addEventListener('mouseenter', on); b.addEventListener('focus', on);
      b.addEventListener('mouseleave', off); b.addEventListener('blur', off);
    }
    b.addEventListener('click', function () {
      town.removeAttribute('data-hl');
      if (t === 'other') { town.removeAttribute('data-sel'); show('other', $('other-h')); return; }
      state.type = t;
      markType();
      town.setAttribute('data-sel', t);
      townSet('???');
      goStep(2);
    });
  });
  function markType() {
    all('.type').forEach(function (b) {
      if (b.getAttribute('data-type') === state.type) b.setAttribute('aria-pressed', 'true');
      else b.removeAttribute('aria-pressed');
    });
  }
  all('[data-go="intro"]').forEach(function (b) { b.addEventListener('click', toIntro); });
  [$('start-again'), $('dock-a')].forEach(function (again) { if (again) again.addEventListener('click', function (e) {
    e.preventDefault();
    if (app.getAttribute('data-view') !== 'intro') toIntro();
    window.scrollTo(0, 0);
    var first = document.querySelector('.type');
    if (first) { try { first.focus({ preventScroll: true }); } catch (err) { first.focus(); } }
  }); });

  /* スマホ：種別の選択が画面から外れたら、下に「はじめる」ボタンを出す（相談の章・入力中は出さない） */
  (function dock() {
    var d = $('dock'), start = document.querySelector('.start'), cta = $('consult');
    if (!d || !start || !('IntersectionObserver' in window)) return;
    var seen = { start: true, cta: false, startAbove: false };
    function upd() {
      var on = app.getAttribute('data-view') === 'intro' && !seen.start && !seen.cta && seen.startAbove;
      d.classList.toggle('is-on', on);
      document.body.classList.toggle('has-dock', on);
    }
    new IntersectionObserver(function (es) { es.forEach(function (e) { seen.start = e.isIntersecting; seen.startAbove = !e.isIntersecting && e.boundingClientRect.top < 0; }); upd(); }).observe(start);
    if (cta) new IntersectionObserver(function (es) { es.forEach(function (e) { seen.cta = e.isIntersecting; }); upd(); }, { rootMargin: '0px 0px -30% 0px' }).observe(cta);
    new MutationObserver(upd).observe(app, { attributes: true, attributeFilter: ['data-view'] });
  })();
  function toIntro() {
    town.removeAttribute('data-sel');
    townSet('???');
    show('intro', $('h1'));
  }

  /* ====================================================================
     入力（ステップ2〜4）
     ==================================================================== */
  var stepsForm = $('steps');
  var stepEls = all('.step', stepsForm);
  var progItems = all('#prog li');
  var nextT = $('next-t');

  /* 建てられた年の選択肢（西暦と和暦を併記） */
  var NOW = new Date().getFullYear();
  function wareki(y) {
    var e = y >= 2019 ? ['令和', 2018] : y >= 1989 ? ['平成', 1988] : ['昭和', 1925];
    var n = y - e[1];
    return e[0] + (n === 1 ? '元' : n) + '年';
  }
  (function fillYears() {
    var sel = $('year'), y, o;
    for (y = NOW; y >= 1960; y--) { o = el('option', null, y + '年（' + wareki(y) + '）'); o.value = String(y); sel.appendChild(o); }
    o = el('option', null, '1959年以前'); o.value = 'old'; sel.appendChild(o);
    o = el('option', null, 'わからない'); o.value = 'unknown'; sel.appendChild(o);
  })();

  function toHalf(s) {
    return String(s).replace(/[０-９．]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[,，\s　]/g, '');
  }
  function parseArea(v) {
    var s = toHalf(v).replace(/(m2|m²|㎡|平米)$/i, '');
    return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
  }
  function tsubo(m2) { return String(parseFloat((m2 * 121 / 400).toFixed(1))); } // 1坪＝400/121 m²。整数なら小数を出さない

  var AREA = {
    'a-sen': { key: 'sen', label: '専有面積', min: 10, max: 500 },
    'a-tochi': { key: 'tochi', label: '土地の面積', min: 20, max: 5000 },
    'a-tate': { key: 'tate', label: '建物の延床面積', min: 20, max: 1000 }
  };
  Object.keys(AREA).forEach(function (id) {
    var input = $(id), note = $(id + '-s');
    function sync() {
      var n = parseArea(input.value);
      note.textContent = isNaN(n) || n <= 0 ? '' : '約' + tsubo(n) + '坪';
      all('.chips button[data-set="' + id + '"]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(parseFloat(b.getAttribute('data-v')) === n));
      });
      if (input.getAttribute('aria-invalid') === 'true') clearErr(input);
    }
    input.addEventListener('input', function () { sync(); live(); });
    input.addEventListener('blur', function () {
      var n = parseArea(input.value);
      if (!isNaN(n)) input.value = String(n); // 全角の数字などを半角にそろえる
    });
    all('.chips button[data-set="' + id + '"]').forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { input.value = b.getAttribute('data-v'); sync(); live(); });
    });
  });
  $('year').addEventListener('change', function () {
    var v = this.value, note = $('year-s');
    note.textContent = /^\d+$/.test(v) ? (NOW - parseInt(v, 10) <= 0 ? '新築・築1年未満' : '築' + (NOW - parseInt(v, 10)) + '年') : '';
    clearErr(this);
    live();
  });
  ['pref', 'city'].forEach(function (id) {
    $(id).addEventListener(id === 'pref' ? 'change' : 'input', function () { clearErr(this); live(); });
  });
  all('input[name="purpose"]', stepsForm).forEach(function (r) { r.addEventListener('change', live); });

  /* 入力の途中でも、右（下）の「入力内容」にすぐ反映する（メモリ上の値を更新するだけ） */
  function live() {
    var n = state.step, r;
    if (n === 2) { state.pref = $('pref').value; state.city = $('city').value.trim(); }
    if (n === 3) {
      Object.keys(AREA).forEach(function (id) {
        var f = $(id), num = parseArea(f.value);
        state[AREA[id].key] = f.closest('.fld').hidden || isNaN(num) ? '' : String(num);
      });
      state.year = $('year').closest('.fld').hidden ? '' : $('year').value;
    }
    if (n === 4) { r = stepsForm.querySelector('input[name="purpose"]:checked'); state.purpose = r ? r.value : null; }
    renderTicket();
  }

  function setErr(input, msg) {
    var e = $(input.id + '-e');
    input.setAttribute('aria-invalid', 'true');
    if (e) { e.textContent = msg; e.hidden = false; }
  }
  function clearErr(input) {
    var e = $(input.id + '-e');
    input.removeAttribute('aria-invalid');
    if (e) { e.textContent = ''; e.hidden = true; }
  }

  function goStep(n) {
    state.step = n;
    stepEls.forEach(function (s) { s.hidden = parseInt(s.getAttribute('data-step'), 10) !== n; });
    if (n === 3) {
      all('.fld[data-for]', stepsForm).forEach(function (f) {
        f.hidden = f.getAttribute('data-for').split(' ').indexOf(state.type) === -1;
      });
      var h3 = $('step3-h');
      h3.textContent = '';
      [state.type === 'tochi' ? '土地の広さを' : '広さと築年を', '教えてください。'].forEach(function (t) { h3.appendChild(el('span', 'nb', t)); });
    }
    progItems.forEach(function (li, i) {
      li.className = i + 1 < n ? 'is-done' : i + 1 === n ? 'is-now' : '';
    });
    $('prog').setAttribute('aria-label', 'ステップ ' + n + ' / 4：' + STEP_LABEL[n]);
    $('prog-t').textContent = 'ステップ ' + n + ' / 4｜' + STEP_LABEL[n];
    nextT.textContent = n === 4 ? '結果の見本を見る' : '次へ';
    renderTicket();
    var cur = stepEls.filter(function (s) { return !s.hidden; })[0];
    show('wiz', cur ? cur.querySelector('.step-h') : null);
  }

  function validateStep(n) {
    var errs = [], input, v, y;
    if (n === 2) {
      input = $('pref');
      if (!input.value) errs.push([input, '都道府県を選んでください。']);
      input = $('city'); v = input.value.trim();
      if (!v) errs.push([input, '市区町村を入力してください。（例：杉並区）']);
      else if (/[0-9０-９]/.test(v)) errs.push([input, '市区町村名だけを入力してください。（番地は不要です）']);
      if (!errs.length) { state.pref = $('pref').value; state.city = v; }
    }
    if (n === 3) {
      Object.keys(AREA).forEach(function (id) {
        var f = $(id), a = AREA[id];
        if (f.closest('.fld').hidden) { state[a.key] = ''; return; }
        var num = parseArea(f.value);
        if (!f.value.trim()) errs.push([f, a.label + 'を入力してください。おおよその数字で構いません。']);
        else if (isNaN(num)) errs.push([f, a.label + 'は、m²の数字だけを入力してください。（例：70）坪数なら、3.3を掛けた数が目安です。']);
        else if (num < a.min || num > a.max) errs.push([f, a.label + 'は、' + fmt(a.min) + '〜' + fmt(a.max) + 'm²の範囲で入力してください。']);
        else state[a.key] = String(num);
      });
      y = $('year');
      if (y.closest('.fld').hidden) state.year = '';
      else if (!y.value) errs.push([y, '建てられた年を選んでください。わからない場合は「わからない」を選べます。']);
      else state.year = y.value;
    }
    if (n === 4) {
      var r = stepsForm.querySelector('input[name="purpose"]:checked');
      state.purpose = r ? r.value : '';
    }
    all('[aria-invalid="true"]', stepsForm).forEach(clearErr);
    errs.forEach(function (p) { setErr(p[0], p[1]); });
    if (errs.length) errs[0][0].focus();
    return !errs.length;
  }

  stepsForm.addEventListener('submit', function (e) {
    e.preventDefault(); // どこにも送信しない
    if (!validateStep(state.step)) return;
    if (state.step < 4) goStep(state.step + 1);
    else { renderTicket(); result(); } // 待ち時間の演出はしない（計算していないため）
  });
  $('back').addEventListener('click', function () {
    if (state.step > 2) goStep(state.step - 1);
    else toIntro();
  });

  /* ---------- 入力内容の票 ---------- */
  function ticketValues() {
    var size = '', year = '', sub = '';
    if (state.type === 'mansion' && state.sen) { size = '専有 ' + state.sen + 'm²'; sub = '約' + tsubo(parseFloat(state.sen)) + '坪'; }
    if (state.type === 'kodate' && state.tochi) { size = '土地 ' + state.tochi + 'm²'; sub = state.tate ? '建物 ' + state.tate + 'm²' : ''; }
    if (state.type === 'tochi' && state.tochi) { size = '土地 ' + state.tochi + 'm²'; sub = '約' + tsubo(parseFloat(state.tochi)) + '坪'; }
    if (state.type === 'tochi') year = state.tochi ? NOYEAR : '';
    else if (/^\d+$/.test(state.year)) year = state.year + '年（築' + Math.max(0, NOW - parseInt(state.year, 10)) + '年）';
    else if (state.year === 'old') year = '1959年以前';
    else if (state.year === 'unknown') year = 'わからない';
    return {
      type: [TYPE_LABEL[state.type] || ''],
      area: [state.pref ? state.pref + ' ' + state.city : ''],
      size: [size, sub],
      year: [year],
      purpose: [state.purpose === null ? '' : state.purpose || '選んでいません']
    };
  }
  function renderTicket() {
    var v = ticketValues();
    ['tk', 'tk2'].forEach(function (id) {
      all('#' + id + ' dd').forEach(function (dd) {
        var val = v[dd.getAttribute('data-k')] || [''];
        dd.textContent = '';
        dd.classList.toggle('is-empty', !val[0]);
        dd.appendChild(document.createTextNode(val[0] || '—'));
        if (val[1]) dd.appendChild(el('small', null, val[1]));
      });
    });
  }

  /* ====================================================================
     結果（見本）
     ==================================================================== */
  function result() {
    var d = SAMPLE; // 入力内容にかかわらず、同じ見本
    renderTicket();

    var sp = $('s-spec');
    sp.textContent = '';
    sp.appendChild(el('span', 'nb', d.kind + '｜'));
    d.spec.split('／').forEach(function (t, i, a) { sp.appendChild(el('span', 'nb', t + (i < a.length - 1 ? '／' : ''))); });
    $('s-why').textContent = d.why;
    var tv = ticketValues();
    var where = [tv.type[0], tv.area[0]].filter(Boolean).join('・');
    var sn = $('s-not');
    sn.textContent = '';
    var tx = function (t) { sn.appendChild(document.createTextNode(t)); };
    tx('上の金額と窓の数字は、架空の物件'); sn.appendChild(el('span', 'nb', '（' + d.spec.replace('／', '・') + '）の')); tx('見本です。ご入力の物件');
    if (where) sn.appendChild(el('span', 'nb', '（' + where + '）の')); else tx('の');
    sn.appendChild(el('span', 'nb', '価格ではありません。'));
    var si = $('s-in');
    si.textContent = '';
    [tv.type[0], tv.area[0], tv.size.filter(Boolean).join('・'), tv.year[0]].filter(function (x) { return x && x !== NOYEAR; })
      .forEach(function (t, i, a) { si.appendChild(el('span', 'nb', t + (i < a.length - 1 ? '／' : ''))); });
    si.appendChild(el('span', 'nb', '（この見本には')); si.appendChild(el('span', 'nb', '反映していません）'));
    $('s-low').textContent = fmt(d.low);
    $('s-high').textContent = fmt(d.high);
    var un = $('s-unit');
    un.textContent = '';
    d.unit.forEach(function (t) { un.appendChild(el('span', 'nb', t)); });

    /* 価格帯のメーター */
    var pos = function (v) { return (v - d.min) / (d.max - d.min) * 100; };
    $('meter-f').style.left = pos(d.low) + '%';
    $('meter-f').style.width = (pos(d.high) - pos(d.low)) + '%';
    $('meter-c').style.left = pos(d.mid) + '%';
    var ct = $('meter-ct');
    ct.textContent = '';
    var cs = el('span', null, 'まんなか ' + fmt(d.mid) + '万円');
    cs.style.left = pos(d.mid) + '%';
    ct.appendChild(cs);
    $('meter-min').textContent = fmt(d.min) + '万円';
    $('meter-max').textContent = fmt(d.max) + '万円';
    $('meter-t').textContent = '参考価格帯は' + fmt(d.low) + '万円から' + fmt(d.high) + '万円、まんなかは' + fmt(d.mid) + '万円（架空の見本）';

    /* 価格を左右するポイント（棒は飾りで、内容は文字でも読める） */
    var fac = $('fac');
    fac.textContent = '';
    var WORD = { '2': '大きく押し上げ', '1': 'やや押し上げ', '-1': 'やや押し下げ', '-2': '大きく押し下げ' };
    d.factors.forEach(function (f) {
      var word = WORD[String(f[1])];
      var row = el('li', 'fac-r');
      row.appendChild(el('span', 'fac-n', f[0]));
      var bar = el('span', 'fac-b');
      bar.setAttribute('aria-hidden', 'true');
      var b = el('i', f[1] > 0 ? 'up' : 'dn');
      b.style.width = (Math.abs(f[1]) / 2 * 46) + '%';
      bar.appendChild(b);
      row.appendChild(bar);
      row.appendChild(el('span', 'fac-v', word));
      row.appendChild(el('span', 'fac-w', f[2]));
      fac.appendChild(row);
    });

    /* 知りたい理由に合わせた、相談のご案内 */
    tailor();

    show('res', $('res-h'));
    townRange(String(d.low), String(d.high));
  }
  /* ---------- 相談のご案内を、選んだ理由に合わせる ---------- */
  var GUIDE = {
    '売却を考えている': '売却をお考えの場合は、売り出す価格の考え方について、不動産鑑定士がご相談に応じます。',
    '住み替えを考えている': '住み替えをお考えの場合は、いまの家の価格の考え方について、不動産鑑定士がご相談に応じます。',
    '相続・贈与のため': '相続や遺産分割では、不動産の評価が話し合いの土台になります。鑑定評価が必要かどうかから、ご相談いただけます。',
    '資産として把握したい': '資産の把握が目的の場合は、どの程度の調査が要るかを、ご相談のなかでお伝えします。'
  };
  function tailor() {
    var box = $('cta-x'), topic = $('f-topic');
    box.textContent = '';
    box.hidden = true;
    if (!state.purpose) return;
    if (state.purpose === '離婚・財産分与のため') {
      box.appendChild(document.createTextNode('離婚・財産分与にともなう不動産の評価は、専用のページでご案内しています。'));
      var a = el('a', null, '離婚時の不動産鑑定を見る（A案のデモへ）');
      a.href = '../a-rikon/index.html';
      box.appendChild(el('br'));
      box.appendChild(a);
    } else if (GUIDE[state.purpose]) {
      box.textContent = GUIDE[state.purpose];
    } else return;
    box.hidden = false;
    all('option', topic).forEach(function (o) { if (o.textContent === state.purpose) topic.value = o.value || o.textContent; });
  }

  all('[data-restart]').forEach(function (rb) { rb.addEventListener('click', function () {
    state = { type: '', pref: '', city: '', sen: '', tochi: '', tate: '', year: '', purpose: null, step: 2 };
    stepsForm.reset();
    all('.tsubo', stepsForm).forEach(function (s) { s.textContent = ''; });
    all('.chips button', stepsForm).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    all('[aria-invalid="true"]', stepsForm).forEach(clearErr);
    $('cta-x').hidden = true;
    markType();
    toIntro();
  }); });

  /* ====================================================================
     相談の予約フォーム（デモ。送信も保存もしない）
     ==================================================================== */
  var form = $('form'), done = $('done'), summary = $('f-err');
  if (form && done) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errs = [], name = form.elements.name, contact = form.elements.contact;
      [name, contact].forEach(clearErr);
      if (!name.value.trim()) errs.push([name, 'お名前を入力してください。']);
      var c = toHalf(contact.value.trim()).replace(/[ー－―‐]/g, '-');
      var digits = c.replace(/[^0-9]/g, '');
      if (!c) errs.push([contact, '電話番号かメールアドレスを入力してください。']);
      else if (c.indexOf('@') !== -1) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) errs.push([contact, 'メールアドレスの形をご確認ください。（例：name@example.com）']); }
      else if (digits.length < 10 || digits.length > 11) errs.push([contact, '電話番号なら市外局番から10〜11桁、メールアドレスなら「@」を含む形で入力してください。（例：090-1234-5678／name@example.com）']);
      summary.textContent = '';
      if (errs.length) {
        summary.appendChild(el('b', null, '入力内容をご確認ください（' + errs.length + '件）'));
        errs.forEach(function (p) {
          setErr(p[0], p[1]);
          var a = el('a', null, p[1]); a.href = '#' + p[0].id;
          var d = el('div'); d.appendChild(a); summary.appendChild(d);
        });
        summary.hidden = false;
        summary.focus();
        return;
      }
      summary.hidden = true;
      form.reset(); // 入力内容はここで破棄する
      form.hidden = true;
      done.hidden = false;
      done.focus();
    });
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true') clearErr(e.target);
    });
    $('done-back').addEventListener('click', function () {
      done.hidden = true; form.hidden = false; form.elements.name.focus();
    });
  }
})();
