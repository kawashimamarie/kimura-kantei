/* Fable版 B案（確認用デモ）
   ・価格は計算しません。結果の見本は index.html に書かれた固定の架空データで、入力内容と連動しません。
   ・入力内容は、このページのメモリ上だけで扱います。送信・保存はしません。
     Cookie・localStorage・sessionStorage・外部通信（fetch 等）・AIのAPIは使っていません。 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 入力ウィザード ---------- */
  var bar = $('#sp-bar');
  var form = $('#ck-form');
  if (form) {
    var PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
    var TYPES = { mansion: 'マンション（一室）', house: '一戸建て', land: '土地' };
    var prefSel = $('#ck-pref');
    PREFS.forEach(function (p) { var o = document.createElement('option'); o.textContent = p; o.value = p; prefSel.appendChild(o); });

    var step = 1, LAST = 4;
    var back = $('#ck-back'), next = $('#ck-next');
    var steps = $$('.ck-step', form), prog = $$('#ck-prog li');
    var el = function (n) { return form.elements[n]; };
    var fld = function (n) { return $('[data-f="' + n + '"]', form); };

    function toHalf(v) { return String(v).replace(/[０-９．]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[，,\s]/g, '').trim(); }
    function type() { var c = $('input[name="type"]:checked', form); return c ? c.value : ''; }
    function num(n) { return Number(toHalf(el(n).value)); }
    function fmt(n) { return String(Math.round(n * 100) / 100); }

    function setErr(n, msg) {
      var box = n === 'type' ? $('#e-type') : $('#e-' + n);
      box.textContent = msg || '';
      if (n !== 'type') {
        fld(n).classList.toggle('is-error', !!msg);
        if (msg) el(n).setAttribute('aria-invalid', 'true'); else el(n).removeAttribute('aria-invalid');
      }
    }

    function area(label, min, max) {
      return function (raw) {
        var v = toHalf(raw);
        if (!v) return label + 'を入力してください。';
        if (!/^\d+(\.\d+)?$/.test(v)) return '数字で入力してください（例：70）。';
        var x = Number(v);
        if (x < min) return min + '㎡以上の数字を入力してください。';
        if (x > max) return max.toLocaleString('ja-JP') + '㎡を超える不動産は、チェックの対象外です。鑑定士へのご相談をご利用ください。';
        return '';
      };
    }
    var rules = {
      pref: function (v) { return v ? '' : '都道府県を選んでください。'; },
      city: function (v) {
        v = v.trim();
        if (!v) return '市区町村を入力してください。';
        if (/[0-9０-９]/.test(v)) return '番地は要りません。市区町村名だけを入力してください。';
        if (v.length > 20) return '20文字以内で入力してください。';
        return '';
      },
      senyu: area('専有面積', 10, 500),
      tochi: area('土地の面積', 10, 3000),
      tatemono: area('建物の延床面積', 10, 1000),
      chiku: function (raw) {
        var v = toHalf(raw);
        if ($('#ck-chiku-unknown').checked) return '';
        if (!v) return '築年数を入力するか、「わからない」を選んでください。';
        if (!/^\d+$/.test(v)) return '年数を整数で入力してください（例：18）。';
        if (Number(v) > 100) return '100年以内の数字を入力してください。';
        return '';
      }
    };
    function fieldsOf(s) {
      if (s === 2) return ['pref', 'city'];
      if (s === 3) return $$('[data-for]', form).filter(function (f) { return f.dataset.for.split(' ').indexOf(type()) >= 0; }).map(function (f) { return f.dataset.f; });
      return [];
    }
    function validate(s) {
      var bad = [];
      if (s === 1) { var ok = !!type(); setErr('type', ok ? '' : '物件の種別を選んでください。'); if (!ok) bad.push($('input[name="type"]', form)); }
      fieldsOf(s).forEach(function (n) { var m = rules[n](el(n).value); setErr(n, m); if (m) bad.push(el(n)); });
      if (bad.length) { bad[0].focus(); return false; }
      return true;
    }

    function values() {
      var t = type(), a = [];
      if (t === 'mansion') a.push('専有 ' + fmt(num('senyu')) + '㎡');
      if (t === 'house' || t === 'land') a.push('土地 ' + fmt(num('tochi')) + '㎡');
      if (t === 'house') a.push('建物 ' + fmt(num('tatemono')) + '㎡');
      return {
        type: TYPES[t] || '',
        place: (el('pref').value || '') + (el('city').value.trim() ? ' ' + el('city').value.trim() : ''),
        area: a.join('・'),
        chiku: t === 'land' ? '—（土地のため入力なし）' : ($('#ck-chiku-unknown').checked ? 'わからない' : (toHalf(el('chiku').value) === '' ? '' : '築 ' + Number(toHalf(el('chiku').value)) + '年'))
      };
    }
    var LABELS = { type: '種別', place: '所在地', area: '広さ', chiku: '築年数' };
    function fillList(dl, v) {
      dl.textContent = '';
      Object.keys(LABELS).forEach(function (k) {
        var d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = LABELS[k]; dd.textContent = v[k] || '—'; d.appendChild(dt); d.appendChild(dd); dl.appendChild(d);
      });
    }
    function summary() {
      var v = { type: TYPES[type()] || '', place: '', area: '', chiku: '' };
      if (step > 2) v.place = values().place;
      if (step > 3) { v.area = values().area; v.chiku = values().chiku; }
      $$('#ck-summary dd').forEach(function (dd) { dd.textContent = v[dd.dataset.k] || '—'; });
    }

    function show(s, focus) {
      step = s;
      steps.forEach(function (f) { f.hidden = Number(f.dataset.step) !== s; });
      prog.forEach(function (li) {
        var n = Number(li.dataset.s);
        li.classList.toggle('is-now', n === s); li.classList.toggle('is-done', n < s);
        if (n === s) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      if (s === 3) $$('[data-for]', form).forEach(function (f) { f.hidden = f.dataset.for.split(' ').indexOf(type()) < 0; });
      if (s === 4) fillList($('#ck-confirm'), values());
      back.hidden = s === 1;
      next.firstChild.textContent = s === LAST ? '見本を表示する' : '次へ';
      summary();
      if (focus) $('legend', steps[s - 1]).focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 送信しない
      if (!validate(step)) return;
      if (step < LAST) { show(step + 1, true); return; }
      // 見本の表示：入力内容は表示するだけで、見本の数値には使わない
      var echo = $('#rs-echo');
      fillList($('#rs-echo-list'), values());
      echo.hidden = false;
      if (bar) bar.classList.add('is-result');
      echo.setAttribute('tabindex', '-1'); echo.scrollIntoView(); echo.focus({ preventScroll: true });
    });
    back.addEventListener('click', function () { if (step > 1) show(step - 1, true); });

    // 入力中のエラー解除・坪数の換算表示（面積の換算のみ。価格の計算ではありません）
    $$('input[name="type"]', form).forEach(function (r) { r.addEventListener('change', function () { setErr('type', ''); summary(); }); });
    ['pref', 'city', 'senyu', 'tochi', 'tatemono', 'chiku'].forEach(function (n) {
      var input = el(n);
      var h = function () { if (fld(n).classList.contains('is-error') && !rules[n](input.value)) setErr(n, ''); };
      input.addEventListener('input', h); input.addEventListener('change', h);
      var out = $('#t-' + n);
      if (out) input.addEventListener('input', function () {
        var v = toHalf(input.value);
        out.textContent = /^\d+(\.\d+)?$/.test(v) && Number(v) > 0 ? '約 ' + (Math.round(Number(v) * 0.3025 * 10) / 10) + ' 坪' : '';
      });
    });

    var unk = $('#ck-chiku-unknown');
    unk.addEventListener('change', function () { el('chiku').disabled = unk.checked; if (unk.checked) { el('chiku').value = ''; setErr('chiku', ''); } });
    // FVの種別ボタン：種別を選んだ状態で、所在地の入力（ステップ2）から始める
    $$('#hero-start button[data-type]').forEach(function (b) {
      b.addEventListener('click', function () {
        $('input[name="type"][value="' + b.dataset.type + '"]', form).checked = true;
        setErr('type', ''); show(2, false); goCheck(); $('legend', steps[1]).focus({ preventScroll: true });
      });
    });
    function goCheck() { var c = $('#check'); c.scrollIntoView(); }
    $('#rs-edit').addEventListener('click', function () { show(LAST, false); goCheck(); $('legend', steps[LAST - 1]).focus({ preventScroll: true }); });
    $('#rs-reset').addEventListener('click', function () {
      form.reset(); el('chiku').disabled = false; if (bar) bar.classList.remove('is-result');
      ['pref', 'city', 'senyu', 'tochi', 'tatemono', 'chiku'].forEach(function (n) { setErr(n, ''); });
      setErr('type', ''); $$('output', form).forEach(function (o) { o.textContent = ''; });
      $('#rs-echo').hidden = true;  $('#rs-echo-list').textContent = '';
      show(1, false); goCheck(); $('legend', steps[0]).focus({ preventScroll: true });
    });
    show(1, false);
  }

  /* ---------- 相談フォーム（デモ：送信しない） ---------- */
  var sf = $('#soudan-form');
  if (sf) {
    var done = $('#soudan-done');
    var sr = {
      name: function (v) { return v.trim() ? '' : 'お名前を入力してください。'; },
      contact: function (v) {
        v = v.trim();
        if (!v) return '電話番号かメールアドレスを入力してください。';
        var d = v.replace(/[\s\-‐ー－()（）]/g, '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
        if (/^0\d{9,10}$/.test(d) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return '';
        return '電話番号（市外局番から）か、メールアドレスの形式をご確認ください。';
      }
    };
    var sErr = function (n, m) {
      var f = $('[data-f="' + n + '"]', sf); f.classList.toggle('is-error', !!m); $('.err', f).textContent = m || '';
      if (m) sf.elements[n].setAttribute('aria-invalid', 'true'); else sf.elements[n].removeAttribute('aria-invalid');
    };
    ['name', 'contact'].forEach(function (n) {
      sf.elements[n].addEventListener('input', function () { if (!sr[n](sf.elements[n].value)) sErr(n, ''); });
    });
    sf.addEventListener('submit', function (e) {
      e.preventDefault(); // 送信しない
      var bad = [];
      ['name', 'contact'].forEach(function (n) { var m = sr[n](sf.elements[n].value); sErr(n, m); if (m) bad.push(n); });
      if (bad.length) { sf.elements[bad[0]].focus(); return; }
      sf.hidden = true; done.hidden = false; done.focus();
    });
    $('#soudan-back').addEventListener('click', function () { done.hidden = true; sf.hidden = false; sf.elements.name.focus(); });
  }

  /* ---------- スマホ下部の固定バー ---------- */
  if (bar && 'IntersectionObserver' in window) {
    var seen = new Set();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
      bar.classList.toggle('is-hidden', seen.size > 0);
    }, { threshold: 0.05 });
    [$('.hs-btns'), $('#check'), $('#soudan'), $('.site-footer')].forEach(function (x) { if (x) io.observe(x); });
  }
})();
