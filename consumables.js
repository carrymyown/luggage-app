/*
 * 消耗品用量、補貨提醒、城市「當地好不好買」（目的：減少瓶瓶罐罐的重量）
 *
 * 抽屜物品（每個家各自一筆）可以標成消耗品：m.consumable = true，m.level = full 滿／half 一半／low 快用完／out 沒了（點選，不輸入數字）
 *   適用品類：保養品、保健品、食品、必備品（洗漱用品多半放在必備品）
 * 離開一個家時（整理行李畫面、出發前檢查）：「快速檢查」一頁列出這個家的消耗品，每樣點一下更新用量，可以全部略過。
 * 補貨提醒：某個家的消耗品「快用完」「沒了」，下一趟會抵達那個家的旅程裡提醒（首頁）：
 *   在上一個城市買 → 加進那趟的購物計畫（state.shopping.plans，restock），預估重量算進預留空間，抵達那個家時自動補成「滿」
 *   網路訂到家 → 待辦，抵達前 5 天提醒下單，不算行李重量；打勾表示已訂（抵達時補成「滿」）
 *   不用提醒 → 這趟不再提醒
 *   選擇記在 m.restock = { tripId, mode: buy／online／none, ordered, planId }
 * 城市「當地好不好買」：state.cityAvail = { byCountry: { 國家: easy／hard }, byCity: { 城市: easy／hard } }
 *   在行程裡標記城市時，也記成那個國家的預設；下次經過同一個國家自動帶入，可以修改。
 *   打包：這趟沒有家的城市都「好買」→ 消耗品建議到當地買（清單下方變灰）；有「不好買」的 → 要帶，依沒有家的晚數建議旅行分裝的份量
 */
