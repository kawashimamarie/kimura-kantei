/* Fable版 A案（確認用デモ）
   このスクリプトは、入力内容をどこにも送信・保存しません。
   Cookie・localStorage・外部通信は使っていません。 */
(function () {
  'use strict';
  var form = document.getElementById('soudan-form');
  var done = document.getElementById('soudan-done');
  var back = document.getElementById('soudan-back');
  if (!form) return;

  function field(name) { return form.querySelector('[data-field="' + name + '"]'); }
  function setErr(name, msg) {
    var f = field(name);
    f.classList.toggle('is-error', !!msg);
    f.querySelector('.err').textContent = msg || '';
    var input = f.querySelector('input:not([type=radio]),textarea');
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }
  function method() { var c = form.querySelector('input[name="method"]:checked'); return c ? c.value : ''; }

  // 連絡方法に応じて、電話番号／メールアドレスの欄を出し分ける
  form.querySelectorAll('input[name="method"]').forEach(function (r) {
    r.addEventListener('change', function () {
      var m = method();
      field('tel').hidden = m !== 'tel';
      field('mail').hidden = m !== 'mail';
      setErr('method', '');
    });
  });

  var rules = {
    name: function (v) { return v.trim() ? '' : 'お名前を入力してください。'; },
    tel: function (v) {
      var d = v.replace(/[\s\-‐ー－()（）]/g, '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
      if (!d) return '電話番号を入力してください。';
      return /^0\d{9,10}$/.test(d) ? '' : '電話番号は、市外局番から数字で入力してください。';
    },
    mail: function (v) {
      if (!v.trim()) return 'メールアドレスを入力してください。';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'メールアドレスの形式をご確認ください。';
    }
  };
  ['name', 'tel', 'mail'].forEach(function (n) {
    var input = form.elements[n];
    input.addEventListener('blur', function () { if (field(n).classList.contains('is-error')) setErr(n, rules[n](input.value)); });
    input.addEventListener('input', function () { if (field(n).classList.contains('is-error') && !rules[n](input.value)) setErr(n, ''); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // 送信しない（デモ）
    var m = method(), errs = [];
    var check = function (n) { var msg = rules[n](form.elements[n].value); setErr(n, msg); if (msg) errs.push(n); };
    check('name');
    if (!m) { setErr('method', 'ご連絡の方法を選んでください。'); errs.push('method'); }
    if (m === 'tel') check('tel');
    if (m === 'mail') check('mail');
    if (errs.length) {
      var first = field(errs[0]).querySelector('input,textarea');
      if (first) first.focus();
      return;
    }
    form.hidden = true; done.hidden = false;
    // 固定ヘッダーに隠れない位置（CSS の scroll-margin-top）へ動かしてから、見出しの枠に移る
    done.focus({ preventScroll: true });
    done.scrollIntoView({ block: 'start' });
  });
  back.addEventListener('click', function () { done.hidden = true; form.hidden = false; form.elements.name.focus(); });

  // スマホ下部の固定バー：FVの予約ボタンが見えている間と、相談セクションでは隠す
  var bar = document.getElementById('sp-bar');
  if (bar && 'IntersectionObserver' in window) {
    var seen = new Set();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
      bar.classList.toggle('is-hidden', seen.size > 0);
    }, { threshold: 0.05 });
    [document.querySelector('.hero-actions'), document.getElementById('soudan'), document.querySelector('.site-footer')].forEach(function (el) { if (el) io.observe(el); });
  }
})();
