/*
 * 第一次使用設定、試用範例、範例模式的提示泡泡、帳號選單裡的「我的家」
 *
 * - 第一次使用：自己的資料是空的、也還沒設定過（state.onboarded 不是 true）時，顯示歡迎畫面：
 *   「先看範例」或「直接開始設定」（家 → 常搭的航空公司和行李額度 → 常用的行李箱，每步都能跳過）
 * - 範例模式：範例資料放在這台裝置另一個地方（見 app.js 的 enterSample／exitSample），
 *   不同步到雲端，也不讀寫使用者自己的資料；「清除範例，開始使用」＝刪掉範例、回到自己的資料
 * - 提示泡泡：只在範例模式出現，首頁、打包、我的家、中間的＋各一次，點一下就消失
 */
(function () {
  'use strict';

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;
  function st() { return App.state(); }

  // ---------- 歡迎畫面與第一次使用設定 ----------
  var step = 0, shownThisVisit = false;
  var BAG_PRESETS = [['checked', '28 吋托運箱', 4.5, '28 吋'], ['carry', '20 吋登機箱', 2.6, '20 吋'], ['personal', '後背包', 0.8, ''], ['pouch', '隨身小包', 0.3, '']];
  var pickedBags = {};

  function needsOnboarding() { return !App.sampleMode() && !st().onboarded && App.isEmptyState(); }

  function openOnboard(at) {
    shownThisVisit = true;
    step = at || 0; pickedBags = {};
    $('#ob-home').value = '';
    var d = st().defaults || {}, a = d.allowance || {};
    $('#ob-airline').value = d.airline || '';
    $('#ob-checked').value = a.checked == null ? '' : a.checked;
    $('#ob-carry').value = a.carry == null ? '' : a.carry;
    $('#ob-personal').value = a.personal == null ? '' : a.personal;
    renderOnboard();
    $('#onboard-sheet').hidden = false;
  }

  function renderOnboard() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ob-step]'), function (el) {
      el.hidden = +el.getAttribute('data-ob-step') !== step;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.ob-dots'), function (el) {
      el.innerHTML = [1, 2, 3].map(function (i) { return '<i class="' + (i === step ? 'on' : '') + '"></i>'; }).join('');
    });
    $('#ob-homes').innerHTML = App.homes().map(function (h) { return '<span class="chip on">' + esc(h) + '</span>'; }).join('');
    $('#ob-bags').innerHTML = BAG_PRESETS.map(function (b, i) {
      return '<button type="button" class="chip' + (pickedBags[i] ? ' on' : '') + '" data-ob-bag="' + i + '">' + (pickedBags[i] ? '✓ ' : '') + b[1] + '</button>';
    }).join('');
    $('#ob-nav').hidden = step === 0;
    $('#ob-next').textContent = step === 3 ? '完成' : '下一步';
  }

  function num(v) { var n = parseFloat(v); return isFinite(n) && n >= 0 ? n : ''; }

  // 每一步按「下一步」時存起來；按「跳過」就不存這一步
  function saveStep() {
    if (step === 1 && $('#ob-home').value.trim()) { App.addHome($('#ob-home').value.trim().slice(0, 20)); $('#ob-home').value = ''; }
    if (step === 2) {
      var d = { airline: $('#ob-airline').value.trim().slice(0, 30), allowance: { checked: num($('#ob-checked').value), carry: num($('#ob-carry').value), personal: num($('#ob-personal').value) } };
      if (d.airline || d.allowance.checked !== '' || d.allowance.carry !== '' || d.allowance.personal !== '') st().defaults = d;
    }
    if (step === 3) {
      var home = App.homes()[0] || '';
      Object.keys(pickedBags).forEach(function (i) {
        if (!pickedBags[i]) return;
        var p = BAG_PRESETS[i];
        if (st().bags.some(function (b) { return !b.auto && b.name === p[1]; })) return;
        st().bags.push(App.normalizeBag({ id: App.uid(), name: p[1], kind: p[0], tare: p[2], size: p[3], home: home }));
      });
      pickedBags = {};
    }
    App.save();
  }

  function finishOnboard() {
    st().onboarded = true;
    App.save();
    $('#onboard-sheet').hidden = true;
    App.toast('設定好了，先新增一趟旅程吧');
    App.refreshView();
  }

  function next(skip) {
    if (!skip) saveStep();
    if (step >= 3) { finishOnboard(); return; }
    step++;
    renderOnboard();
  }

  $('#ob-home-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#ob-home').value.trim().slice(0, 20);
    if (!v) return;
    App.addHome(v);
    $('#ob-home').value = '';
    renderOnboard();
    $('#ob-home').focus();
  });
  $('#onboard-sheet').addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-ob-bag]'))) { var i = el.getAttribute('data-ob-bag'); pickedBags[i] = !pickedBags[i]; renderOnboard(); return; }
    if (t.closest('[data-ob-login]')) {
      // 已經有帳號：先登入，資料同步回來後就不會再出現這個畫面
      $('#onboard-sheet').hidden = true;
      $('#account-sheet').hidden = false;
      return;
    }
    if (t.id === 'ob-sample') { App.enterSample(); return; }
    if (t.id === 'ob-setup') { step = 1; renderOnboard(); return; }
    if (t.id === 'ob-next') { next(false); return; }
    if (t.id === 'ob-skip') { next(true); }
  });

  // ---------- 範例資料（全部是編的；只在範例模式裡建立） ----------
  // 範例資料集中在 sample-data.js，用各功能自己的新增函式產生
  function buildSample() { window.SampleData.build(); }

  // 上一版把範例放在自己的資料裡；回到自己的資料時，把那些範例（只有標了範例的）拿掉
  function isSample(x) { return !!(x && (x.sample || String(x.id || '').indexOf('sample-') === 0)); }
  function stripOldSample() {
    var s = st();
    var any = s.trips.some(isSample) || s.memory.some(isSample) || s.bags.some(isSample) || (s.gifts || []).some(isSample) || ((s.shopping || {}).purchases || []).some(isSample);
    if (!any) return;
    var trips = s.trips.filter(isSample).map(function (t) { return t.id; });
    var mem = s.memory.filter(isSample).map(function (m) { return m.id; });
    var bags = s.bags.filter(isSample).map(function (b) { return b.id; });
    var gifts = (s.gifts || []).filter(isSample).map(function (g) { return g.id; });
    var buys = ((s.shopping || {}).purchases || []).filter(isSample).map(function (p) { return p.id; });
    function inA(a, v) { return v && a.indexOf(v) >= 0; }
    s.items = s.items.filter(function (it) { return !(isSample(it) || inA(mem, it.catalogId) || inA(bags, it.bagId) || inA(gifts, it.giftId) || inA(buys, it.purchaseId)); });
    s.trips = s.trips.filter(function (t) { return !inA(trips, t.id); });
    s.packLists = (s.packLists || []).filter(function (l) { return !inA(trips, l.id); });
    s.memory = s.memory.filter(function (m) { return !inA(mem, m.id); });
    s.bags = s.bags.filter(function (b) { return !inA(bags, b.id); });
    s.gifts = (s.gifts || []).filter(function (g) { return !inA(gifts, g.id); });
    s.shopping.purchases = s.shopping.purchases.filter(function (p) { return !inA(buys, p.id); });
    (s.packLists || []).forEach(function (l) {
      Object.keys(l.zones || {}).forEach(function (z) { if (inA(bags, l.zones[z].bagId)) l.zones[z].bagId = App.autoBag(z).id; });
    });
    (s.sampleHomes || []).forEach(function (h) { if (!App.homeUsage(h)) s.homes = s.homes.filter(function (x) { return x !== h; }); });
    delete s.sampleHomes;
    App.save();
  }

  // 範例模式：最上方的提示列
  function renderBar() { $('#sample-bar').hidden = !App.sampleMode(); }
  $('#sample-clear').addEventListener('click', function () {
    if (!confirm('要清除範例資料，開始使用嗎？')) return;
    App.exitSample();
  });
  $('#sample-again').addEventListener('click', function () {
    if (App.sampleMode()) { $('#account-sheet').hidden = true; App.toast('現在就是範例資料'); return; }
    if (!confirm('要打開範例資料看看嗎？\n範例只在這台裝置，你自己的資料不會受影響；看完按最上方的「清除範例」就回來。')) return;
    App.enterSample();
  });

  // ---------- 範例模式的提示泡泡：每個地方一次，點一下就消失 ----------
  var TIPS = {
    home: '這裡看這趟旅程還能放幾公斤，下面是每個行李',
    pack: '打勾就代表已經放進行李，上面的公斤數會自動扣掉',
    closet: '衣櫃放穿戴的東西，抽屜放其他用品，行李箱也在這裡',
    plus: '從這裡新增衣服、物品、購物和禮物'
  };
  var TIP_VIEW = { home: 'home', pack: 'pack', closet: 'closet', drawer: 'closet', bags: 'closet' };
  var TIP_KEY = 'cmo-tips-seen';
  function seen() { try { return JSON.parse(localStorage.getItem(TIP_KEY)) || {}; } catch (e) { return {}; } }
  function markSeen(k) { var o = seen(); o[k] = true; try { localStorage.setItem(TIP_KEY, JSON.stringify(o)); } catch (e) { /* 不影響 */ } }

  function clearBubbles() { document.querySelectorAll('.tip-bubble').forEach(function (el) { el.remove(); }); }
  function bubble(k, cls, parent, before) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tip-bubble ' + cls;
    b.setAttribute('data-tip', k);
    b.textContent = TIPS[k];
    if (before) parent.insertBefore(b, before); else parent.appendChild(b);
  }
  function showTips(view) {
    clearBubbles();
    if (!App.sampleMode() || !$('#onboard-sheet').hidden) return;
    var k = TIP_VIEW[view];
    if (k && !seen()[k]) {
      var sec = $('#view-' + view);
      var anchor = view === 'home' ? sec.querySelector('.trip-cards') : view === 'pack' ? $('#pack-main') : sec.querySelector('.page-head');
      if (anchor) bubble(k, 'tip-page', anchor.parentNode, anchor);
      return;   // 一次只出現一個泡泡
    }
    if (view === 'home' && !seen().plus) bubble('plus', 'tip-plus', document.body);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.tip-bubble');
    if (!b) return;
    markSeen(b.getAttribute('data-tip'));
    b.remove();
    if (b.getAttribute('data-tip') === 'home') showTips('home');   // 首頁看完再提示中間的＋
  });

  // ---------- 帳號選單：我的家（新增、改名、刪除） ----------
  function renderHomes() {
    var homes = App.homes();
    $('#account-home-list').innerHTML = homes.length ? homes.map(function (h) {
      return '<div class="ah-row"><span class="ah-name">' + esc(h) + '</span>' +
        '<button type="button" class="link small" data-home-rename="' + esc(h) + '">改名</button>' +
        '<button type="button" class="link small ah-del" data-home-del="' + esc(h) + '">刪除</button></div>';
    }).join('') : '<p class="muted small">還沒有家。</p>';
    $('#sample-again').textContent = App.sampleMode() ? '現在是範例資料' : '再看一次範例';
  }
  $('#account-btn').addEventListener('click', renderHomes);
  $('#account-home-add').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#account-home-name').value.trim().slice(0, 20);
    if (!v) return;
    if (App.homes().indexOf(v) >= 0) { App.toast('已經有「' + v + '」了'); return; }
    App.addHome(v);
    $('#account-home-name').value = '';
    renderHomes();
    App.toast('已新增家：' + v);
  });
  $('#account-home-list').addEventListener('click', function (e) {
    var r = e.target.closest('[data-home-rename]'), d = e.target.closest('[data-home-del]');
    if (r) {
      var from = r.getAttribute('data-home-rename');
      window.Clothing.askText('「' + from + '」改成', from).then(function (v) {
        if (v == null || !String(v).trim()) return;
        var msg = App.renameHome(from, v);
        App.toast(msg || '已改名');
        renderHomes();
      });
      return;
    }
    if (d) {
      var name = d.getAttribute('data-home-del');
      if (!confirm('要刪除「' + name + '」這個家嗎？')) return;
      App.toast(App.removeHome(name) || '已刪除');
      renderHomes();
    }
  });

  // ---------- 每次換頁 ----------
  var first = true;
  function afterRoute(view) {
    if (first) {
      first = false;
      if (App.sampleMode()) {
        if (!st().sampleBuilt) { buildSample(); App.refreshView(); return; }
      } else {
        stripOldSample();
        var after = false;
        try { after = localStorage.getItem('cmo-after-sample') === '1'; localStorage.removeItem('cmo-after-sample'); } catch (e) { /* 不影響 */ }
        // 清除範例後：還沒設定過的話，直接進入第一次使用設定
        if (after && !st().onboarded && App.isEmptyState()) { openOnboard(1); renderBar(); return; }
      }
    }
    renderBar();
    // 登入後雲端的資料回來了（帳號早就設定過），就不用再顯示第一次使用設定
    if (!App.sampleMode() && st().onboarded && !$('#onboard-sheet').hidden) $('#onboard-sheet').hidden = true;
    if (!shownThisVisit && needsOnboarding()) { openOnboard(0); return; }
    showTips(view);
  }

  window.Onboard = { afterRoute: afterRoute, open: openOnboard };
})();
