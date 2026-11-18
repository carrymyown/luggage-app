/*
 * 語言切換（繁體中文／English）
 *
 * - 介面文字的翻譯在 lang.js（中文是原文，English 是對照和句型）。
 * - 英文模式：畫面上出現的文字（包括之後才畫出來的、提示訊息、確認視窗）都換成英文；
 *   切回中文就還原成原本的中文，不用重新整理。
 * - 使用者自己輸入的內容不在翻譯檔裡，照原樣顯示；範例資料的英文名稱只在範例模式套用。
 * - 語言記在這台裝置（cmo-lang）；登入時也存到雲端（state.prefs.lang），換裝置也一樣。
 *   第一次打開：裝置是中文就用繁體中文，其他語言用英文。
 * - 「CARRY MY OWN」文字 logo 兩種語言都一樣。
 */
(function () {
  'use strict';

  var KEY = 'cmo-lang';
  var EN = (window.LANG && window.LANG.en) || { text: {}, rules: [] };
  var SAMPLE = {};   // 範例資料的英文名稱（sample-data.js 註冊）
  var CJK = /[㐀-鿿]/;

  function detect() {
    try { var v = localStorage.getItem(KEY); if (v === 'en' || v === 'zh') return v; } catch (e) { /* 私密瀏覽 */ }
    var nl = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return /^zh/i.test(nl) ? 'zh' : 'en';
  }
  var lang = detect();

  function sampleOn() { return !!(window.App && window.App.sampleMode && window.App.sampleMode()); }

  // ---------- 翻譯一段文字 ----------
  var SEP = /(\s*[・、，；→～〜]\s*|\s+[–—]\s+|：\s*|「|」)/;
  var SEP_EN = { '・': ' · ', '、': ', ', '，': ', ', '；': '; ', '→': ' → ', '～': ' – ', '〜': ' – ', '–': ' – ', '—': ' — ', '：': ': ', '「': ' “', '」': '” ' };
  var depth = 0;
  function core(s) {
    if (!s || !CJK.test(s)) return s;
    if (Object.prototype.hasOwnProperty.call(EN.text, s)) return EN.text[s];
    if (sampleOn() && Object.prototype.hasOwnProperty.call(SAMPLE, s)) return SAMPLE[s];
    if (depth > 6) return null;
    depth++;
    try {
      for (var i = 0; i < EN.rules.length; i++) {
        var r = EN.rules[i];
        if (!r[1]) continue;
        var m = s.match(r[0]);
        if (m) { var out = r[1](m, part); if (out != null) return out; }
      }
      // 好幾行：一行一行翻
      if (s.indexOf('\n') >= 0) return s.split('\n').map(function (x) { return text(x); }).join('\n');
      // 括號：（…）
      var b = s.match(/^(.*?)（(.+)）$/);
      if (b) { var a1 = b[1] ? part(b[1]) : '', a2 = part(b[2]); if (a1 !== b[1] || a2 !== b[2]) return (a1 ? a1 + ' ' : '') + '(' + a2 + ')'; }
      // 用「・」「，」「：」等分開的：每一段各自翻（名稱照原樣）
      var ps = s.split(SEP);
      if (ps.length > 1) {
        var changed = false;
        var outp = ps.map(function (p, k) {
          if (k % 2) { var c = p.trim(); changed = changed || !!SEP_EN[c]; return SEP_EN[c] != null ? SEP_EN[c] : p; }
          var t = p.trim() ? part(p) : p;
          if (t !== p) changed = true;
          return t;
        });
        if (changed) return outp.join('').replace(/^\s+|\s+$/g, '');
      }
      // 前面是 emoji 或符號
      var e = s.match(/^([^㐀-鿿A-Za-z0-9「]+)(.+)$/);
      if (e) { var t2 = part(e[2]); if (t2 !== e[2]) return e[1] + t2; }
      return null;
    } finally { depth--; }
  }
  // 一小段：翻不到就照原樣（例如使用者自己取的名字）
  function part(x) {
    var m = String(x).match(/^(\s*)([\s\S]*?)(\s*)$/);
    var r = core(m[2]);
    return r == null ? x : m[1] + r + m[3];
  }
  function text(s) {
    if (lang !== 'en' || s == null) return s;
    s = String(s);
    if (!CJK.test(s)) return s;
    return part(s);
  }

  // ---------- 畫面上的文字 ----------
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var orig = new WeakMap(), shown = new WeakMap();   // 文字節點 → 原本的中文／翻好的英文
  function skipNode(el) { return !el || SKIP[el.nodeName] || (el.closest && el.closest('[data-i18n-skip]')); }
  function doText(n) {
    var p = n.parentNode;
    if (!p || skipNode(p)) return;
    var cur = n.nodeValue;
    if (shown.get(n) === cur) return;   // 自己翻好的
    if (!CJK.test(cur)) { orig.delete(n); shown.delete(n); return; }
    orig.set(n, cur);
    // 選單選項沒有寫 value 時，存檔讀的是選項文字：先把中文原文記成 value，資料才不會變成英文
    if (p.nodeName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', cur.trim());
    var t = text(cur);
    if (t !== cur) { shown.set(n, t); n.nodeValue = t; } else shown.delete(n);
  }
  function doAttrs(el) {
    if (skipNode(el)) return;
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var v = el.getAttribute(a), k = 'data-i18n-' + a;
      if (el.getAttribute(k + '-en') === v) return;
      if (!CJK.test(v)) return;
      var t = text(v);
      if (t === v) return;
      el.setAttribute(k, v); el.setAttribute(k + '-en', t); el.setAttribute(a, t);
    });
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || skipNode(root)) return;
    doAttrs(root);
    root.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(doAttrs);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(doText);
  }
  // 切回中文：把翻過的還原
  function restore(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (x) { if (orig.has(x) && shown.get(x) === x.nodeValue) x.nodeValue = orig.get(x); shown.delete(x); });
    ATTRS.forEach(function (a) {
      root.querySelectorAll('[data-i18n-' + a + ']').forEach(function (el) {
        if (el.getAttribute(a) === el.getAttribute('data-i18n-' + a + '-en')) el.setAttribute(a, el.getAttribute('data-i18n-' + a));
        el.removeAttribute('data-i18n-' + a); el.removeAttribute('data-i18n-' + a + '-en');
      });
    });
  }

  var obs = new MutationObserver(function (muts) {
    if (lang !== 'en') return;
    muts.forEach(function (m) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttrs(m.target);
      else m.addedNodes.forEach(walk);
    });
  });
  function start() {
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    applyLang();
  }

  // 確認視窗、提示框也翻
  var oc = window.confirm.bind(window), oa = window.alert.bind(window), op = window.prompt.bind(window);
  window.confirm = function (m) { return oc(text(m)); };
  window.alert = function (m) { return oa(text(m)); };
  window.prompt = function (m, d) { return op(text(m), d); };

  function applyLang() {
    var html = document.documentElement;
    html.lang = lang === 'en' ? 'en' : 'zh-Hant';
    html.classList.toggle('lang-en', lang === 'en');
    if (lang === 'en') walk(document.body); else restore(document.body);
    document.querySelectorAll('[data-lang-pick]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lang-pick') === lang); b.setAttribute('aria-pressed', b.getAttribute('data-lang-pick') === lang); });
  }

  // 切換語言：立刻生效（opts.quiet：雲端資料帶回來的，不再存回雲端）
  function set(l, opts) {
    l = l === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(KEY, l); } catch (e) { /* 不影響 */ }
    var App = window.App;
    if (!(opts && opts.quiet) && App && App.signedIn && App.signedIn() && !App.sampleMode()) {
      var s = App.state();
      if (!s.prefs || typeof s.prefs !== 'object') s.prefs = {};
      if (s.prefs.lang !== l) { s.prefs.lang = l; App.save(); }
    }
    if (l === lang) { applyLang(); return; }
    lang = l;
    applyLang();
    // 動態畫出來的內容重新畫一次（日期、數字句型等）
    if (App && App.rerender) App.rerender();
  }

  // 範例資料的英文名稱：{ 中文: English }
  function addSample(map) { Object.keys(map || {}).forEach(function (k) { if (map[k]) SAMPLE[k] = map[k]; }); }

  // 帳號選單：語言 / Language
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-lang-pick]');
    if (b) set(b.getAttribute('data-lang-pick'));
  });

  window.I18N = { t: text, set: set, lang: function () { return lang; }, addSample: addSample, apply: applyLang };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
