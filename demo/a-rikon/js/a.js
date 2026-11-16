/* A案｜離婚時の不動産鑑定LP（打ち合わせ用デモ）
   - 目次（スマホ）の開閉
   - 相談予約フォームの入力チェックと、デモ用の完了表示
   フォームの内容は、送信（fetch・XHR・フォーム送信）も保存（Cookie・localStorage 等）もしない。 */
(function () {
  'use strict';

  /* ---------- 目次（スマホ） ---------- */
  var btn = document.getElementById('menuBtn');
  var menu = document.getElementById('menu');
  function setMenu(open) {
    if (!btn || !menu) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.hidden = !open;
  }
  if (btn && menu) {
    btn.addEventListener('click', function () { setMenu(btn.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { setMenu(false); btn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (btn.getAttribute('aria-expanded') === 'true' && !e.target.closest('.hd')) setMenu(false);
    });
  }

  /* ---------- スマホの固定バー：相談の予約の章が見えている間は隠す ---------- */
  var fix = document.getElementById('fix');
  var contact = document.getElementById('contact');
  if (fix && contact && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      fix.classList.toggle('is-off', entries[0].isIntersecting);
    }, { rootMargin: '0px 0px -80px 0px' }).observe(contact);
  }

  /* ---------- 相談予約フォーム（デモ） ---------- */
  var form = document.getElementById('form');
  var done = document.getElementById('done');
  var summary = document.getElementById('f-err');
  if (!form || !done) return;

  var rows = Array.prototype.slice.call(form.querySelectorAll('[data-via]'));
  function currentVia() {
    var r = form.querySelector('input[name="via"]:checked');
    return r ? r.value : 'tel';
  }
  function syncVia() {
    var via = currentVia();
    rows.forEach(function (row) {
      var on = row.getAttribute('data-via') === via;
      row.hidden = !on;
      if (!on) clearError(row.querySelector('input'));
    });
  }
  Array.prototype.forEach.call(form.querySelectorAll('input[name="via"]'), function (r) { r.addEventListener('change', syncVia); });
  syncVia();

  function errorEl(input) { return document.getElementById(input.id + '-e'); }
  function setError(input, msg) {
    var el = errorEl(input);
    input.setAttribute('aria-invalid', 'true');
    if (el) { el.textContent = msg; el.hidden = false; }
  }
  function clearError(input) {
    if (!input) return;
    var el = errorEl(input);
    input.removeAttribute('aria-invalid');
    if (el) { el.textContent = ''; el.hidden = true; }
  }
  /* 全角の数字・記号を半角にそろえる（電話番号の入力ゆれを吸収する） */
  function toHalf(s) {
    return s.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[ー－―‐]/g, '-');
  }

  function validate() {
    var errors = [];
    var name = form.elements.name;
    var tel = form.elements.tel;
    var mail = form.elements.mail;
    [name, tel, mail].forEach(clearError);

    if (!name.value.trim()) errors.push([name, 'お名前を入力してください。']);

    if (currentVia() === 'tel') {
      var digits = toHalf(tel.value).replace(/[^0-9]/g, '');
      if (!digits) errors.push([tel, '電話番号を入力してください。']);
      else if (digits.length < 10 || digits.length > 11) errors.push([tel, '電話番号は、市外局番から10〜11桁で入力してください。（例：090-1234-5678）']);
    } else {
      var v = mail.value.trim();
      if (!v) errors.push([mail, 'メールアドレスを入力してください。']);
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push([mail, 'メールアドレスの形をご確認ください。（例：name@example.com）']);
    }
    return errors;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // どこにも送信しない
    var errors = validate();
    summary.textContent = '';
    if (errors.length) {
      var b = document.createElement('b');
      b.textContent = '入力内容をご確認ください（' + errors.length + '件）';
      summary.appendChild(b);
      errors.forEach(function (pair) {
        setError(pair[0], pair[1]);
        var a = document.createElement('a');
        a.href = '#' + pair[0].id;
        a.textContent = pair[1];
        var d = document.createElement('div');
        d.appendChild(a);
        summary.appendChild(d);
      });
      summary.hidden = false;
      summary.focus();
      return;
    }
    summary.hidden = true;
    form.reset(); // 入力内容はここで破棄する（保存しない）
    syncVia();
    form.hidden = true;
    done.hidden = false;
    done.focus();
  });

  form.addEventListener('input', function (e) {
    if (e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true') clearError(e.target);
  });

  var back = document.getElementById('done-back');
  if (back) back.addEventListener('click', function () {
    done.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
})();