(function () {
  'use strict';

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;

  var LEVELS = [['full', '滿'], ['half', '一半'], ['low', '快用完'], ['out', '沒了']];
  var CATS = ['保養品', '保健品', '食品', '必備品'];
  var ONLINE_DAYS = 5;   // 網路訂到家：抵達前幾天提醒下單
  // 常見城市 → 國家（沒有網路也能依國家記住）；查不到的用天氣查詢時記下的國家
  var COUNTRY = {
    '台北': '台灣', '臺北': '台灣', '新北': '台灣', '台中': '台灣', '臺中': '台灣', '台南': '台灣', '臺南': '台灣', '高雄': '台灣', '花蓮': '台灣', '桃園': '台灣',
    '東京': '日本', '大阪': '日本', '京都': '日本', '名古屋': '日本', '福岡': '日本', '札幌': '日本', '沖繩': '日本', '那霸': '日本', '成田': '日本', '羽田': '日本', '關西': '日本',
    '首爾': '韓國', '釜山': '韓國', '濟州': '韓國', '仁川': '韓國',
    '曼谷': '泰國', '清邁': '泰國', '普吉': '泰國', '香港': '香港', '澳門': '澳門', '新加坡': '新加坡', '吉隆坡': '馬來西亞', '檳城': '馬來西亞',
    '胡志明': '越南', '河內': '越南', '峴港': '越南', '馬尼拉': '菲律賓', '宿霧': '菲律賓', '峇里': '印尼', '雅加達': '印尼',
    '雪梨': '澳洲', '墨爾本': '澳洲', '布里斯本': '澳洲', '奧克蘭': '紐西蘭', '倫敦': '英國', '巴黎': '法國', '紐約': '美國', '洛杉磯': '美國', '舊金山': '美國'
  };

  function st() { return App.state(); }
  // 洗漱用品（多半放在必備品）：依名稱判斷
  var WASH_KW = ['牙膏', '牙刷', '牙線', '漱口', '洗髮', '潤髮', '護髮', '沐浴', '洗面', '洗臉', '卸妝', '洗手', '刮鬍', '隱形眼鏡', '生理', '衛生棉', '止汗', '體香'];
  function isWash(m) { var n = App.norm(m && m.name || ''); return WASH_KW.some(function (k) { return n.indexOf(App.norm(k)) >= 0; }); }
  // 保養品、保健品、洗漱用品：自動記錄剩多少（自己取消勾選的 m.consumable === false 不算）；其他品類自己勾
  function autoConsum(m) { return m.category === '保養品' || m.category === '保健品' || ((m.category === '必備品' || m.category === '食品') && isWash(m)); }
  function isConsumable(m) { return !!(m && !App.isCloth(m) && (m.consumable === true || (m.consumable !== false && autoConsum(m)))); }
  // 打包時看「當地買／家裡有／旅行分裝」的：保養品和洗漱用品（保健品、藥品照常帶）
  function isToiletry(m) { return isConsumable(m) && m.category !== '保健品' && (m.category === '保養品' || m.category === '必備品' || isWash(m)); }
  function canConsume(m) { return !!(m && !App.isCloth(m) && CATS.indexOf(m.category) >= 0); }
  function levelOf(m) { return LEVELS.some(function (l) { return l[0] === m.level; }) ? m.level : 'full'; }
  function levelName(lv) { return (LEVELS.find(function (l) { return l[0] === lv; }) || LEVELS[0])[1]; }
  function homeOfM(m) { var loc = App.locOf(m); return loc && loc.state === 'home' ? loc.home : (m.home || ''); }

  // ---------- 用量（表單、快速檢查和範例都用這裡） ----------
  function setConsumable(id, on) {
    var m = App.entryById(id); if (!m) return null;
    m.consumable = !!on;
    if (on && !m.level) m.level = 'full';
    m.updatedAt = Date.now();
    return m;
  }
  function setLevel(id, level) {
    var m = App.entryById(id); if (!m) return null;
    if (!LEVELS.some(function (l) { return l[0] === level; })) return m;
    m.consumable = true; m.level = level; m.levelAt = App.todayStr(); m.updatedAt = Date.now();
    if (level === 'full' || level === 'half') delete m.restock;   // 補好了：不再提醒
    return m;
  }
  function consumablesAt(home, onlyWash) {
    return st().memory.filter(function (m) { return (onlyWash ? isToiletry(m) : isConsumable(m)) && homeOfM(m) === home; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hant'); });
  }

  // ---------- 城市「當地好不好買」 ----------
  function availData() {
    var s = st();
    if (!s.cityAvail || typeof s.cityAvail !== 'object') s.cityAvail = {};
    if (!s.cityAvail.byCountry) s.cityAvail.byCountry = {};
    if (!s.cityAvail.byCity) s.cityAvail.byCity = {};
    return s.cityAvail;
  }
  function countryOf(city) {
    city = String(city || '').trim();
    if (!city) return '';
    var k = Object.keys(COUNTRY).find(function (c) { return city.indexOf(c) >= 0; });
    if (k) return COUNTRY[k];
    try { var g = (JSON.parse(localStorage.getItem('cmo-weather')) || {})['geo|' + city]; if (g && g.country) return g.country; } catch (e) { /* 不影響 */ }
    return '';
  }
  // 好買 easy／不好買 hard／沒標記 ''：城市自己的標記優先，沒有就用同一個國家的
  function availOf(city) {
    var a = availData();
    if (a.byCity[city]) return a.byCity[city];
    var c = countryOf(city);
    return (c && a.byCountry[c]) || '';
  }
  function setAvail(city, v) {
    var a = availData(), c = countryOf(city);
    v = v === 'easy' || v === 'hard' ? v : '';
    if (v) a.byCity[city] = v; else delete a.byCity[city];
    if (!a.asked) a.asked = {};
    a.asked[city] = true;   // 問過了（打包頁不再問）
    if (c) { if (v) a.byCountry[c] = v; }   // 也記成這個國家的預設（下次經過同一個國家自動帶入）
    return v;
  }

  // 打包頁：這趟沒有家、還沒標記也還沒問過的城市（第一次出現時問一次，之後記住；行程裡可以改）
  function askCities(t) {
    if (!t) return [];
    var a = availData(), asked = a.asked || {};
    return tripPlan(t).cities.filter(function (c) { return !availOf(c) && !asked[c]; });
  }
  function markAsked(city) { var a = availData(); if (!a.asked) a.asked = {}; a.asked[city] = true; }

  // ---------- 這趟：沒有家的城市和晚數、好不好買 ----------
  function homeFor(city) { return window.Trips ? window.Trips.homeFor(city) : null; }
  function tripPlan(t) {
    var days = window.Outfit ? window.Outfit.tripDays(t) : [];
    var nights = Math.max(0, days.length - 1), awayNights = 0, cities = {};
    days.forEach(function (d, i) {
      if (i >= nights) return;
      if (homeFor(d.city)) return;
      awayNights++;
      cities[d.city] = (cities[d.city] || 0) + 1;
    });
    var list = Object.keys(cities);
    var marks = list.map(availOf);
    var decision = !list.length ? '' : marks.indexOf('hard') >= 0 ? 'hard' : marks.every(function (x) { return x === 'easy'; }) ? 'local' : '';
    return { nights: nights, awayNights: awayNights, cities: list, decision: decision };
  }
  // 旅行分裝的份量：一整罐大約用 30 天，帶沒有家的晚數就好（最少 20 g）
  function travelWeight(m, nights) {
    var full = Number(m.weight) || 0;
    if (!full || !nights) return full;
    return Math.min(full, Math.max(0.02, Math.round(full * nights / 30 * 1000) / 1000));
  }
  // 這趟清單上的消耗品，在目的地的家有沒有（用量不是「沒了」）：回傳那個家的那一筆
  function atDestination(t, m) {
    var origin = homeFor(t.origin), out = null;
    var homes = [];
    t.legs.forEach(function (l) { var h = homeFor(l.to); if (h && h !== origin && homes.indexOf(h) < 0) homes.push(h); });
    homes.some(function (h) {
      return st().memory.some(function (x) {
        if (x === m || App.isCloth(x) || homeOfM(x) !== h) return false;
        if (!same(x.name, m.name)) return false;
        if (isConsumable(x) && levelOf(x) === 'out') return false;
        out = { home: h, m: x }; return true;
      });
    });
    return out;
  }
  function same(a, b) { var x = App.norm(a || ''), y = App.norm(b || ''); return !!x && x === y; }

  // ---------- 補貨提醒 ----------
  function arrivalDate(l) { return window.Trips && window.Trips.arrivalDate ? window.Trips.arrivalDate(l) : l.date; }
  // 這趟會抵達的家：[{ home, leg, prevCity, date }]
  function arrivals(t) {
    var out = [];
    t.legs.forEach(function (l) {
      var h = homeFor(l.to);
      if (!h || out.some(function (x) { return x.home === h; })) return;
      out.push({ home: h, leg: l, prevCity: l.from || t.origin || '', date: arrivalDate(l) || l.date || '' });
    });
    return out;
  }
  function reminders(t) {
    if (!t) return [];
    var out = [];
    arrivals(t).forEach(function (a) {
      consumablesAt(a.home).forEach(function (m) {
        var lv = levelOf(m);
        var r = m.restock && m.restock.tripId === t.id ? m.restock : null;
        if (lv !== 'low' && lv !== 'out' && !(r && r.mode === 'buy' && !r.done)) return;
        if (r && r.mode === 'none') return;
        if (r && r.done) return;
        out.push({ m: m, home: a.home, prevCity: a.prevCity, date: a.date, level: lv, choice: r });
      });
    });
    return out;
  }
  function planOf(m) { var r = m.restock; return r && r.planId ? ((st().shopping || {}).plans || []).find(function (p) { return p.id === r.planId; }) : null; }
  // 選擇怎麼補：buy 在上一個城市買／online 網路訂到家／none 不用提醒／'' 取消選擇
  function chooseRestock(t, id, mode, city) {
    var m = App.entryById(id); if (!m || !t) return null;
    var old = planOf(m);
    if (old) st().shopping.plans = st().shopping.plans.filter(function (p) { return p !== old; });
    if (!mode) { delete m.restock; m.updatedAt = Date.now(); return m; }
    m.restock = { tripId: t.id, mode: mode, ordered: false };
    if (mode === 'buy') {
      var s = st();
      if (!s.shopping.plans) s.shopping.plans = [];
      var p = { id: App.uid(), tripId: t.id, name: m.name, weight: Number(m.weight) || 0, qty: 1, purchaseId: null, createdAt: Date.now(),
        restock: { memId: m.id, home: homeOfM(m), city: city || '' } };
      s.shopping.plans.push(p);
      m.restock.planId = p.id;
    }
    m.updatedAt = Date.now();
    return m;
  }
  function setOrdered(id, on) { var m = App.entryById(id); if (m && m.restock) { m.restock.ordered = !!on; m.updatedAt = Date.now(); } return m; }
  // 預留空間「已用」：這趟補貨要在路上買的預估重量
  function plannedWeight(t) {
    return ((st().shopping || {}).plans || []).reduce(function (s, p) {
      return p.tripId === t.id && p.restock && !p.restock.done && !p.purchaseId ? s + (Number(p.weight) || 0) * (p.qty || 1) : s;
    }, 0);
  }
  // 抵達那個家的那天之後：補成「滿」（在路上買的、網路訂好的）
  function applyArrivals() {
    var s = st(), today = App.todayStr(), changed = false;
    s.memory.forEach(function (m) {
      var r = m.restock;
      if (!r || r.done || (r.mode !== 'buy' && !(r.mode === 'online' && r.ordered))) return;
      var t = s.trips.find(function (x) { return x.id === r.tripId; });
      if (!t) return;
      var a = arrivals(t).find(function (x) { return x.home === homeOfM(m); });
      if (!a || !a.date || a.date > today) return;
      m.level = 'full'; m.levelAt = today; r.done = true; m.updatedAt = Date.now();
      var p = planOf(m); if (p && p.restock) p.restock.done = true;
      changed = true;
    });
    return changed;
  }

  // ---------- 首頁：補貨提醒 ----------
  function md(d) { return d && window.Trips ? window.Trips.fmtDate(d) : ''; }
  function addDays(s, n) { var p = s.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function renderHome() {
    var box = $('#restock-box');
    if (!box) return;
    var t = App.nextTrip ? App.nextTrip() : null;
    var list = reminders(t);
    if (!list.length) { box.hidden = true; box.innerHTML = ''; return; }
    var today = App.todayStr();
    box.hidden = false;
    box.innerHTML = '<div class="rs-head"><span class="eyebrow">RESTOCK</span><span class="sec-title">補貨提醒</span></div>' + list.map(function (r) {
      var m = r.m, c = r.choice, city = App.homeCity ? App.homeCity(r.home) : r.home;
      var head = '<div class="rs-text"><b>' + esc(city) + '的家' + esc(m.name) + (r.level === 'out' ? '沒了' : '快用完了') + '</b>' +
        '<span class="muted small">' + esc(t.name || '') + (r.date ? '・<span>' + esc(md(r.date)) + ' 抵達</span>' : '') + '</span></div>';
      var body;
      if (c && c.mode === 'buy') {
        body = '<p class="rs-done">在' + esc(r.prevCity || '上一個城市') + '買好帶過去・已加進購物清單，重量算進預留空間 <button type="button" class="link small" data-rs="undo" data-rs-id="' + esc(m.id) + '">改選</button></p>';
      } else if (c && c.mode === 'online') {
        var due = r.date ? addDays(r.date, -ONLINE_DAYS) : '';
        var now = due && today >= due;
        body = '<label class="rs-online' + (now && !c.ordered ? ' due' : '') + '"><input type="checkbox" data-rs-ordered="' + esc(m.id) + '"' + (c.ordered ? ' checked' : '') + '> ' +
          (c.ordered ? '已訂' : now ? '記得下單：網購寄到家' : '網購寄到家・' + esc(md(due)) + ' 提醒你下單') + '</label>' +
          ' <button type="button" class="link small" data-rs="undo" data-rs-id="' + esc(m.id) + '">改選</button>';
      } else {
        body = '<div class="rs-btns">' +
          '<button type="button" class="btn ghost small-btn" data-rs="buy" data-rs-id="' + esc(m.id) + '" data-rs-city="' + esc(r.prevCity) + '">在' + esc(r.prevCity || '上一個城市') + '買好帶過去</button>' +
          '<button type="button" class="btn ghost small-btn" data-rs="online" data-rs-id="' + esc(m.id) + '">網購寄到家</button>' +
          '<button type="button" class="link small" data-rs="none" data-rs-id="' + esc(m.id) + '">不用提醒</button></div>';
      }
      return '<div class="rs-row">' + head + body + '</div>';
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-rs]');
    if (!b) return;
    var t = App.nextTrip ? App.nextTrip() : null; if (!t) return;
    var mode = b.getAttribute('data-rs'), id = b.getAttribute('data-rs-id');
    chooseRestock(t, id, mode === 'undo' ? '' : mode, b.getAttribute('data-rs-city'));
    App.save();
    App.toast(mode === 'buy' ? '已加進購物清單' : mode === 'online' ? '抵達前 ' + ONLINE_DAYS + ' 天提醒你下單' : mode === 'none' ? '這趟不再提醒' : '已取消');
    App.refreshView();
  });
  document.addEventListener('change', function (e) {
    var c = e.target.closest && e.target.closest('[data-rs-ordered]');
    if (!c) return;
    setOrdered(c.getAttribute('data-rs-ordered'), c.checked); App.save(); renderHome();
  });

  // ---------- 快速檢查：這個家的消耗品，每樣點一下更新用量（一頁看完，可以全部略過） ----------
  var skipped = {};
  function quickCheck(home, key) {
    var list = consumablesAt(home, true);   // 只列這個家的保養品和洗漱用品
    if (!list.length || skipped[key || home]) return '';
    return '<div class="qc" data-qc="' + esc(key || home) + '">' +
      '<div class="qc-head"><span class="field-title">快速檢查：' + esc(App.homeCity ? App.homeCity(home) : home) + '的家的保養品和洗漱用品</span>' +
      '<button type="button" class="link small" data-qc-skip="' + esc(key || home) + '">全部略過</button></div>' +
      '<p class="muted small qc-hint">離開前點一下更新用量，快用完的會在下次回來前提醒你。</p>' +
      list.map(function (m) {
        var lv = levelOf(m);
        return '<div class="qc-row"><span class="qc-name">' + esc(m.name) + '</span><div class="qc-levels" role="group" aria-label="' + esc(m.name) + '">' +
          LEVELS.map(function (l) { return '<button type="button" class="qc-lv' + (l[0] === lv ? ' on' : '') + '" data-qc-lv="' + l[0] + '" data-qc-id="' + esc(m.id) + '">' + l[1] + '</button>'; }).join('') +
          '</div></div>';
      }).join('') + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-qc-lv], [data-qc-skip]');
    if (!b) return;
    e.stopPropagation();
    if (b.hasAttribute('data-qc-skip')) { skipped[b.getAttribute('data-qc-skip')] = true; var box = b.closest('.qc'); if (box) box.remove(); return; }
    setLevel(b.getAttribute('data-qc-id'), b.getAttribute('data-qc-lv'));
    App.save();
    b.parentNode.querySelectorAll('.qc-lv').forEach(function (x) { x.classList.toggle('on', x === b); });
  }, true);

  window.Consumables = {
    LEVELS: LEVELS, CATS: CATS, isConsumable: isConsumable, isToiletry: isToiletry, isWash: isWash, canConsume: canConsume, askCities: askCities, markAsked: markAsked, levelOf: levelOf, levelName: levelName,
    setConsumable: setConsumable, setLevel: setLevel, consumablesAt: consumablesAt,
    countryOf: countryOf, availOf: availOf, setAvail: setAvail, tripPlan: tripPlan, travelWeight: travelWeight, atDestination: atDestination,
    reminders: reminders, chooseRestock: chooseRestock, setOrdered: setOrdered, plannedWeight: plannedWeight, applyArrivals: applyArrivals,
    renderHome: renderHome, quickCheck: quickCheck
  };
})();
