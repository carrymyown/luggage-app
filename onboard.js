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

  // 這台裝置沒有資料（新裝置、登出後）：顯示歡迎畫面
  // 已登入、資料還在從雲端載回來時先不要顯示
  function needsOnboarding() {
    return !App.sampleMode() && !st().onboarded && App.isEmptyState() && !(window.Cloud && window.Cloud.waitingForData());
  }

  function openOnboard(at) {
    shownThisVisit = true;
    step = at || 0; pickedBags = {};
    $('#ob-home').value = ''; $('#ob-home-city').value = '';
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
    $('#ob-homes').innerHTML = App.homes().map(function (h) { return '<span class="chip on">' + esc(homeLabel(h)) + '</span>'; }).join('');
    $('#ob-bags').innerHTML = BAG_PRESETS.map(function (b, i) {
      return '<button type="button" class="chip' + (pickedBags[i] ? ' on' : '') + '" data-ob-bag="' + i + '">' + (pickedBags[i] ? '✓ ' : '') + b[1] + '</button>';
    }).join('');
    $('#ob-nav').hidden = step === 0;
    $('#ob-next').textContent = step === 3 ? '完成' : '下一步';
  }

  function num(v) { var n = parseFloat(v); return isFinite(n) && n >= 0 ? n : ''; }

  // 常搭的航空公司和行李額度（設定畫面和範例資料都用這裡）：新增旅程時第一段會自動帶入
  function setDefaults(airline, checked, carry, personal) {
    var d = { airline: String(airline || '').trim().slice(0, 30), allowance: { checked: num(checked), carry: num(carry), personal: num(personal) } };
    if (d.airline || d.allowance.checked !== '' || d.allowance.carry !== '' || d.allowance.personal !== '') st().defaults = d;
  }

  // 每一步按「下一步」時存起來；按「跳過」就不存這一步
  function saveStep() {
    if (step === 1 && ($('#ob-home-city').value.trim() || $('#ob-home').value.trim())) {
      if (!addHomeFrom($('#ob-home-city'), $('#ob-home'))) return false;   // 要填所在城市
    }
    if (step === 2) setDefaults($('#ob-airline').value, $('#ob-checked').value, $('#ob-carry').value, $('#ob-personal').value);
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
    return true;
  }

  // 新增一個家：所在城市一定要填；家的名字可以自由取，沒填就用城市名稱（設定畫面和帳號選單都用這裡）
  function addHomeFrom(cityEl, nameEl) {
    var city = cityEl.value.trim().slice(0, 30);
    var name = nameEl.value.trim().slice(0, 20) || city.slice(0, 20);
    if (!city) { App.toast('請填這個家的所在城市'); cityEl.focus(); return null; }
    if (App.homes().indexOf(name) >= 0) { App.toast('已經有「' + name + '」這個家了'); return null; }
    App.addHome(name, city);
    cityEl.value = ''; nameEl.value = '';
    return name;
  }
  // 家的顯示：名字和城市一樣就只顯示一次，例如「我的公寓・東京」「台北」
  function homeLabel(h) {
    var c = App.homeCity(h);
    return c && c !== h ? h + '・' + c : h;
  }

  function finishOnboard() {
    st().onboarded = true;
    App.save();
    $('#onboard-sheet').hidden = true;
    App.toast('設定好了，先新增一趟旅程吧');
    App.refreshView();
  }

  function next(skip) {
    if (!skip && saveStep() === false) return;
    if (step >= 3) { finishOnboard(); return; }
    step++;
    renderOnboard();
  }

  $('#ob-home-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!addHomeFrom($('#ob-home-city'), $('#ob-home'))) return;
    renderOnboard();
    $('#ob-home-city').focus();
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
    if (s.dayPlans) trips.forEach(function (id) { delete s.dayPlans[id]; });
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
  // 範例提示條：沒有登入 →「登入開始使用」；已登入、正在看範例 →「清除範例，開始使用」
  function renderBar() {
    var on = App.sampleMode(), inAcc = App.signedIn();
    $('#sample-bar').hidden = !on;
    $('#sample-login').hidden = !on || inAcc;
    $('#sample-clear').hidden = !on || !inAcc;
  }
  $('#sample-login').addEventListener('click', function () {
    var b = $('#account-btn');
    if (b) b.click(); else $('#account-sheet').hidden = false;
    setTimeout(function () { var em = $('#cl-email'); if (em) em.focus(); }, 300);
  });
  $('#sample-clear').addEventListener('click', function () {
    if (!confirm('要清除範例資料，開始使用嗎？')) return;
    App.exitSample();
  });
  $('#sample-again').addEventListener('click', function () {
    if (App.sampleMode()) {
      // 已經是範例：提示從第 1 個重新開始
      $('#account-sheet').hidden = true;
      resetCoach();
      if (location.hash !== '#home') location.hash = '#home'; else showTips('home');
      return;
    }
    if (!confirm('要打開範例資料看看嗎？\n範例只在這台裝置，你自己的資料不會受影響；看完按最上方的「清除範例」就回來。')) return;
    resetCoach();
    App.enterSample();
  });

  // ---------- 範例模式的使用提示：五個重點，一步一步出現在真實畫面上 ----------
  // 黑底白字的提示卡＋被說明的地方外圍一圈虛線框；箭頭依照按鈕在畫面上的實際位置計算（捲動、旋轉都跟著更新）
  // 只在範例模式出現；看到第幾個記在 cmo-coach（帳號選單「再看一次範例」會從第 1 個重新開始）
  var COACH = [
    { page: 'home', target: '#view-home .trip-card .tc-value', away: '.tabbar a[href="#home"]',
      title: '這趟還能放多少', body: '打包、購物、禮物都會自動算進來，快超重會變色提醒。' },
    { page: 'closet', target: '.home-switch', away: '.tabbar a[href="#closet"]',
      title: '每個家有什麼', body: '衣服放衣櫃、其他東西放抽屜；家裡已經有的，出門就不用再帶。' },
    { page: '', target: '#plus-btn',
      title: '隨時新增', body: '新增衣服、抽屜物品、記一筆購物或禮物，都從這裡開始。' },
    { page: 'pack', target: '#pack-tabs', away: '.tabbar a[href="#pack"]',
      title: '先列清單，再打勾', body: '打勾就是放進行李，每個行李箱還能放多少會即時更新。' },
    { page: 'trips', target: '#view-trips .trip-card .trip-route, #view-trips .trip-card, #view-trips .page-head', away: '.tabbar a[href="#trips"]',
      title: '每一段航班的額度', body: '填好航班和行李額度，到了有家的城市會提醒你整理行李。點每天旁邊的小方格，看當天穿搭。' }
  ];
  var PAGE_OF = { home: 'home', closet: 'closet', drawer: 'closet', bags: 'closet', pack: 'pack', trips: 'trips' };
  var COACH_KEY = 'cmo-coach';
  function coachState() { try { return JSON.parse(localStorage.getItem(COACH_KEY)) || { step: 0, done: false }; } catch (e) { return { step: 0, done: false }; } }
  function saveCoach(o) { try { localStorage.setItem(COACH_KEY, JSON.stringify(o)); } catch (e) { /* 不影響 */ } }
  function resetCoach() { saveCoach({ step: 0, done: false }); }
  try { localStorage.removeItem('cmo-tips-seen'); } catch (e) { /* 舊的小提示不用了 */ }

  var card = null, ring = null, curView = 'home', curStep = -1, loop = null, scrolledFor = -1;
  function coachEls() {
    if (card) return;
    ring = document.createElement('div'); ring.className = 'coach-ring'; ring.hidden = true;
    card = document.createElement('div'); card.className = 'coach-card'; card.hidden = true;
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite');
    document.body.appendChild(ring); document.body.appendChild(card);
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-coach]');
      if (!b) return;
      var act = b.getAttribute('data-coach'), st0 = coachState();
      if (act === 'next') { st0.step = Math.min(COACH.length - 1, curStep + 1); saveCoach(st0); render(); return; }
      st0.done = true; saveCoach(st0); hideCoach();   // 知道了／開始使用：關掉所有提示
    });
  }
  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !el.closest('[hidden]');
  }
  function targetOf(i) {
    var c = COACH[i];
    var onPage = !c.page || PAGE_OF[curView] === c.page;
    if (onPage) {
      // 依序找：寫在前面的優先（例如行程先找旅程卡片，沒有才用頁面標題）
      var sels = c.target.split(',');
      for (var j = 0; j < sels.length; j++) {
        var list = document.querySelectorAll(sels[j]);
        for (var k = 0; k < list.length; k++) if (visible(list[k])) return list[k];
      }
    }
    var away = c.away && document.querySelector(c.away);
    return visible(away) ? away : null;
  }
  // 不出現：正式使用（非範例）、已經按過知道了、第一次使用設定或介紹畫面開著
  function blocked() {
    return !App.sampleMode() || coachState().done || !$('#onboard-sheet').hidden || (window.Intro && window.Intro.isOpen());
  }
  // 暫時藏起來：有視窗開著時（關掉後自動回來）
  function paused() { return !!document.querySelector('.sheet:not([hidden])'); }
  function hideCoach() {
    if (card) { card.hidden = true; ring.hidden = true; }
    if (loop) { cancelAnimationFrame(loop); loop = null; }
    curStep = -1;
  }
  function render() {
    coachEls();
    var st0 = coachState();
    curStep = st0.step;
    var last = curStep === COACH.length - 1, c = COACH[curStep];
    card.innerHTML = '<div class="coach-num">' + (curStep + 1) + ' / ' + COACH.length + '</div>' +
      '<div class="coach-title">' + c.title + '</div><p class="coach-body">' + c.body + '</p>' +
      '<div class="coach-btns">' + (last ? '' : '<button type="button" class="coach-btn" data-coach="next">下一個</button>') +
      '<button type="button" class="coach-btn' + (last ? ' primary' : '') + '" data-coach="done">' + (last ? '開始使用' : '知道了') + '</button></div>' +
      '<i class="coach-arrow"></i>';
    scrolledFor = -1;
    if (!loop) tick();
  }
  // 每一格畫面都重新量位置：捲動、旋轉、畫面變動都跟著更新
  function tick() {
    loop = requestAnimationFrame(tick);
    if (curStep < 0) return;
    if (blocked()) { hideCoach(); return; }
    if (paused()) { card.hidden = true; ring.hidden = true; return; }
    var el = targetOf(curStep);
    if (!el) { card.hidden = true; ring.hidden = true; return; }
    if (scrolledFor !== curStep) {
      scrolledFor = curStep;
      var r0 = el.getBoundingClientRect();
      if (r0.top < 70 || r0.bottom > innerHeight - 80) el.scrollIntoView({ block: 'center' });
    }
    place(el);
  }
  function place(el) {
    var r = el.getBoundingClientRect(), pad = 6, gap = 14, vw = document.documentElement.clientWidth, vh = innerHeight;
    ring.hidden = false;
    ring.style.left = (r.left - pad) + 'px'; ring.style.top = (r.top - pad) + 'px';
    ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px';
    card.hidden = false;
    var w = card.offsetWidth, h = card.offsetHeight;
    // 放在按鈕下方；下方放不下就放上方（卡片不會蓋住被說明的地方）
    var bar = document.querySelector('.tabbar'), barTop = bar ? bar.getBoundingClientRect().top : vh;
    var fitBelow = r.bottom + pad + gap + h <= barTop - 8, fitAbove = r.top - pad - gap - h >= 8;
    var below = fitBelow || !fitAbove;
    var top = below ? r.bottom + pad + gap : r.top - pad - gap - h;
    if (!fitBelow && !fitAbove) top = Math.min(top, barTop - h - 8);   // 上下都放不下：停在導覽列上方，不跑出畫面
    var cx = r.left + r.width / 2;
    var left = Math.max(12, Math.min(vw - w - 12, cx - w / 2));
    card.style.left = Math.round(left) + 'px'; card.style.top = Math.round(Math.max(8, top)) + 'px';
    card.classList.toggle('below', below);
    var arrow = card.querySelector('.coach-arrow');
    arrow.style.left = Math.round(Math.max(16, Math.min(w - 16, cx - left))) + 'px';
  }
  function showTips(view) {
    curView = view;
    if (blocked()) { hideCoach(); return; }
    // 切到某一頁：直接跳到那一頁的提示
    var st0 = coachState();
    var idx = COACH.findIndex(function (c) { return c.page && c.page === PAGE_OF[view]; });
    if (idx >= 0 && idx !== st0.step && view !== 'home') { st0.step = idx; saveCoach(st0); }
    render();
  }

  // ---------- 帳號選單：我的家（新增、改名、刪除） ----------
  function renderHomes() {
    var homes = App.homes();
    $('#account-home-list').innerHTML = homes.length ? homes.map(function (h) {
      return '<div class="ah-row"><span class="ah-name">' + esc(h) + '<span class="muted small ah-city">📍 ' + esc(App.homeCity(h)) + '</span></span>' +
        '<button type="button" class="link small" data-home-rename="' + esc(h) + '">改名</button>' +
        '<button type="button" class="link small" data-home-city="' + esc(h) + '">城市</button>' +
        '<button type="button" class="link small ah-del" data-home-del="' + esc(h) + '">刪除</button></div>';
    }).join('') : '<p class="muted small">還沒有家。</p>';
    $('#sample-again').textContent = '再看一次範例';   // 範例模式中按：提示從第 1 個重新開始
  }
  $('#account-btn').addEventListener('click', renderHomes);
  $('#account-home-add').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = addHomeFrom($('#account-home-city'), $('#account-home-name'));
    if (!v) return;
    renderHomes();
    App.toast('已新增家：' + v);
  });
  $('#account-home-list').addEventListener('click', function (e) {
    var r = e.target.closest('[data-home-rename]'), d = e.target.closest('[data-home-del]'), c = e.target.closest('[data-home-city]');
    if (c) {
      var hn = c.getAttribute('data-home-city');
      window.Clothing.askText('「' + hn + '」在哪個城市？（用來判斷抵達哪個家）', App.homeCity(hn)).then(function (v) {
        if (v == null || !String(v).trim()) return;
        var msg = App.setHomeCity(hn, v);
        App.toast(msg || '所在城市：' + String(v).trim());
        renderHomes();
      });
      return;
    }
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
        // 範例內容更新過（例如新增每日穿搭）：這台裝置上的舊範例換成新的（只動範例，不碰自己的資料）
        if (st().sampleBuilt !== window.SampleData.VERSION) {
          try { localStorage.removeItem('cmo-sample-state'); location.reload(); return; } catch (e) { /* 不影響，繼續用舊範例 */ }
        }
      } else {
        stripOldSample();
        var after = false;
        try { after = localStorage.getItem('cmo-after-sample') === '1'; localStorage.removeItem('cmo-after-sample'); } catch (e) { /* 不影響 */ }
        // 清除範例後：帳號裡還沒有資料 → 直接進入第一次使用設定
        if (after && needsOnboarding()) { openOnboard(1); renderBar(); return; }
      }
    }
    renderBar();
    // 登入後雲端的資料回來了（帳號早就設定過），就不用再顯示第一次使用設定
    if (!App.sampleMode() && st().onboarded && !$('#onboard-sheet').hidden) $('#onboard-sheet').hidden = true;
    // 已登入、雲端也沒有資料（新帳號第一次登入）→ 第一次使用設定（沒登入時一律顯示範例，不會走到這裡）
    if (!shownThisVisit && needsOnboarding()) { openOnboard(1); return; }
    showTips(view);
  }

  window.Onboard = { afterRoute: afterRoute, open: openOnboard, setDefaults: setDefaults, resetCoach: resetCoach, showTips: function () { showTips(curView); } };
})();
