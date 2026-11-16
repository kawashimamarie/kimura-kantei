/* B案｜AI不動産価値チェック（打ち合わせ用コンセプトデモ）
   ・入力内容は、ページを表示している間だけメモリ上に持つ。
     保存（Cookie・localStorage・sessionStorage・IndexedDB）も、送信（fetch・XHR・フォーム送信・画像ビーコン）もしない。
   ・価格の計算はしない。結果画面の数値は、下の SAMPLE に書いた架空の固定値で、入力内容とは連動しない。
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
     架空のサンプルデータ（種別ごとに固定。入力内容からは作らない）
     ==================================================================== */
  var YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  var SAMPLE = {
    mansion: {
      spec: '専有面積 68m²／築16年／7階（12階建て）／駅から徒歩7分',
      low: 3680, mid: 3960, high: 4240, min: 3400, max: 4500, digits: '3960',
      unit: '中心の価格を面積で割ると、1m²あたり約58万円',
      factors: [
        ['駅からの距離', 3.2, '徒歩7分。地域の平均より駅に近い'],
        ['階数・向き', 1.8, '7階・南東向き'],
        ['周辺の取引の動き', 0.9, 'この1年、近くの成約価格がゆるやかに上昇'],
        ['管理費・修繕積立金', -1.1, '近くの同規模の物件より、やや高め'],
        ['築年数', -2.6, '築16年。地域の平均より古い']
      ],
      trend: [100, 102, 105, 107, 108, 112, 118, 124, 129, 133]
    },
    kodate: {
      spec: '土地 112m²／建物 96m²／木造2階建て／築21年／駅から徒歩12分',
      low: 4320, mid: 4680, high: 5040, min: 4000, max: 5400, digits: '4680',
      unit: '中心の価格の内訳は、土地 3,560万円、建物 1,120万円',
      split: [['土地', 3560], ['建物', 1120]],
      factors: [
        ['土地の形・道路との関係', 2.4, '整った形で、南側の道路に面している'],
        ['周辺の取引の動き', 1.2, 'この1年、近くの土地の成約価格が上昇'],
        ['日当たり・向き', 0.8, '南向きで、前面に高い建物がない'],
        ['駅からの距離', -1.5, '徒歩12分。地域の平均より遠い'],
        ['建物の築年数', -3.1, '築21年の木造']
      ],
      trend: [100, 101, 103, 104, 105, 108, 113, 118, 122, 125]
    },
    tochi: {
      spec: '土地 148m²／第一種低層住居専用地域／南側6m道路に面する',
      low: 5110, mid: 5480, high: 5850, min: 4800, max: 6200, digits: '5480',
      unit: '中心の価格を面積で割ると、1m²あたり約37万円',
      factors: [
        ['面している道路', 2.8, '南側で幅6m。建物を建てやすい'],
        ['周辺の取引の動き', 1.4, 'この1年、近くの土地の成約価格が上昇'],
        ['土地の形', 1.1, '間口が広く、整った形'],
        ['建てられる大きさの制限', -0.6, '低層の住宅向けの地域で、建物の大きさに上限がある'],
        ['駅からの距離', -2.0, '徒歩14分。地域の平均より遠い']
      ],
      trend: [100, 101, 103, 105, 106, 109, 114, 119, 123, 127]
    }
  };
  var TYPE_LABEL = { mansion: 'マンション', kodate: '一戸建て', tochi: '土地' };
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
  function svgEl(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
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
  function paint(on) { wins.forEach(function (w, i) { w.classList.toggle('on', !!on[i]); }); }
  function townSet(text) { clearTimers(); paint(pattern(text)); }
  /* 左の列から順に灯す（1回だけ・約1秒） */
  function townWipe(text) {
    clearTimers();
    var on = pattern(text);
    if (reduce || !wins.length) { paint(on); return; }
    paint([]);
    for (var c = 0; c < COLS; c++) (function (c) {
      later(function () {
        for (var r = 0; r < ROWS; r++) wins[r * COLS + c].classList.toggle('on', on[r * COLS + c]);
      }, 150 + c * 36);
    })(c);
  }
  /* 数字がぱらぱらと入れ替わって、指定の表示に落ち着く（約0.6秒） */
  function townShuffle(text) {
    clearTimers();
    if (reduce || !wins.length) { paint(pattern(text)); return; }
    var n = 0;
    (function tick() {
      if (n++ < 6) {
        var t = '';
        for (var i = 0; i < 4; i++) t += String(Math.floor(Math.random() * 10));
        paint(pattern(t));
        later(tick, 90);
      } else paint(pattern(text));
    })();
  }
  /* 縦の帯が左から右へ流れる（チェック中の表示） */
  function townScan(ms) {
    clearTimers();
    if (reduce || !wins.length) return;
    var start = Date.now();
    (function tick() {
      var t = Date.now() - start;
      if (t > ms) return;
      var col = Math.floor((t / 28) % (COLS + 6)) - 3, on = [], r, c;
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) on.push(c >= col && c < col + 3);
      paint(on);
      later(tick, 28);
    })();
  }
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
    var top = app.getBoundingClientRect().top + window.pageYOffset - (document.querySelector('.hd') || {}).offsetHeight || 0;
    if (Math.abs(window.pageYOffset - top) > 4) window.scrollTo(0, Math.max(0, top));
    if (focusTarget) { try { focusTarget.focus({ preventScroll: true }); } catch (e) { focusTarget.focus(); } }
  }

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
      town.setAttribute('data-sel', t);
      townShuffle('???');
      goStep(2);
    });
  });
  all('[data-go="intro"]').forEach(function (b) { b.addEventListener('click', toIntro); });
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
  function tsubo(m2) { return (m2 * 121 / 400).toFixed(1); } // 1坪＝400/121 m²

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
      $('step3-h').textContent = state.type === 'tochi' ? '土地の広さを教えてください。' : '広さと築年を教えてください。';
    }
    progItems.forEach(function (li, i) {
      li.className = i + 1 < n ? 'is-done' : i + 1 === n ? 'is-now' : '';
    });
    $('prog').setAttribute('aria-label', 'ステップ ' + n + ' / 4：' + STEP_LABEL[n]);
    $('prog-t').textContent = 'ステップ ' + n + ' / 4｜' + STEP_LABEL[n];
    nextT.textContent = n === 4 ? 'チェックを開始する' : '次へ';
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
      else if (/[0-9０-９]/.test(v)) errs.push([input, '市区町村までで大丈夫です。番地の数字は入れずにご入力ください。']);
      if (!errs.length) { state.pref = $('pref').value; state.city = v; }
    }
    if (n === 3) {
      Object.keys(AREA).forEach(function (id) {
        var f = $(id), a = AREA[id];
        if (f.closest('.fld').hidden) { state[a.key] = ''; return; }
        var num = parseArea(f.value);
        if (!f.value.trim()) errs.push([f, a.label + 'を入力してください。おおよその数字で構いません。']);
        else if (isNaN(num)) errs.push([f, a.label + 'は、数字で入力してください。（例：70）']);
        else if (num < a.min || num > a.max) errs.push([f, a.label + 'は、' + fmt(a.min) + '〜' + fmt(a.max) + 'm²の範囲で入力してください。']);
        else state[a.key] = String(num);
      });
      y = $('year');
      if (y.closest('.fld').hidden) state.year = '';
      else if (!y.value) errs.push([y, '建てられた年を選んでください。分からない場合は「わからない」を選べます。']);
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
    else run();
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
    if (state.type === 'tochi') year = state.tochi ? '（土地のため不要）' : '';
    else if (/^\d+$/.test(state.year)) year = state.year + '年（築' + Math.max(0, NOW - parseInt(state.year, 10)) + '年）';
    else if (state.year === 'old') year = '1959年以前';
    else if (state.year === 'unknown') year = 'わからない';
    return {
      type: [TYPE_LABEL[state.type] || ''],
      area: [state.pref ? state.pref + ' ' + state.city : ''],
      size: [size, sub],
      year: [year],
      purpose: [state.purpose === null ? '' : state.purpose || '（選択なし）']
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
     チェック中の表示（デモ。実際の解析はしない）
     ==================================================================== */
  var runItems = all('#run-l li');
  var runTimers = [];
  function run() {
    renderTicket();
    runItems.forEach(function (li) { li.className = ''; });
    $('run-live').textContent = '結果画面を準備しています。';
    show('run', $('run-h'));
    if (reduce) { runItems.forEach(function (li) { li.className = 'is-done'; }); result(); return; }
    var STEP = 620;
    townScan(STEP * runItems.length);
    runItems.forEach(function (li, i) {
      runTimers.push(setTimeout(function () {
        if (i > 0) runItems[i - 1].className = 'is-done';
        li.className = 'is-now';
      }, i * STEP));
    });
    runTimers.push(setTimeout(function () {
      runItems[runItems.length - 1].className = 'is-done';
      result();
    }, runItems.length * STEP + 250));
  }
  $('skip').addEventListener('click', function () { result(); });

  /* ====================================================================
     結果（表示サンプル）
     ==================================================================== */
  var tip = $('tip');
  function showTip(title, text, rect) {
    tip.textContent = '';
    tip.appendChild(el('b', null, title));
    if (text) tip.appendChild(document.createTextNode(text));
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 8);
    var y = rect.top - h - 8;
    if (y < 8) y = rect.bottom + 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hideTip() { tip.hidden = true; }
  window.addEventListener('scroll', hideTip, { passive: true });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });

  function result() {
    runTimers.forEach(clearTimeout); runTimers = [];
    var d = SAMPLE[state.type] || SAMPLE.mansion;
    renderTicket();

    $('s-spec').textContent = d.spec;
    $('s-low').textContent = fmt(d.low);
    $('s-high').textContent = fmt(d.high);
    $('s-unit').textContent = d.unit;

    /* 価格帯のメーター */
    var pos = function (v) { return (v - d.min) / (d.max - d.min) * 100; };
    $('meter-f').style.left = pos(d.low) + '%';
    $('meter-f').style.width = (pos(d.high) - pos(d.low)) + '%';
    $('meter-c').style.left = pos(d.mid) + '%';
    var ct = $('meter-ct');
    ct.textContent = '';
    var cs = el('span', null, '中心 ' + fmt(d.mid) + '万円');
    cs.style.left = pos(d.mid) + '%';
    ct.appendChild(cs);
    $('meter-min').textContent = fmt(d.min) + '万円';
    $('meter-max').textContent = fmt(d.max) + '万円';
    $('meter-t').textContent = '参考価格帯は' + fmt(d.low) + '万円から' + fmt(d.high) + '万円、中心は' + fmt(d.mid) + '万円（架空のサンプル）';

    /* 土地と建物の内訳（一戸建てのサンプルのみ） */
    var split = $('split');
    split.hidden = !d.split;
    if (d.split) {
      var seg = $('seg'), lg = $('seg-lg'), total = d.split[0][1] + d.split[1][1];
      seg.textContent = ''; lg.textContent = '';
      seg.setAttribute('aria-label', d.split.map(function (s) { return s[0] + ' ' + fmt(s[1]) + '万円（' + Math.round(s[1] / total * 100) + '％）'; }).join('、'));
      d.split.forEach(function (s, i) {
        var b = el('i', 's' + (i + 1), fmt(s[1]) + '万円');
        b.style.flex = s[1] + ' 1 0';
        seg.appendChild(b);
        var li = el('li');
        li.appendChild(el('i', 's' + (i + 1)));
        li.appendChild(document.createTextNode(s[0] + '（' + Math.round(s[1] / total * 100) + '％）'));
        lg.appendChild(li);
      });
    }

    /* 価格を左右するポイント */
    var fac = $('fac'), ftb = $('fac-t').tBodies[0];
    fac.textContent = ''; ftb.textContent = '';
    var maxAbs = Math.max.apply(null, d.factors.map(function (f) { return Math.abs(f[1]); }));
    d.factors.forEach(function (f) {
      var sign = (f[1] > 0 ? '＋' : '−') + Math.abs(f[1]).toFixed(1) + '％';
      var row = el('div', 'fac-r');
      row.tabIndex = 0;
      row.setAttribute('role', 'img');
      row.setAttribute('aria-label', f[0] + '：' + sign + '。' + f[2]);
      row.appendChild(el('span', 'fac-n', f[0]));
      var bar = el('span', 'fac-b');
      var b = el('i', f[1] > 0 ? 'up' : 'dn');
      b.style.width = (Math.abs(f[1]) / maxAbs * 46) + '%';
      bar.appendChild(b);
      row.appendChild(bar);
      row.appendChild(el('span', 'fac-v', sign));
      var on = function () { showTip(sign, f[2], bar.getBoundingClientRect()); };
      row.addEventListener('mouseenter', on); row.addEventListener('focus', on);
      row.addEventListener('mouseleave', hideTip); row.addEventListener('blur', hideTip);
      fac.appendChild(row);
      var tr = el('tr');
      tr.appendChild(el('td', null, f[0])); tr.appendChild(el('td', null, sign)); tr.appendChild(el('td', null, f[2]));
      ftb.appendChild(tr);
    });

    /* 知りたい理由に合わせた、相談のご案内 */
    tailor();

    townSet(d.digits);
    show('res', $('res-h'));
    drawTrend(d.trend); // 表示してから描く（表示幅に合わせるため）
    if (!reduce) townShuffle(d.digits);
  }
  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (app.getAttribute('data-view') === 'res' && SAMPLE[state.type]) { hideTip(); drawTrend(SAMPLE[state.type].trend); }
    }, 150);
  });

  /* ---------- 推移の折れ線 ---------- */
  function drawTrend(vals) {
    var box = $('trend'), ttb = $('trend-t').tBodies[0];
    box.textContent = ''; ttb.textContent = '';
    var W = Math.max(280, Math.round(box.clientWidth || 640)), H = W < 480 ? 210 : 240, L = 36, R = 42, T = 16, B = 30;
    var lo = 90, hi = Math.ceil((Math.max.apply(null, vals) + 2) / 10) * 10;
    var x = function (i) { return L + (W - L - R) * i / (vals.length - 1); };
    var y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '2016年の100から、2025年の' + vals[vals.length - 1] + 'まで上昇している折れ線グラフ（架空のサンプル）' });
    var v, i, t;
    for (v = 100; v <= hi; v += 10) {
      svg.appendChild(svgEl('line', { class: 'tr-g', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      t = svgEl('text', { class: 'tr-ax', x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }); t.textContent = v; svg.appendChild(t);
    }
    for (i = 0; i < vals.length; i += 3) {
      t = svgEl('text', { class: 'tr-ax', x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === vals.length - 1 ? 'end' : 'middle' });
      t.textContent = YEARS[i] + '年'; svg.appendChild(t);
    }
    var line = vals.map(function (val, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(val).toFixed(1); }).join('');
    svg.appendChild(svgEl('path', { class: 'tr-area', d: line + 'L' + x(vals.length - 1) + ',' + y(lo) + 'L' + x(0) + ',' + y(lo) + 'Z' }));
    svg.appendChild(svgEl('path', { class: 'tr-line', d: line }));
    var xl = svgEl('line', { class: 'tr-x', y1: T, y2: y(lo) }); svg.appendChild(xl);
    var last = vals.length - 1;
    svg.appendChild(svgEl('circle', { class: 'tr-dot', cx: x(last), cy: y(vals[last]), r: 5 }));
    t = svgEl('text', { class: 'tr-end', x: x(last) + 10, y: y(vals[last]) + 5 }); t.textContent = vals[last]; svg.appendChild(t);
    var xd = svgEl('circle', { class: 'tr-xd', r: 5 }); svg.appendChild(xd);
    box.appendChild(svg);

    vals.forEach(function (val, i) {
      var tr = el('tr'); tr.appendChild(el('td', null, YEARS[i] + '年')); tr.appendChild(el('td', null, String(val))); ttb.appendChild(tr);
    });

    var cur = last;
    function at(i) {
      cur = Math.max(0, Math.min(last, i));
      xl.setAttribute('x1', x(cur)); xl.setAttribute('x2', x(cur));
      xd.setAttribute('cx', x(cur)); xd.setAttribute('cy', y(vals[cur]));
      box.classList.add('is-on');
      var r = svg.getBoundingClientRect(), s = r.width / W;
      showTip('指数 ' + vals[cur], YEARS[cur] + '年', { left: r.left + x(cur) * s - 1, width: 2, top: r.top + y(vals[cur]) * s - 6, bottom: r.top + y(vals[cur]) * s + 6 });
    }
    function off() { box.classList.remove('is-on'); hideTip(); }
    box.onpointermove = function (e) {
      var r = svg.getBoundingClientRect();
      at(Math.round(((e.clientX - r.left) / r.width * W - L) / ((W - L - R) / last)));
    };
    box.onpointerleave = off;
    box.onfocus = function () { at(cur); };
    box.onblur = off;
    box.onkeydown = function (e) {
      if (e.key === 'ArrowLeft') { at(cur - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { at(cur + 1); e.preventDefault(); }
      if (e.key === 'Home') { at(0); e.preventDefault(); }
      if (e.key === 'End') { at(last); e.preventDefault(); }
    };
  }

  /* ---------- 相談のご案内を、選んだ理由に合わせる ---------- */
  var GUIDE = {
    '売却を考えている': '売却のご相談では、査定に、不動産鑑定士・一級建築士の助言を添えてお手伝いします。',
    '住み替えを考えている': '売却・買い替えのご相談では、査定に、不動産鑑定士・一級建築士の助言を添えてお手伝いします。',
    '相続・贈与のため': '相続や遺産分割では、不動産の評価が話し合いの土台になります。鑑定評価が必要かどうかから、ご相談いただけます。',
    '資産として把握したい': '資産の把握が目的の場合は、どの程度の調査が要るかを、無料相談でお伝えします。'
  };
  function tailor() {
    var box = $('cta-x'), topic = $('f-topic');
    box.textContent = '';
    box.hidden = true;
    if (!state.purpose) return;
    if (state.purpose === '離婚・財産分与のため') {
      box.appendChild(document.createTextNode('離婚・財産分与にともなう不動産の評価は、専用のページでご案内しています。'));
      var a = el('a', null, '離婚時の不動産鑑定を見る（A案のデモへ）');
      a.href = '../a-rikon/';
      box.appendChild(el('br'));
      box.appendChild(a);
    } else if (GUIDE[state.purpose]) {
      box.textContent = GUIDE[state.purpose];
    } else return;
    box.hidden = false;
    all('option', topic).forEach(function (o) { if (o.textContent === state.purpose) topic.value = o.value || o.textContent; });
  }

  $('restart').addEventListener('click', function () {
    state = { type: '', pref: '', city: '', sen: '', tochi: '', tate: '', year: '', purpose: null, step: 2 };
    stepsForm.reset();
    all('.tsubo', stepsForm).forEach(function (s) { s.textContent = ''; });
    all('.chips button', stepsForm).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    all('[aria-invalid="true"]', stepsForm).forEach(clearErr);
    $('cta-x').hidden = true;
    hideTip();
    toIntro();
  });

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
      else if (c.indexOf('@') !== -1) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) errs.push([contact, 'メールアドレスの形式を確認してください。（例：name@example.com）']); }
      else if (digits.length < 10 || digits.length > 11) errs.push([contact, '電話番号は、市外局番から10〜11桁で入力してください。（例：090-1234-5678）']);
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
