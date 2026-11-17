/*
 * 外觀小工具（只管畫面，不碰資料）
 *
 * 1. 圖示：畫面上的 🏠 🧳 📍 ⏳ 🔁 🗑 👟 ✈ ⚠ 換成同一套細線條圖示（線條粗細一致）
 *    文字和資料本身不變，只是顯示時換成 SVG；確認視窗、提示訊息這類純文字的地方照舊。
 * 2. 數字平滑滾動：剩餘公斤數改變時，從舊數字滾到新數字（約 0.2 秒）
 * 3. 打勾的小動畫：剛打勾的那一格輕輕跳一下
 * iPad 開啟「減少動態效果」時，2、3 都不做。
 */
(function () {
  'use strict';

  // ---------- 1. 細線條圖示 ----------
  var P = {
    '🏠': '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5.5h4V20"/>',
    '🧳': '<rect x="4.5" y="7" width="15" height="13" rx="1"/><path d="M9 7V4.5h6V7"/><path d="M9 11v5"/><path d="M15 11v5"/>',
    '📍': '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.2"/>',
    '⏳': '<path d="M7 3.5h10"/><path d="M7 20.5h10"/><path d="M8 3.5c0 4.5 8 4.5 8 8.5s-8 4-8 8.5"/><path d="M16 3.5c0 4.5-8 4.5-8 8.5s8 4 8 8.5"/>',
    '🔁': '<path d="M4.5 9.5h13l-3-3"/><path d="M19.5 14.5h-13l3 3"/>',
    '🗑': '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4h5v2.5"/><path d="M6.5 6.5l1 13.5h9l1-13.5"/><path d="M10.5 10.5v6"/><path d="M13.5 10.5v6"/>',
    '👟': '<path d="M3.5 16.5V10l4 1.5 3-3.5 3.5 4.5c2.5.8 6.5 1.5 6.5 4v0H3.5z"/><path d="M3.5 19.5h17"/>',
    '✈': '<path d="M10.5 13.5 4 11l1.2-1.6 7 .9 4.3-4.6c.8-.8 2-1 2.6-.4.6.6.4 1.8-.4 2.6l-4.6 4.3.9 7L13.4 20l-2.5-6.5"/>',
    '⚠': '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5"/><path d="M12 17.2v.3"/>'
  };
  var RE = /(🏠|🧳|📍|⏳|🔁|🗑|👟|✈|⚠)️?/;
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, SELECT: 1, TITLE: 1, INPUT: 1 };
  function svg(ch) {
    return '<svg class="ico-i" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[ch] + '</svg>';
  }
  function swapText(node) {
    var text = node.nodeValue;
    if (!RE.test(text)) return;
    var parent = node.parentNode;
    if (!parent || SKIP[parent.nodeName] || (parent.closest && parent.closest('svg'))) return;
    var frag = document.createDocumentFragment();
    var parts = text.split(/(🏠|🧳|📍|⏳|🔁|🗑|👟|✈|⚠)️?/);
    parts.forEach(function (s, i) {
      if (!s) return;
      if (i % 2) {
        var span = document.createElement('span');
        span.className = 'ico-wrap';
        span.innerHTML = svg(s);
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(s));
      }
    });
    parent.replaceChild(frag, node);
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { swapText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var list = [], n;
    while ((n = walker.nextNode())) if (RE.test(n.nodeValue)) list.push(n);
    list.forEach(swapText);
  }
  var queued = [];
  var pending = false;
  function flush() {
    pending = false;
    var q = queued; queued = [];
    q.forEach(scan);
  }
  var obs = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.type === 'characterData') queued.push(m.target);
      else m.addedNodes.forEach(function (x) { queued.push(x); });
    });
    if (!pending) { pending = true; (window.queueMicrotask || setTimeout)(flush); }
  });
  function start() {
    scan(document.body);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  // ---------- 2. 數字平滑滾動 ----------
  function calm() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  var last = {};
  // el 的文字是一個數字（例如 24.4）；key 用來記住上一次顯示的數字
  function roll(el, key) {
    if (!el) return;
    var text = el.textContent.trim();
    var to = parseFloat(text);
    if (!isFinite(to)) { delete last[key]; return; }
    var from = last[key];
    last[key] = to;
    if (from == null || from === to || calm()) return;
    var dec = (text.split('.')[1] || '').length;
    var t0 = null, dur = 220;
    function frame(ts) {
      if (t0 == null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? (from + (to - from) * e).toFixed(dec) : text;
      if (k < 1) requestAnimationFrame(frame);
    }
    el.textContent = from.toFixed(dec);
    requestAnimationFrame(frame);
  }
  function rollAll(root) {
    (root || document).querySelectorAll('[data-roll]').forEach(function (el) { roll(el, el.getAttribute('data-roll')); });
  }

  // ---------- 3. 打勾的小動畫 ----------
  function pop(el) {
    if (!el || calm()) return;
    el.classList.remove('just-checked');
    void el.offsetWidth;
    el.classList.add('just-checked');
    setTimeout(function () { el.classList.remove('just-checked'); }, 400);
  }

  window.UI = { roll: roll, rollAll: rollAll, pop: pop, icon: svg };
})();
