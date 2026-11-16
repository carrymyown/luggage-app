/*
 * 第一次使用設定、試用範例、使用提示、帳號選單裡的「我的家」
 *
 * - 第一次使用：帳號裡沒有任何資料、也還沒看過時（state.onboarded 不是 true），顯示三步歡迎畫面
 * - 範例資料：每一筆都標 sample: true（id 以 sample- 開頭），「清除範例」只刪這些，使用者自己的東西不受影響；
 *   範例新增的家記在 state.sampleHomes，清除時沒有被自己的東西用到才刪
 * - 使用提示：每個主要頁面第一次進入時顯示一句話，按「知道了」就不再出現（記在這台裝置）
 */
(function () {
  'use strict';

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;
  function st() { return App.state(); }

  // ---------- 第一次使用設定 ----------
  var step = 1, shownThisVisit = false;
  var BAG_PRESETS = [['checked', '托運大箱', 4.2], ['carry', '登機箱', 2.6], ['personal', '後背包', 0.8], ['pouch', '隨身小包', 0.3]];
  var pickedBags = {};

  function needsOnboarding() { return !st().onboarded && App.isEmptyState(); }

  function openOnboard() {
    shownThisVisit = true;
    step = 1; pickedBags = {};
    $('#ob-home').value = '';
    renderOnboard();
    $('#onboard-sheet').hidden = false;
  }

  function renderOnboard() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ob-step]'), function (el) {
      el.hidden = +el.getAttribute('data-ob-step') !== step;
    });
    $('#ob-dots').innerHTML = [1, 2, 3].map(function (i) { return '<i class="' + (i === step ? 'on' : '') + '"></i>'; }).join('');
    $('#ob-homes').innerHTML = App.homes().map(function (h) {
      return '<span class="chip on">' + esc(h) + '</span>';
    }).join('');
    $('#ob-bags').innerHTML = BAG_PRESETS.map(function (b, i) {
      return '<button type="button" class="chip' + (pickedBags[i] ? ' on' : '') + '" data-ob-bag="' + i + '">' + (pickedBags[i] ? '✓ ' : '') + b[1] + '</button>';
    }).join('');
    $('#ob-next').hidden = step === 3;
    $('#ob-skip').textContent = step === 3 ? '關閉' : '跳過';
  }

  function finishOnboard() {
    st().onboarded = true;
    App.save();
    $('#onboard-sheet').hidden = true;
    App.refreshView();
  }

  // 第 2 步選的行李：變成自己的行李箱（放在第一個家）
  function saveBags() {
    var home = App.homes()[0] || '';
    Object.keys(pickedBags).forEach(function (i) {
      if (!pickedBags[i]) return;
      var p = BAG_PRESETS[i];
      if (st().bags.some(function (b) { return !b.auto && b.name === p[1]; })) return;
      st().bags.push(App.normalizeBag({ id: App.uid(), name: p[1], kind: p[0], tare: p[2], home: home }));
    });
    pickedBags = {};
  }

  function goStep(n) {
    if (step === 2) saveBags();
    step = n;
    App.save();
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
    if (t.id === 'ob-next') {
      if (step === 1 && $('#ob-home').value.trim()) { App.addHome($('#ob-home').value.trim().slice(0, 20)); $('#ob-home').value = ''; }
      goStep(step + 1);
      return;
    }
    if (t.id === 'ob-skip') { if (step < 3) goStep(step + 1); else finishOnboard(); return; }
    if (t.id === 'ob-start') { finishOnboard(); return; }
    if (t.id === 'ob-sample') { addSample(); finishOnboard(); App.toast('已放入範例資料，看完可以按最上方的「清除範例」'); location.hash = '#home'; }
  });

  // ---------- 範例資料 ----------
  function addDays(n) {
    var d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var PART = { '上衣': 'top', '下身': 'bottom', '洋裝／連身': 'full', '外套': 'outer', '鞋子': 'shoes', '帽子': 'hat', '配件': 'accessory' };

  function addSample() {
    var s = st(), today = App.todayStr();
    // 兩個家：台北、曼谷（已經有的就不重複加）
    if (!Array.isArray(s.sampleHomes)) s.sampleHomes = [];
    ['台北', '曼谷'].forEach(function (h) {
      if (App.homes().indexOf(h) < 0) { s.homes.push(h); if (s.sampleHomes.indexOf(h) < 0) s.sampleHomes.push(h); }
    });

    // 衣櫃 10 件
    [['白T', '上衣', 'T 恤', '白', '台北', 0.2, ['夏', '春']], ['藍色襯衫', '上衣', '襯衫', '藍', '曼谷', 0.25, ['夏']],
     ['灰毛衣', '上衣', '毛衣', '灰', '台北', 0.45, ['冬']], ['牛仔褲', '下身', '牛仔褲', '藍', '台北', 0.6, []],
     ['米色短褲', '下身', '短褲', '米', '曼谷', 0.3, ['夏']], ['黑色洋裝', '洋裝／連身', '', '黑', '曼谷', 0.35, ['夏']],
     ['海軍藍外套', '外套', '外套', '海軍藍', '台北', 0.7, ['春', '秋']], ['白球鞋', '鞋子', '', '白', '台北', 0.7, []],
     ['漁夫帽', '帽子', '漁夫帽', '米', '曼谷', 0.1, ['夏']], ['太陽眼鏡', '配件', '太陽眼鏡', '黑', '台北', 0.05, []]
    ].forEach(function (c, i) {
      var tags = window.Clothing.empty();
      tags.group = c[1]; tags.type = c[2]; tags.home = c[4]; tags.colors = [c[3]]; tags.seasons = c[6]; tags.part = PART[c[1]] || '';
      s.memory.push(App.normalizeEntry({
        id: 'sample-c' + (i + 1), sample: true, name: c[0], weight: c[5], unit: '個', category: '必備品', uses: 1, estimated: true,
        clothing: tags, location: { state: 'home', home: c[4], since: today }, moves: [{ home: c[4], date: today }]
      }));
    });

    // 抽屜 10 樣（有數量）
    [['護照', '必備品', 0.04, '台北', null, '本'], ['充電線', '電線電器', 0.05, '台北', null, '條'], ['行動電源', '電線電器', 0.2, '台北', null, '個'],
     ['面膜', '保養品', 0.03, '台北', 10, '片'], ['維他命', '保健品', 0.15, '台北', 2, '瓶'], ['泡麵', '食品', 0.1, '曼谷', 5, '包'],
     ['防曬乳', '保養品', 0.1, '曼谷', 1, '條'], ['牙刷組', '必備品', 0.05, '曼谷', 2, '組'], ['雨傘', '必備品', 0.3, '曼谷', 1, '把'],
     ['鳳梨酥禮盒', '禮物', 0.5, '台北', 2, '盒']
    ].forEach(function (d, i) {
      s.memory.push(App.normalizeEntry({
        id: 'sample-d' + (i + 1), sample: true, name: d[0], weight: d[2], unit: d[5], category: d[1], uses: 1, estimated: true, drawer: true,
        home: d[3], count: d[4], countUnit: d[5], stock: d[4] == null ? 'have' : '',
        location: { state: 'home', home: d[3], since: today }, moves: [{ home: d[3], date: today }]
      }));
    });

    // 兩個行李箱＋一個隨身小包
    [['sample-b1', '範例托運大箱', 'checked', 4.2, '28 吋', '五五開', '硬箱'], ['sample-b2', '範例登機箱', 'carry', 2.6, '20 吋', '五五開', '硬箱'],
     ['sample-b3', '範例隨身小包', 'pouch', 0.3, '', '', '布箱']].forEach(function (b) {
      s.bags.push(App.normalizeBag({ id: b[0], sample: true, name: b[1], kind: b[2], tare: b[3], size: b[4], style: b[5], material: b[6], home: '台北' }));
    });

    // 多城市旅程：台北 → 曼谷（入境停留、行李領出）→ 清邁（入境停留）→ 香港（不入境轉機、行李直掛）→ 台北
    var trip = App.normalizeTrip({
      id: 'sample-trip', sample: true, name: '範例：台北・曼谷・清邁', origin: '台北', endHome: '台北', pouchMode: 'personal',
      seasons: ['夏'], activities: ['登山健行'],
      legs: [
        { id: 'sample-l1', from: '台北', to: '曼谷', date: addDays(10), depTime: '08:30', arrTime: '11:20', flightNo: 'BR211', airline: '長榮航空',
          allowance: { checked: 23, carry: 7, personal: 7, pouch: '' }, connection: { baggage: 'recheck', mode: 'enter', stayDays: 4, note: '在曼谷住朋友家' } },
        { id: 'sample-l2', from: '曼谷', to: '清邁', date: addDays(14), depTime: '10:00', arrTime: '11:15', flightNo: 'TG102', airline: '泰國航空',
          allowance: { checked: 20, carry: 7, personal: 5, pouch: '' }, connection: { baggage: 'recheck', mode: 'enter', stayDays: 4, note: '清邁健行' } },
        { id: 'sample-l3', from: '清邁', to: '香港', date: addDays(18), depTime: '12:30', arrTime: '16:40', flightNo: 'CX750', airline: '國泰航空',
          allowance: { checked: 30, carry: 7, personal: 7, pouch: '' }, connection: { baggage: 'through', mode: 'transit', stayDays: '', note: '' } },
        { id: 'sample-l4', from: '香港', to: '台北', date: addDays(18), depTime: '18:40', arrTime: '20:25', flightNo: 'CX564', airline: '國泰航空',
          allowance: { checked: 30, carry: 7, personal: 7, pouch: '' }, connection: {} }
      ]
    });
    s.trips.push(trip);

    // 打包清單：選好行李箱，幾樣先打勾放進行李
    if (window.Packing) {
      window.Packing.prepareTrip(trip, { pouch: 'sample-b3', carry: 'sample-b2', checked: 'sample-b1', personal: 'off' },
        ['護照', '白T', '牛仔褲', '充電線', '白球鞋']);
    }

    // 一筆購物（放在托運箱）、一份要送朋友的禮物（在行李裡）
    s.shopping.purchases.push({ id: 'sample-p1', sample: true, tripId: trip.id, name: '泰國香米', weight: 1, qty: 1, price: '฿120', category: '食品',
      city: '清邁', bagId: 'sample-b1', homeDest: '台北', placedHome: '', planId: null, date: today, createdAt: Date.now(), updatedAt: Date.now() });
    s.items.push({ id: 'sample-ip1', sample: true, name: '泰國香米', weight: 1, qty: 1, unit: '個', category: '食品', bagId: 'sample-b1', purchaseId: 'sample-p1' });
    s.gifts.push({ id: 'sample-g1', sample: true, tripId: trip.id, name: '芒果乾', weight: 0.25, qty: 2, to: 'Amy', city: '曼谷', status: 'packed',
      source: 'home', drawerId: null, bagId: 'sample-b1', home: '', givenDate: '', createdAt: Date.now(), updatedAt: Date.now() });
    s.items.push({ id: 'sample-ig1', sample: true, name: '芒果乾', weight: 0.25, qty: 2, unit: '份', category: '禮物', bagId: 'sample-b1', giftId: 'sample-g1' });
    App.save();
  }

  function isSample(x) { return !!(x && (x.sample || String(x.id || '').indexOf('sample-') === 0)); }

  function hasSample() {
    var s = st();
    return s.trips.some(isSample) || s.memory.some(isSample) || s.bags.some(isSample) ||
      (s.gifts || []).some(isSample) || ((s.shopping || {}).purchases || []).some(isSample);
  }

  // 一鍵清掉所有範例資料；使用者自己新增的東西不動
  function clearSample() {
    var s = st();
    var trips = s.trips.filter(isSample).map(function (t) { return t.id; });
    var mem = s.memory.filter(isSample).map(function (m) { return m.id; });
    var bags = s.bags.filter(isSample).map(function (b) { return b.id; });
    var gifts = (s.gifts || []).filter(isSample).map(function (g) { return g.id; });
    var buys = ((s.shopping || {}).purchases || []).filter(isSample).map(function (p) { return p.id; });
    function inA(a, v) { return v && a.indexOf(v) >= 0; }
    s.items = s.items.filter(function (it) {
      return !(isSample(it) || inA(mem, it.catalogId) || inA(bags, it.bagId) || inA(gifts, it.giftId) || inA(buys, it.purchaseId));
    });
    s.trips = s.trips.filter(function (t) { return !inA(trips, t.id); });
    s.packLists = (s.packLists || []).filter(function (l) { return !inA(trips, l.id); });
    s.memory = s.memory.filter(function (m) { return !inA(mem, m.id); });
    s.bags = s.bags.filter(function (b) { return !inA(bags, b.id); });
    s.gifts = (s.gifts || []).filter(function (g) { return !inA(gifts, g.id); });
    s.shopping.purchases = s.shopping.purchases.filter(function (p) { return !inA(buys, p.id); });
    s.shopping.plans = (s.shopping.plans || []).filter(function (p) { return !inA(trips, p.tripId); });
    trips.forEach(function (id) { if (s.shopping.ratio) delete s.shopping.ratio[id]; });
    // 自己的打包清單如果選了範例行李箱，改回「尚未選擇」
    (s.packLists || []).forEach(function (l) {
      Object.keys(l.zones || {}).forEach(function (z) { if (inA(bags, l.zones[z].bagId)) l.zones[z].bagId = App.autoBag(z).id; });
    });
    // 範例加的家：沒有被自己的東西用到才拿掉
    (s.sampleHomes || []).forEach(function (h) { if (!App.homeUsage(h)) s.homes = s.homes.filter(function (x) { return x !== h; }); });
    s.sampleHomes = [];
    App.save();
  }

  $('#sample-clear').addEventListener('click', function () {
    if (!confirm('要清除所有範例資料嗎？你自己新增的東西不會被刪掉。')) return;
    clearSample();
    App.toast('範例已清除，可以開始使用了');
    location.hash = '#home';
    App.refreshView();
    renderBar();
  });

  function renderBar() { $('#sample-bar').hidden = !hasSample(); }

  // ---------- 使用提示 ----------
  var TIPS = {
    home: '這裡看這趟旅程還能放幾公斤',
    trips: '先新增一趟旅程，填好航班的行李額度',
    pack: '打勾就代表已經放進行李，上面的公斤數會自動扣掉',
    closet: '衣櫃放穿戴的東西，抽屜放其他用品',
    plus: '從這裡新增衣服、物品、購物和禮物'
  };
  var TIP_VIEW = { home: 'home', trips: 'trips', pack: 'pack', closet: 'closet', drawer: 'closet', bags: 'closet' };
  var TIP_KEY = 'luggage-tips-seen';
  function seen() { try { return JSON.parse(localStorage.getItem(TIP_KEY)) || {}; } catch (e) { return {}; } }
  function markSeen(k) { var o = seen(); o[k] = true; try { localStorage.setItem(TIP_KEY, JSON.stringify(o)); } catch (e) { /* 不影響 */ } }

  function tipHTML(k) {
    return '<div class="use-tip" data-tip="' + k + '"><span>' + TIPS[k] + '</span><button type="button" class="link small" data-tip-ok="' + k + '">知道了</button></div>';
  }
  function showTip(view) {
    document.querySelectorAll('.view .use-tip').forEach(function (el) { el.remove(); });
    var k = TIP_VIEW[view];
    if (!k || seen()[k] || !$('#onboard-sheet').hidden) return;
    var sec = $('#view-' + view);
    if (!sec) return;
    var anchor = view === 'home' ? sec.querySelector('.masthead') : null;
    var div = document.createElement('div');
    div.innerHTML = tipHTML(k);
    if (anchor) anchor.after(div.firstChild); else sec.insertBefore(div.firstChild, sec.firstChild);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tip-ok]');
    if (!b) return;
    markSeen(b.getAttribute('data-tip-ok'));
    var t = b.closest('.use-tip'); if (t) t.remove();
  });
  // 中間的＋：打開選單時顯示
  $('#plus-btn').addEventListener('click', function () {
    var panel = $('#plus-sheet .plus-panel');
    var old = panel.querySelector('.use-tip'); if (old) old.remove();
    if (seen().plus) return;
    var div = document.createElement('div');
    div.innerHTML = tipHTML('plus');
    panel.insertBefore(div.firstChild, panel.firstChild);
  });
  $('#tips-reset').addEventListener('click', function () {
    try { localStorage.removeItem(TIP_KEY); } catch (e) { /* 不影響 */ }
    $('#account-sheet').hidden = true;
    App.toast('使用提示會再顯示一次');
    showTip(currentView());
  });
  function currentView() { return (location.hash.replace(/^#/, '').split('/')[0]) || 'home'; }

  // ---------- 帳號選單：我的家（新增、改名、刪除） ----------
  function renderHomes() {
    var homes = App.homes();
    $('#account-home-list').innerHTML = homes.length ? homes.map(function (h) {
      return '<div class="ah-row"><span class="ah-name">' + esc(h) + '</span>' +
        '<button type="button" class="link small" data-home-rename="' + esc(h) + '">改名</button>' +
        '<button type="button" class="link small ah-del" data-home-del="' + esc(h) + '">刪除</button></div>';
    }).join('') : '<p class="muted small">還沒有家。</p>';
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
        if (v == null) return;
        var msg = App.renameHome(from, v);
        if (msg) App.toast(msg); else App.toast('已改名');
        renderHomes();
      });
      return;
    }
    if (d) {
      var name = d.getAttribute('data-home-del');
      if (!confirm('要刪除「' + name + '」這個家嗎？')) return;
      var m = App.removeHome(name);
      App.toast(m || '已刪除');
      renderHomes();
    }
  });

  // ---------- 每次換頁 ----------
  function afterRoute(view) {
    renderBar();
    if (!shownThisVisit && needsOnboarding()) { openOnboard(); return; }
    showTip(view);
  }

  window.Onboard = { afterRoute: afterRoute, addSample: addSample, clearSample: clearSample, hasSample: hasSample, open: openOnboard };
})();
