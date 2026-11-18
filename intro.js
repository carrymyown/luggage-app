/*
 * 歡迎頁：四張意象畫面介紹 Carry My Own
 *
 * - 第一次打開 app、還沒登入時自動出現（看過一次記在 cmo-intro-seen，之後不再自動出現；登出也不會清掉）
 * - 帳號選單「再看一次介紹」可以再打開（範例模式也一樣用這四個畫面）
 * - 左右滑動；右上角「略過」直接到最後一頁；最後一頁：開始使用（登入→第一次使用設定）／先看範例
 * - 插畫用 SVG 自己畫：線條 1.5px（不隨縮放改變）、圓端點和轉角，只用黑白和淺灰 #F4F4F4
 */
(function () {
  'use strict';

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var SEEN_KEY = 'cmo-intro-seen';

  // ---------- 插畫（viewBox 320×240；線條一律 1.5px、不隨縮放改變） ----------
  var S = ' fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
  var T = ' font-family="Archivo, \'Noto Sans TC\', sans-serif" fill="#111"';
  function svg(inner, label) {
    return '<svg viewBox="0 0 320 240" role="img" aria-label="' + label + '" preserveAspectRatio="xMidYMid meet">' + inner + '</svg>';
  }
  var ART = [
    // 01 不超重：闔上的直立行李箱，三條紋路、兩個輪子、提把、小吊牌，下方地平線
    svg(
      '<path' + S + ' d="M146 62V46h28v16"/>' +
      '<rect' + S + ' x="118" y="62" width="84" height="120" rx="6"/>' +
      '<path' + S + ' d="M140 76v92M160 76v92M180 76v92"/>' +
      '<circle' + S + ' cx="132" cy="189" r="6"/><circle' + S + ' cx="188" cy="189" r="6"/>' +
      '<path' + S + ' d="M174 50c10 2 22 10 30 22"/>' +
      '<path' + S + ' d="M200 70l16-6 10 26-16 6z"/><circle' + S + ' cx="207" cy="74" r="2"/>' +
      '<path' + S + ' d="M40 196h240"/>',
      '闔上的直立行李箱'),
    // 02 不重複帶：台北、東京兩間房子，裡面都有同樣的牙刷和乳液
    svg(
      '<path' + S + ' d="M160 22v168"/>' +
      '<text' + T + ' x="80" y="36" text-anchor="middle" font-size="11" font-weight="400" letter-spacing="2.5">TAIPEI</text>' +
      '<text' + T + ' x="240" y="36" text-anchor="middle" font-size="11" font-weight="400" letter-spacing="2.5">TOKYO</text>' +
      [80, 240].map(function (cx) {
        return '<path' + S + ' d="M' + (cx - 46) + ' 98L' + cx + ' 58l46 40"/>' +
          '<path' + S + ' d="M' + (cx - 38) + ' 92v86h76V92"/>' +
          // 牙刷
          '<path' + S + ' d="M' + (cx - 18) + ' 166V128"/><rect' + S + ' x="' + (cx - 22) + '" y="116" width="8" height="12" rx="2"/>' +
          '<path' + S + ' d="M' + (cx - 21) + ' 120h6M' + (cx - 21) + ' 124h6"/>' +
          // 乳液
          '<rect' + S + ' x="' + (cx + 4) + '" y="134" width="20" height="32" rx="3"/>' +
          '<path' + S + ' d="M' + (cx + 10) + ' 134v-6h8v6M' + (cx + 14) + ' 128v-6h6"/>' +
          '<path' + S + ' d="M' + (cx - 30) + ' 166h60"/>';
      }).join('') +
      '<text' + T + ' x="160" y="214" text-anchor="middle" font-size="10" font-weight="500" letter-spacing="3">AT HOME</text>',
      '台北和東京的家，各有一支牙刷和一瓶乳液'),
    // 03 少帶衣服、多搭配：上衣、長褲、鞋子三格 → 六套穿搭
    svg(
      '<rect x="38" y="14" width="68" height="92" fill="#F4F4F4"/><rect x="126" y="14" width="68" height="92" fill="#F4F4F4"/><rect x="214" y="14" width="68" height="92" fill="#F4F4F4"/>' +
      // 上衣
      '<path' + S + ' d="M60 38l-10 8 6 9 6-4v32h20V51l6 4 6-9-10-8h-8c0 4-3 6-6 6s-6-2-6-6z"/>' +
      // 長褲
      '<path' + S + ' d="M148 34h24l4 54h-10l-6-38-6 38h-10z"/><path' + S + ' d="M148 42h24"/>' +
      // 鞋子
      '<path' + S + ' d="M228 74V58h12l4 8c8 2 18 4 24 8v6h-40z"/><path' + S + ' d="M228 80h40"/>' +
      '<text' + T + ' x="160" y="136" text-anchor="middle" font-size="12" font-weight="500" letter-spacing="2.5">3 PIECES → 6 LOOKS</text>' +
      [0, 1, 2, 3, 4, 5].map(function (i) {
        var x = 64 + i * 34;
        return '<rect x="' + x + '" y="156" width="24" height="24"' + (i % 2 ? S : ' fill="#111" stroke="#111" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"') + '/>';
      }).join(''),
      '上衣、長褲、鞋子三件，搭出六套'),
    // 04 輕裝優雅：登機證
    svg(
      '<rect x="26" y="28" width="268" height="176" fill="none" stroke="#111" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<text' + T + ' x="42" y="54" font-size="10" font-weight="500" letter-spacing="3">BOARDING</text>' +
      '<text' + T + ' x="278" y="54" text-anchor="end" font-size="10" font-weight="500" letter-spacing="2">CARRY-ON ONLY</text>' +
      '<text' + T + ' x="160" y="116" text-anchor="middle" font-size="38" font-weight="500" letter-spacing="1">TPE → NRT</text>' +
      '<path' + S + ' stroke-dasharray="4 5" d="M26 140h268"/>' +
      '<path' + S + ' d="M115 152v40M205 152v40"/>' +
      [['BAGS', '1', 70], ['WEIGHT', '6.8 KG', 160], ['STATUS', 'READY', 250]].map(function (c) {
        return '<text' + T + ' x="' + c[2] + '" y="166" text-anchor="middle" font-size="8.5" font-weight="400" letter-spacing="2" fill-opacity=".65">' + c[0] + '</text>' +
          '<text' + T + ' x="' + c[2] + '" y="186" text-anchor="middle" font-size="14" font-weight="500" letter-spacing="1">' + c[1] + '</text>';
      }).join(''),
      '只帶登機行李的登機證，台北到成田')
  ];

  var SLIDES = [
    { info: ['TOTAL', '22.4 / 23 KG'], title: 'CARRY ONLY<br>WHAT MATTERS', zh: '只帶真正需要的，不再超重。' },
    { info: ['IN YOUR BAG', '0 DUPLICATES'], title: 'NOTHING<br>TWICE', zh: '每個家都有的，就不用再帶。' },
    { info: ['WARDROBE', '3 → 6'], title: 'LESS PIECES,<br>MORE LOOKS', zh: '少幾件衣服，多幾套穿搭。' },
    { info: ['CARRY-ON', '6.8 KG'], title: 'TRAVEL LIGHT,<br>ARRIVE ELEGANT', zh: '輕裝出發，優雅抵達。' }
  ];

  var track = $('#intro-track');
  track.innerHTML = SLIDES.map(function (s, i) {
    return '<section class="intro-slide" aria-label="' + (i + 1) + ' / 4">' +
      '<div class="intro-art intro-anim">' + ART[i] + '</div>' +
      '<div class="intro-info intro-anim"><span>' + s.info[0] + '</span><b>' + s.info[1] + '</b></div>' +
      '<div class="intro-text intro-anim"><h2>' + s.title + '</h2><p>' + s.zh + '</p></div>' +
      '</section>';
  }).join('');
  $('#intro-progress').innerHTML = SLIDES.map(function () { return '<i></i>'; }).join('');

  // ---------- 換頁 ----------
  var cur = -1;
  function calm() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function setPage(i) {
    if (i === cur) return;
    cur = i;
    $('#intro-num').textContent = '0' + (i + 1);
    [].forEach.call(document.querySelectorAll('#intro-progress i'), function (el, k) { el.classList.toggle('on', k === i); });
    $('#intro-progress').hidden = i === SLIDES.length - 1;
    $('#intro-actions').hidden = i !== SLIDES.length - 1;
    $('#intro-skip').style.visibility = i === SLIDES.length - 1 ? 'hidden' : '';
    // 插畫和標題輕輕淡入、往上幾個像素（減少動態效果時不做）
    var slides = track.children;
    [].forEach.call(slides, function (s) { s.classList.remove('enter'); });
    if (!calm() && slides[i]) { void slides[i].offsetWidth; slides[i].classList.add('enter'); }
  }
  var raf = null;
  track.addEventListener('scroll', function () {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      setPage(Math.max(0, Math.min(SLIDES.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth)))));
    });
  });
  function goTo(i) {
    track.scrollTo({ left: i * track.clientWidth, behavior: calm() ? 'auto' : 'smooth' });
    setPage(i);
  }

  // ---------- 打開、關閉 ----------
  function open() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 不影響 */ }
    document.querySelectorAll('.sheet:not([hidden])').forEach(function (s) { if (s.id !== 'onboard-sheet') s.hidden = true; });
    document.querySelectorAll('.tip-bubble').forEach(function (b) { b.remove(); });   // 範例的提示泡泡等介紹關掉再出現
    $('#intro').hidden = false;
    document.body.classList.add('intro-open');
    cur = -1;
    track.scrollLeft = 0;
    setPage(0);
  }
  function close() {
    $('#intro').hidden = true;
    document.body.classList.remove('intro-open');
    App.refreshView();   // 範例的使用提示等介紹關掉後才出現
  }
  function isOpen() { return !$('#intro').hidden; }

  $('#intro-skip').addEventListener('click', function () { goTo(SLIDES.length - 1); });
  // 開始使用：還沒登入 → 打開登入（新帳號登入後會進入第一次使用設定）
  $('#intro-start').addEventListener('click', function () {
    close();
    if (!App.signedIn()) {
      var b = $('#account-btn');
      if (b) b.click(); else $('#account-sheet').hidden = false;
      setTimeout(function () { var em = $('#cl-email'); if (em) em.focus(); }, 300);
    }
  });
  // 先看範例：沒登入時畫面本來就是範例；已登入就打開範例模式（你的資料不受影響）
  $('#intro-sample').addEventListener('click', function () {
    close();
    if (!App.sampleMode()) App.enterSample();
  });
  $('#intro-again').addEventListener('click', function () { $('#account-sheet').hidden = true; open(); });
  window.addEventListener('resize', function () { if (isOpen() && cur >= 0) track.scrollLeft = cur * track.clientWidth; });

  // 網址最後加 #intro：不管有沒有登入，直接打開介紹（例如 …/luggage-app/#intro）
  function fromLink() {
    if (location.hash !== '#intro') return false;
    history.replaceState(null, '', location.pathname + location.search + '#home');
    open();
    return true;
  }
  window.addEventListener('hashchange', fromLink);

  // 第一次打開、還沒登入：自動出現
  var seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { seen = true; }
  if (!fromLink() && !seen && !App.signedIn()) open();

  window.Intro = { open: open, close: close, isOpen: isOpen };
})();
