/* R-B（確認用プレビュー）。依存なし。JSがなくても内容はすべて読める。 */
(function(){
  'use strict';
  var d=document, root=d.documentElement;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ヘッダーの影 */
  var hd=d.getElementById('hd');
  function onScroll(){hd.classList.toggle('is-up',window.scrollY>8)}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  /* SPメニュー */
  var btn=d.getElementById('menuBtn'), menu=d.getElementById('menu');
  function setMenu(open){
    btn.setAttribute('aria-expanded',open?'true':'false');
    if(open){menu.style.setProperty('--menu-top',Math.round(hd.getBoundingClientRect().bottom)+'px')}
    menu.hidden=!open;
    root.style.overflow=open?'hidden':'';
    btn.querySelector('.menu-lb').textContent=open?'閉じる':'メニュー';
  }
  btn.addEventListener('click',function(){setMenu(menu.hidden)});
  menu.addEventListener('click',function(e){if(e.target.closest('a'))setMenu(false)});
  d.addEventListener('keydown',function(e){if(e.key==='Escape'&&!menu.hidden){setMenu(false);btn.focus()}});
  window.matchMedia('(min-width:768px)').addEventListener('change',function(e){if(e.matches&&!menu.hidden)setMenu(false)});

  /* 手法タブ（矢印キー対応） */
  var tabs=[].slice.call(d.querySelectorAll('[role=tab]'));
  function selectTab(t,focus){
    tabs.forEach(function(x){
      var on=x===t;x.setAttribute('aria-selected',on);x.tabIndex=on?0:-1;
      d.getElementById(x.getAttribute('aria-controls')).hidden=!on;
    });
    if(focus)t.focus();
  }
  tabs.forEach(function(t,i){
    t.addEventListener('click',function(){selectTab(t)});
    t.addEventListener('keydown',function(e){
      var n=null;
      if(e.key==='ArrowRight')n=tabs[(i+1)%tabs.length];
      else if(e.key==='ArrowLeft')n=tabs[(i+tabs.length-1)%tabs.length];
      else if(e.key==='Home')n=tabs[0];else if(e.key==='End')n=tabs[tabs.length-1];
      if(n){e.preventDefault();selectTab(n,true)}
    });
  });

  /* スクロール表示（一度だけ。動きを減らす設定では何もしない） */
  var targets=[].slice.call(d.querySelectorAll('.sec-h,.idx li,.sheet,.methods,.quote,.steps li,.rep-grid>*,.ledger-wrap,.cols li,.ct-box,.co'));
  if(!reduce&&'IntersectionObserver' in window){
    targets.forEach(function(el){el.classList.add('rv')});
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.08});
    targets.forEach(function(el){io.observe(el)});
  }

  /* ヒーローの図：つなぎの線を一度だけ描く */
  var fig=d.getElementById('flow-fig');
  if(fig){
    if(reduce||!('IntersectionObserver' in window)){fig.classList.add('go','done')}
    else{
      var fo=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){setTimeout(function(){fig.classList.add('go')},250);setTimeout(function(){fig.classList.add('done')},3000);fo.disconnect()}})},{threshold:.25});
      fo.observe(fig);
    }
  }

  /* 固定の連絡バー（SP）: ヒーローの窓口が見えている間は隠す */
  var desk=d.getElementById('desk');
  if(desk&&'IntersectionObserver' in window){
    new IntersectionObserver(function(es){es.forEach(function(en){root.classList.toggle('fixon',!en.isIntersecting&&en.boundingClientRect.top<0)})},{threshold:0}).observe(desk);
  }else{root.classList.add('fixon')}
})();
