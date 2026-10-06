/* ==========================================================================
   木村不動産鑑定 — 共通スクリプト
   方針：表示に必須の処理は持たせない（JS 無効でも閲覧できる）。
   ここではメニュー開閉などの最小限の補助のみを行う。
   ========================================================================== */
(function () {
  'use strict';

  /* --- SP / タブレットのメニュー開閉 --- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('global-nav');

  if (toggle && nav) {
    var label = toggle.querySelector('.nav-toggle__label');

    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('is-menu-open', open);
      if (label) label.textContent = open ? '閉じる' : 'メニュー';
    };

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // メニュー内のリンクを選んだら閉じる
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    // Esc で閉じてボタンにフォーカスを戻す
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    // PC 幅に戻ったら状態をリセット
    var mq = window.matchMedia('(min-width: 1200px)');
    var onChange = function () { if (mq.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }

  /* --- フッターの年表示 --- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
