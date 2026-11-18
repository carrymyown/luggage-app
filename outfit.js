/*
 * 每日穿搭：旅程的每一天（日期、所在城市、天氣、活動）＋平拍穿搭＋整趟的總結
 *
 * 主軸：不超重、行李越少越好 → 用最少的衣服搭出最多套，同時好看、不著涼、實穿。
 *
 * 資料（存在 state.dayPlans，會跟著雲端同步）：
 *   { 旅程 id: { 'YYYY-MM-DD': { acts[], picks{部位: 衣物 id 或 ''}, locks{部位: true}, seed, confirmed } } }
 *   部位：top 上衣、bottom 下身、dress 洋裝、outer 外套、shoes 鞋子、acc1／acc2 配件（包包、帽子、首飾、手錶…）
 * 天氣：Open-Meteo（免費、不需要金鑰）。16 天內用預報，更遠用往年同期平均；存在 cmo-weather（沒網路時用上次的）。
 * 自動搭配（第一版用標籤判斷）：季節與氣溫、下雨、活動、花紋、配件金銀色統一、優先用這趟要帶的、
 *   重複使用但相鄰兩天上衣不同；所在城市有家的話，那個家衣櫃裡的也能用（不用帶）；睡衣不參與。
 */
(function () {
  'use strict';

  var App = window.App, C = window.Clothing;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;

  var ACTS = ['日常逛街', '正式場合', '長途飛行', '騎馬', '網球', '運動', '海邊', '登山'];
  var PART_OF = { '上衣': 'top', '下身': 'bottom', '洋裝／連身': 'dress', '外套': 'outer', '鞋子': 'shoes', '帽子': 'acc', '圍巾': 'acc', '配件': 'acc' };
  var PART_NAME = { top: 'TOP', bottom: 'BOTTOM', dress: 'DRESS', outer: 'OUTER', shoes: 'SHOES', acc1: 'ACCESSORY', acc2: 'ACCESSORY' };
  var COUNTED = ['top', 'bottom', 'dress', 'outer', 'shoes'];   // 「X 件衣服」算這些（配件不算）

  function st() { return App.state(); }
  function plans() {
    var s = st();
    if (!s.dayPlans || typeof s.dayPlans !== 'object' || Array.isArray(s.dayPlans)) s.dayPlans = {};
    return s.dayPlans;
  }
  function planOf(tid, date, create) {
    var p = plans();
    if (!p[tid]) { if (!create) return null; p[tid] = {}; }
    if (!p[tid][date]) { if (!create) return null; p[tid][date] = { acts: null, picks: {}, locks: {}, seed: 0, confirmed: false }; }   // acts: null＝用預設（搭機那天：長途飛行）
    var x = p[tid][date];
    if (!x.picks) x.picks = {}; if (!x.locks) x.locks = {};
    return x;
  }
  function tripById(id) { return st().trips.find(function (t) { return t.id === id; }); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var p = s.split('-'); return ymd(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
  function diffDays(a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 86400000); }
  function md(s) { return window.Trips.fmtDate(s); }

  // ---------- 旅程的每一天：日期、所在城市（搭機那天：A → B） ----------
  function tripDays(t) {
    var legs = t.legs.filter(function (l) { return l.date; }).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (!legs.length) return [];
    var first = legs[0].date, last = first;
    legs.forEach(function (l) { var a = window.Trips.arrivalDate(l) || l.date; if (a > last) last = a; });
    var out = [], n = Math.min(60, diffDays(first, last));
    for (var i = 0; i <= n; i++) {
      var d = addDays(first, i), city = t.origin || (legs[0].from || ''), flights = [];
      legs.forEach(function (l) {
        if (l.date === d) flights.push(l);
        if ((window.Trips.arrivalDate(l) || l.date) <= d && l.to) city = l.to;
      });
      var from = flights.length ? (flights[0].from || '') : '';
      out.push({ date: d, city: city, flight: flights.length ? from + ' → ' + city : '', flights: flights });
    }
    return out;
  }
  function homeAt(city) { return city && window.Trips ? window.Trips.homeFor(city) : null; }

  // ---------- 天氣（Open-Meteo） ----------
  var WKEY = 'cmo-weather';   // 天氣暫存不是帳號的資料（登出也留著，沒網路時用）
  function wcache() { try { return JSON.parse(localStorage.getItem(WKEY)) || {}; } catch (e) { return {}; } }
  function wsave(c) { try { localStorage.setItem(WKEY, JSON.stringify(c)); } catch (e) { /* 空間不夠就算了 */ } }
  // 沒網路、也沒抓過時的備用：常見城市每月的平均最高／最低溫（約略）
  var CLIMATE = {
    '台北': [[19, 14], [20, 14], [22, 16], [26, 19], [29, 22], [32, 25], [34, 26], [33, 26], [31, 25], [28, 22], [25, 19], [21, 15]],
    '台中': [[22, 13], [23, 14], [25, 17], [28, 20], [31, 23], [32, 25], [33, 26], [33, 25], [32, 24], [30, 21], [27, 18], [23, 14]],
    '高雄': [[24, 16], [25, 17], [27, 20], [29, 23], [31, 25], [32, 26], [33, 26], [32, 26], [32, 25], [31, 23], [28, 21], [25, 17]],
    '東京': [[10, 2], [10, 3], [13, 5], [19, 10], [23, 15], [26, 19], [30, 23], [31, 24], [27, 21], [22, 15], [17, 9], [12, 4]],
    '大阪': [[10, 3], [10, 3], [14, 5], [20, 10], [25, 15], [28, 20], [32, 24], [33, 25], [29, 21], [23, 15], [17, 9], [12, 4]],
    '首爾': [[2, -6], [5, -3], [11, 2], [18, 8], [23, 13], [27, 18], [29, 22], [30, 23], [26, 17], [20, 10], [11, 3], [4, -4]],
    '曼谷': [[32, 22], [33, 24], [34, 26], [35, 27], [34, 26], [33, 26], [33, 25], [32, 25], [32, 25], [32, 24], [32, 23], [31, 21]],
    '清邁': [[29, 14], [32, 15], [35, 18], [36, 22], [34, 23], [32, 23], [31, 23], [31, 23], [31, 22], [30, 21], [29, 18], [28, 15]],
    '香港': [[19, 14], [19, 15], [22, 17], [25, 21], [29, 24], [31, 26], [32, 27], [31, 27], [31, 26], [28, 24], [24, 20], [20, 16]]
  };
  function climateFor(city, date) {
    var key = Object.keys(CLIMATE).find(function (k) { return city && (city.indexOf(k) >= 0 || k.indexOf(city) >= 0); });
    if (!key) {
      var h = homeAt(city), hc = h && App.homeCity ? App.homeCity(h) : '';
      key = Object.keys(CLIMATE).find(function (k) { return hc && (hc.indexOf(k) >= 0 || k.indexOf(hc) >= 0); });
    }
    if (!key) return null;
    var m = +date.split('-')[1] - 1, v = CLIMATE[key][m];
    return { hi: v[0], lo: v[1], rain: false, avg: true, rough: true };
  }
  function weatherOf(city, date) {
    var c = wcache()[city + '|' + date];
    return c || climateFor(city, date);
  }
  function getJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('weather ' + r.status); return r.json(); });
  }
  function geocode(city) {
    var c = wcache(), k = 'geo|' + city;
    if (c[k]) return Promise.resolve(c[k]);
    var q = city;
    var h = homeAt(city);
    if (h && App.homeCity) q = App.homeCity(h) || city;
    return getJSON('https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&format=json&name=' + encodeURIComponent(q)).then(function (j) {
      var r = j && j.results && j.results[0];
      if (!r) throw new Error('no city');
      var g = { lat: r.latitude, lon: r.longitude };
      var c2 = wcache(); c2[k] = g; wsave(c2);
      return g;
    });
  }
  var pending = {};
  // 抓一個城市一段日期的天氣：16 天內用預報，更遠用往年同期（前三年平均）
  function fetchWeather(city, dates) {
    var key = city + '|' + dates[0] + '|' + dates[dates.length - 1];
    if (pending[key]) return pending[key];
    var today = App.todayStr();
    var near = dates.filter(function (d) { var n = diffDays(today, d); return n >= 0 && n <= 15; });
    var far = dates.filter(function (d) { return near.indexOf(d) < 0; });
    pending[key] = geocode(city).then(function (g) {
      var jobs = [];
      if (near.length) {
        jobs.push(getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + g.lat + '&longitude=' + g.lon +
          '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&start_date=' + near[0] + '&end_date=' + near[near.length - 1]).then(function (j) {
          var c = wcache(), d = j.daily || {};
          (d.time || []).forEach(function (t, i) {
            var p = (d.precipitation_probability_max || [])[i], s = (d.precipitation_sum || [])[i];
            c[city + '|' + t] = { hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]), rain: (p != null && p >= 50) || (s != null && s >= 1), avg: false, at: Date.now() };
          });
          wsave(c);
        }));
      }
      if (far.length) {
        var y0 = +far[0].slice(0, 4), years = [1, 2, 3];
        jobs.push(Promise.all(years.map(function (k) {
          var s0 = (+far[0].slice(0, 4) - k) + far[0].slice(4), s1 = (+far[far.length - 1].slice(0, 4) - k) + far[far.length - 1].slice(4);
          return getJSON('https://archive-api.open-meteo.com/v1/archive?latitude=' + g.lat + '&longitude=' + g.lon +
            '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=' + s0 + '&end_date=' + s1).catch(function () { return null; });
        })).then(function (rs) {
          var acc = {};
          rs.forEach(function (j) {
            var d = j && j.daily; if (!d) return;
            (d.time || []).forEach(function (t, i) {
              var mdk = t.slice(5), a = acc[mdk] || (acc[mdk] = { hi: 0, lo: 0, rain: 0, n: 0 });
              if (d.temperature_2m_max[i] == null) return;
              a.hi += d.temperature_2m_max[i]; a.lo += d.temperature_2m_min[i]; a.rain += (d.precipitation_sum[i] || 0); a.n++;
            });
          });
          var c = wcache();
          far.forEach(function (dd) {
            var a = acc[dd.slice(5)]; if (!a || !a.n) return;
            c[city + '|' + dd] = { hi: Math.round(a.hi / a.n), lo: Math.round(a.lo / a.n), rain: a.rain / a.n >= 2, avg: true, at: Date.now() };
          });
          wsave(c);
          void y0;
        }));
      }
      return Promise.all(jobs);
    }).then(function () { delete pending[key]; return true; }, function () { delete pending[key]; return false; });
    return pending[key];
  }
  function loadWeather(t, done) {
    if (!navigator.onLine) return;
    var byCity = {};
    tripDays(t).forEach(function (d) { (byCity[d.city] = byCity[d.city] || []).push(d.date); });
    Promise.all(Object.keys(byCity).map(function (city) {
      var c = wcache(), dates = byCity[city];
      var fresh = dates.every(function (d) { var w = c[city + '|' + d]; return w && w.at && Date.now() - w.at < (w.avg ? 7 : 0.25) * 86400000; });
      return fresh ? false : fetchWeather(city, dates);
    })).then(function (rs) { if (rs.some(Boolean) && done) done(); });
  }
  function weatherText(w) {
    if (!w) return '<span class="muted small">還沒有天氣資料</span>';
    return '<span class="ow-temp">' + w.hi + '° / ' + w.lo + '°</span>' + (w.rain ? '<span class="ow-rain">可能下雨</span>' : '') +
      (w.avg ? '<span class="muted small ow-avg">' + (w.rough ? '往年平均（約略）' : '往年平均') + '</span>' : '');
  }

  // ---------- 自動搭配 ----------
  function patterned(m) { var p = m.clothing && m.clothing.pattern; return !!p && p !== '素色'; }
  function has(m, list) { var txt = [m.name, m.clothing.type, m.clothing.subtype].join(' '); return list.some(function (k) { return txt.indexOf(k) >= 0; }); }
  function inList(arr, v) { return (arr || []).indexOf(v) >= 0; }
  function metalOf(m) { var cs = m.clothing.colors || []; return inList(cs, '金色') || inList(cs, '玫瑰金') ? 'gold' : inList(cs, '銀色') ? 'silver' : ''; }

  // 這一天可以穿的衣服：這趟要帶的、所在城市那個家衣櫃裡的（不用帶）、出發的家裡還沒放進清單的（要加帶）
  function pool(t, day) {
    var list = window.Packing.listOf(t);
    var packed = {};
    list.entries.forEach(function (e) { if (e.status === 'take' && e.catalogId) packed[e.catalogId] = true; });
    var origin = homeAt(t.origin), here = homeAt(day.city);
    return st().memory.filter(function (m) {
      return App.isCloth(m) && PART_OF[m.clothing.group];
    }).map(function (m) {
      var loc = App.locOf(m) || {}, src = null;
      if (packed[m.id]) src = 'pack';
      else if (here && here !== origin && loc.state === 'home' && loc.home === here) src = 'home';
      else if (loc.state === 'none' || loc.state === 'packed' || (loc.state === 'home' && (!origin || loc.home === origin))) src = 'add';
      return src ? { m: m, part: PART_OF[m.clothing.group], src: src, here: here } : null;
    }).filter(Boolean);
  }

  function rnd(seed, id) {
    var h = 2166136261 ^ seed;
    for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1000) / 1000;
  }

  // 這個氣溫適合哪些季節的衣服（平均溫度）
  function seasonsFor(avg) { return avg >= 25 ? ['夏'] : avg >= 18 ? ['春', '秋'] : avg >= 10 ? ['秋', '冬'] : ['冬']; }

  // 一件衣服對這一天的分數（越高越適合）
  function score(c, ctx) {
    var m = c.m, tg = m.clothing, s = 0, acts = ctx.acts, w = ctx.w, avg = w ? (w.hi + w.lo) / 2 : 20;
    s += c.src === 'pack' ? 4 : c.src === 'home' ? 4 : -8;   // 不在清單上的（要加帶）盡量不用
    // 季節、氣溫
    var want = seasonsFor(avg);
    if ((tg.seasons || []).length) s += tg.seasons.some(function (x) { return want.indexOf(x) >= 0; }) ? 3 : -4;
    if (tg.thickness === '厚') s += avg < 15 ? 2 : avg >= 24 ? -3 : 0;
    if (tg.thickness === '薄') s += avg >= 22 ? 1 : avg < 12 ? -2 : 0;
    if (c.part === 'outer') {
      if (avg < 10) s += has(m, ['大衣', '羽絨']) ? 4 : -1;
      else if (avg < 16) s += has(m, ['大衣', '羽絨']) ? 0 : 2;
      else s += has(m, ['大衣', '羽絨']) ? -5 : 2;
    }
    if (c.part === 'top' && avg < 15) s += has(m, ['毛衣', '針織', '襯衫']) ? 2 : has(m, ['背心']) ? -3 : 0;
    if (c.part === 'bottom') s += avg < 12 ? (has(m, ['短褲']) ? -5 : 0) : avg >= 27 ? (has(m, ['短褲', '裙']) ? 2 : 0) : 0;
    // 下雨：避開不適合雨天的鞋子
    if (w && w.rain && c.part === 'shoes') s += inList(tg.uses, '雨天') ? 5 : has(m, ['涼', '拖', '帆布', '麂皮']) ? -6 : 0;
    // 活動
    var sty = tg.styles || [], uses = tg.uses || [];
    if (inList(acts, '正式場合')) {
      if (c.part !== 'acc') s += inList(sty, '正式') ? 8 : inList(sty, '運動') ? -6 : 0;
      if (c.part === 'top' && has(m, ['T 恤', '帽T'])) s -= 5;
      if (c.part === 'bottom' && has(m, ['牛仔', '短褲'])) s -= 4;
      if (c.part === 'shoes') s += inList(uses, '正式') || has(m, ['樂福', '高跟', '皮鞋', '跟鞋']) ? 8 : has(m, ['運動', '跑步']) ? -5 : 0;
      if (c.part === 'dress') s += 5;
    }
    if (inList(acts, '長途飛行')) {
      if (c.part !== 'acc') s += inList(sty, '休閒') || inList(sty, '運動') ? 4 : inList(sty, '正式') ? -3 : 0;
      if (has(m, ['針織', '毛衣', 'T 恤', '帽T'])) s += 2;
      if (c.part === 'dress') s -= 3;
      if (c.part === 'shoes') s += has(m, ['運動', '休閒', '走路']) || inList(uses, '走路') ? 4 : has(m, ['高跟', '跟鞋']) ? -4 : 0;
      if (c.part === 'outer') s += 2;   // 機艙冷，帶一件
    }
    if (inList(acts, '騎馬')) { if (has(m, ['馬術', '馬褲', '騎馬', '馬靴'])) s += 8; if (c.part === 'shoes') s += inList(uses, '騎馬') ? 10 : 0; if (c.part === 'dress') s -= 8; }
    if (inList(acts, '網球')) { if (c.part === 'shoes') s += inList(uses, '網球') ? 10 : 0; if (inList(sty, '運動')) s += 3; if (c.part === 'dress') s -= 6; }
    if (inList(acts, '運動')) { if (inList(sty, '運動')) s += 4; if (c.part === 'shoes') s += inList(uses, '跑步') || inList(uses, '走路') ? 5 : 0; if (c.part === 'dress') s -= 6; }
    if (inList(acts, '登山')) { if (c.part === 'shoes') s += inList(uses, '登山') ? 10 : has(m, ['高跟', '跟鞋', '樂福']) ? -6 : 0; if (inList(sty, '運動')) s += 2; if (c.part === 'dress') s -= 10; }
    if (inList(acts, '海邊')) { if (inList(tg.seasons, '夏') || inList(sty, '度假')) s += 4; if (c.part === 'shoes' && has(m, ['涼', '拖'])) s += 6; }
    if (inList(acts, '日常逛街')) { if (inList(sty, '休閒')) s += 3; if (c.part === 'shoes' && (inList(uses, '走路') || has(m, ['運動', '休閒']))) s += 3; }
    // 重複使用（行李越少越好）；相鄰兩天上衣不同
    var used = ctx.usage[m.id] || 0;
    s += c.part === 'top' ? Math.min(used, 2) * 0.5 : Math.min(used, 3) * 0.8;
    if (c.part === 'top' && ctx.prevTop === m.id) s -= 100;
    if (ctx.seed) s += rnd(ctx.seed, m.id) * 3;
    return s;
  }

  function accScore(c, ctx, chosenMetal) {
    var m = c.m, s = score(c, ctx), w = ctx.w, avg = w ? (w.hi + w.lo) / 2 : 20, acts = ctx.acts;
    if (m.clothing.group === '圍巾') s += avg < 12 ? 5 : -6;
    if (m.clothing.group === '帽子') s += has(m, ['毛帽']) ? (avg < 10 ? 4 : -5) : (inList(acts, '海邊') || inList(acts, '登山') || avg >= 26) ? 3 : -1;
    var metal = metalOf(m);
    if (metal && chosenMetal && metal !== chosenMetal) s -= 8;   // 配件顏色統一（金色／銀色）
    if (metal && inList(acts, '正式場合')) s += 3;
    if (metal && (inList(acts, '運動') || inList(acts, '登山'))) s -= 4;
    return s;
  }

  // 排出一套：locks 鎖住的部位保留；其餘依分數挑
  function makeOutfit(t, day, plan, ctx) {
    var cands = pool(t, day);
    var byPart = { top: [], bottom: [], dress: [], outer: [], shoes: [], acc: [] };
    cands.forEach(function (c) { byPart[c.part].push(c); });
    function ranked(part, extra) {
      return byPart[part].map(function (c) { return { c: c, s: score(c, ctx) + (extra ? extra(c) : 0) }; }).sort(function (a, b) { return b.s - a.s; });
    }
    var picks = {}, locks = (plan && plan.locks) || {}, fixed = (plan && plan.picks) || {};
    // 存著的選擇只在那件衣服還在、還能穿時才算（衣服刪掉或搬到別的家就重新配）
    function valid(id) { return id === '' || cands.some(function (c) { return c.m.id === id; }); }
    function keep(part) { return (locks[part] || plan && plan.confirmed) && fixed[part] !== undefined && valid(fixed[part]); }
    var avg = ctx.w ? (ctx.w.hi + ctx.w.lo) / 2 : 20;
    // 洋裝 vs 上衣＋下身
    var topR = ranked('top'), dressR = ranked('dress');
    var bestTop = topR[0], useDress = false;
    var form = plan && plan.form;   // 使用者選的：dress 洋裝／sep 上衣＋下身
    if (keep('dress') && fixed.dress) useDress = true;
    else if (keep('top') || keep('bottom')) useDress = false;
    else if (form === 'dress' && dressR.length) useDress = true;
    else if (form === 'sep' && (topR.length || !dressR.length)) useDress = false;
    else if (dressR.length && (!bestTop || dressR[0].s > bestTop.s)) useDress = true;
    if (useDress) picks.dress = keep('dress') ? fixed.dress : dressR[0].c.m.id;
    else {
      picks.top = keep('top') ? fixed.top : (bestTop ? bestTop.c.m.id : '');
      var topM = picks.top && App.entryById(picks.top);
      var botR = ranked('bottom', function (c) { return topM && patterned(topM) && patterned(c.m) ? -8 : 0; });   // 花紋配素色
      picks.bottom = keep('bottom') ? fixed.bottom : (botR[0] ? botR[0].c.m.id : '');
    }
    // 外套：低於約 15°C 一定要；很熱不用
    var needOuter = ctx.w && (ctx.w.lo < 15 || avg < 17);
    var already = [picks.top, picks.bottom, picks.dress].map(function (id) { return id && App.entryById(id); }).filter(Boolean);
    var anyPat = already.some(patterned);
    var outR = ranked('outer', function (c) { return anyPat && patterned(c.m) ? -6 : 0; });
    if (keep('outer')) picks.outer = fixed.outer;
    else if (outR.length && (needOuter || (avg < 22 && outR[0].s > 3) || (inList(ctx.acts, '長途飛行') && avg < 26))) picks.outer = outR[0].c.m.id;
    else picks.outer = '';
    var shoeR = ranked('shoes');
    picks.shoes = keep('shoes') ? fixed.shoes : (shoeR[0] ? shoeR[0].c.m.id : '');
    // 配件：最多兩樣，金色／銀色統一
    var metal = '';
    ['acc1', 'acc2'].forEach(function (slot) {
      if (keep(slot)) { picks[slot] = fixed[slot]; var mm = fixed[slot] && App.entryById(fixed[slot]); if (mm && metalOf(mm)) metal = metalOf(mm); return; }
      var taken = [picks.acc1];
      var r = byPart.acc.filter(function (c) { return taken.indexOf(c.m.id) < 0 && !(slot === 'acc2' && picks.acc1 && App.entryById(picks.acc1) && App.entryById(picks.acc1).clothing.type === c.m.clothing.type && c.m.clothing.type); })
        .map(function (c) { return { c: c, s: accScore(c, ctx, metal) }; }).sort(function (a, b) { return b.s - a.s; });
      picks[slot] = r[0] && r[0].s > 1 ? r[0].c.m.id : '';
      var pm = picks[slot] && App.entryById(picks[slot]);
      if (pm && metalOf(pm)) metal = metalOf(pm);
    });
    // 使用者滑過的（沒鎖也算這一天選的）
    if (plan && !plan.confirmed) Object.keys(fixed).forEach(function (k) { if (!locks[k] && plan.chosen && plan.chosen[k] && valid(fixed[k]) && (k in picks)) picks[k] = fixed[k]; });
    if (picks.dress) { delete picks.top; delete picks.bottom; } else delete picks.dress;
    return { picks: picks, byPart: byPart, cands: cands, needOuter: needOuter };
  }

  // 整趟每一天的穿搭（依序排，才能讓相鄰兩天上衣不同、盡量重複使用）
  function planTrip(t) {
    var days = tripDays(t), usage = {}, prevTop = '', out = [];
    days.forEach(function (d) {
      var plan = planOf(t.id, d.date, false);
      var acts = plan && Array.isArray(plan.acts) ? plan.acts : defaultActs(d);
      var ctx = { w: weatherOf(d.city, d.date), acts: acts, usage: usage, prevTop: prevTop, seed: plan ? plan.seed || 0 : 0 };
      var r = makeOutfit(t, d, plan, ctx);
      Object.keys(r.picks).forEach(function (k) { var id = r.picks[k]; if (id) usage[id] = (usage[id] || 0) + 1; });
      prevTop = r.picks.top || r.picks.dress || '';
      out.push({ day: d, plan: plan, acts: acts, ctx: ctx, outfit: r });
    });
    return out;
  }
  function defaultActs(d) { return d.flights.length ? ['長途飛行'] : []; }

  // ---------- 整趟總結：X 件搭出 Y 套、可以不帶的、多帶這件可以多 Z 套 ----------
  function compatible(a, b) { return !(patterned(a) && patterned(b)); }
  function looksOf(items) {
    var tops = items.filter(function (m) { return PART_OF[m.clothing.group] === 'top'; });
    var bots = items.filter(function (m) { return PART_OF[m.clothing.group] === 'bottom'; });
    var dresses = items.filter(function (m) { return PART_OF[m.clothing.group] === 'dress'; });
    var n = dresses.length;
    tops.forEach(function (a) { bots.forEach(function (b) { if (compatible(a, b)) n++; }); });
    return n;
  }
  function summary(t, planned) {
    var list = window.Packing.listOf(t);
    var packed = [];
    list.entries.forEach(function (e) {
      if (e.status !== 'take' || !e.catalogId) return;
      var m = App.entryById(e.catalogId);
      if (m && App.isCloth(m) && COUNTED.indexOf(PART_OF[m.clothing.group]) >= 0 && packed.indexOf(m) < 0) packed.push(m);
    });
    var used = {};
    planned.forEach(function (p) { Object.keys(p.outfit.picks).forEach(function (k) { if (p.outfit.picks[k]) used[p.outfit.picks[k]] = true; }); });
    var unused = packed.filter(function (m) { return !used[m.id]; });
    var looks = looksOf(packed);
    // 多帶哪一件最划算（出發的家裡、還沒放進清單的上衣／下身／洋裝）
    var origin = homeAt(t.origin), best = null, seasons = [];
    planned.forEach(function (p) { var w = p.ctx.w; seasonsFor(w ? (w.hi + w.lo) / 2 : 20).forEach(function (x) { if (seasons.indexOf(x) < 0) seasons.push(x); }); });
    st().memory.forEach(function (m) {
      if (!App.isCloth(m) || packed.indexOf(m) >= 0) return;
      var part = PART_OF[m.clothing.group];
      if (['top', 'bottom', 'dress'].indexOf(part) < 0) return;
      var loc = App.locOf(m) || {};
      if (loc.state === 'home' && origin && loc.home !== origin) return;
      if (seasons.length && (m.clothing.seasons || []).length && !m.clothing.seasons.some(function (x) { return seasons.indexOf(x) >= 0; })) return;   // 這趟每天的天氣都用不到的季節，不建議
      var z = looksOf(packed.concat([m])) - looks;
      if (z >= 2 && (!best || z > best.z || (z === best.z && (m.weight || 0) < (best.m.weight || 0)))) best = { m: m, z: z };
    });
    var w = packed.reduce(function (s, m) { return s + (Number(m.weight) || 0); }, 0);
    // 清單上還沒打勾（還沒放進行李）的重量：拿掉或加進衣服，「全部放進去後」的公斤數馬上跟著變
    var todo = list.entries.reduce(function (s, e) { return e.status === 'take' && !e.checked ? s + (Number(e.weight) || 0) * (Number(e.qty) || 1) : s; }, 0);
    return { count: packed.length, looks: looks, unused: unused, best: best, weight: w, todo: todo };
  }

  // ---------- 畫面 ----------
  // 沒有照片：簡單的線條示意圖（填入衣服的顏色）
  var ART = {
    top: 'M22 14l-10 7 5 8 5-3v28h28V26l5 3 5-8-10-7h-7c0 4-3 6-7 6s-7-2-7-6z',
    bottom: 'M22 12h24l3 48h-11l-4-32-4 32H19z',
    dress: 'M28 10h12l2 8-3 6 10 36H19l10-36-3-6z',
    outer: 'M24 10l-12 8v42h17V28l5 6 5-6v32h17V18l-12-8-10 10z',
    shoes: 'M12 46V32h12l5 9c10 2 22 4 28 9v6H12z',
    acc: 'M34 18a14 14 0 1 0 0.1 0zM34 26a6 6 0 1 1-0.1 0z'
  };
  function art(part, m) {
    var col = m && m.clothing && (m.clothing.colors || [])[0] ? C.colorHex(m.clothing.colors[0]) : '#F4F4F4';
    var hex = String(col).match(/#[0-9a-fA-F]{3,6}/); col = hex ? hex[0] : '#F4F4F4';   // 金色、銀色是漸層：取第一個顏色
    var key = part === 'acc1' || part === 'acc2' ? 'acc' : part;
    if (key === 'acc' && m) {
      if (m.clothing.group === '帽子') return '<svg viewBox="0 0 68 68"><path d="M14 44h40M20 44c0-12 6-20 14-20s14 8 14 20" fill="' + col + '" stroke="#111" stroke-width="1.5"/></svg>';
      if (has(m, ['包'])) return '<svg viewBox="0 0 68 68"><path d="M16 28h36l-3 28H19z" fill="' + col + '" stroke="#111" stroke-width="1.5"/><path d="M26 28v-6a8 8 0 0 1 16 0v6" fill="none" stroke="#111" stroke-width="1.5"/></svg>';
      if (has(m, ['耳環', '項鍊', '戒指', '手環'])) return '<svg viewBox="0 0 68 68"><circle cx="24" cy="38" r="8" fill="none" stroke="' + col + '" stroke-width="4"/><circle cx="24" cy="38" r="10" fill="none" stroke="#111" stroke-width="1"/><circle cx="44" cy="38" r="8" fill="none" stroke="' + col + '" stroke-width="4"/><circle cx="44" cy="38" r="10" fill="none" stroke="#111" stroke-width="1"/><path d="M24 28v-6M44 28v-6" stroke="#111" stroke-width="1.5"/></svg>';
      if (has(m, ['錶'])) return '<svg viewBox="0 0 68 68"><rect x="28" y="10" width="12" height="48" fill="none" stroke="#111" stroke-width="1.5"/><circle cx="34" cy="34" r="11" fill="' + col + '" stroke="#111" stroke-width="1.5"/></svg>';
    }
    return '<svg viewBox="0 0 68 68"><path d="' + ART[key] + '" fill="' + col + '" stroke="#111" stroke-width="1.5" fill-rule="evenodd"/></svg>';
  }
  function itemCard(part, m) {
    if (!m) return '<div class="of-item of-none"><span>' + (part === 'outer' ? '不穿外套' : '不搭配') + '</span></div>';
    return '<div class="of-item">' + (m.photoId ? '<img data-photo="' + esc(m.photoId) + '" alt="">' : '<div class="of-art">' + art(part, m) + '</div>') + '</div>';
  }
  function srcTag(c) {
    if (!c) return '';
    if (c.src === 'home') return '在' + esc(App.homeCity(c.here)) + '的家・不用帶';
    if (c.src === 'add') return '要加帶';
    return '這趟要帶';
  }
  function pieceImg(m) {
    return m.photoId ? '<img data-photo="' + esc(m.photoId) + '" alt="">' : art(PART_OF[m.clothing.group], m);
  }
  // 每一天右邊的小方格：已經搭好（按過「確定這套」）→ 上衣和下身疊在一起的小縮圖；還沒搭 → 虛線框＋細線「＋」
  function lookTile(p) {
    var ids = p.outfit.picks, done = !!(p.plan && p.plan.confirmed);
    var pieces = (ids.dress ? [ids.dress] : [ids.top, ids.bottom]).map(function (id) { return id && App.entryById(id); }).filter(Boolean);
    var sq = done && pieces.length ?
      '<span class="od-sq' + (pieces.length === 1 ? ' one' : '') + '">' + pieces.map(function (m, i) { return '<span class="od-pc od-pc' + i + '">' + pieceImg(m) + '</span>'; }).join('') + '</span>' :
      '<span class="od-sq empty"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#111" stroke-width="1" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>';
    return '<span class="od-look" aria-label="' + (done ? '看這天的穿搭' : '搭配這天的穿搭') + '">' + sq + '<span class="od-go">穿搭 ›</span></span>';
  }

  var curTrip = null, curDate = '';
  function view() { return $('#view-outfit'); }

  function show(tid, date) {
    var t = tripById(tid);
    if (!t) {
      var n = App.nextTrip ? App.nextTrip() : null;
      t = n || st().trips[0];
      if (t && !tid) { location.replace('#outfit/' + encodeURIComponent(t.id)); return; }
    }
    if (!t) {
      view().innerHTML = '<div class="page-head"><h1 data-en="OUTFITS">每日穿搭</h1></div><div class="empty-state"><p class="empty-line">還沒有旅程</p><a href="#trips/new" class="btn primary">新增第一趟</a></div>';
      return;
    }
    curTrip = t; curDate = date || '';
    if (curDate) renderDay(); else renderList();
    loadWeather(t, function () { if (location.hash.indexOf('#outfit/' + encodeURIComponent(t.id)) === 0) { if (curDate) renderDay(); else renderList(); } });
  }

  function renderList() {
    var t = curTrip, planned = planTrip(t), sm = summary(t, planned);
    var r = App.tripRemain(t);
    var html = '<div class="page-head"><h1 data-en="OUTFITS">' + esc(t.name || '每日穿搭') + '</h1>' +
      '<a class="btn ghost small-btn" href="#trips/' + encodeURIComponent(t.id) + '">編輯旅程</a></div>';
    if (!planned.length) {
      view().innerHTML = html + '<div class="empty-state"><p class="empty-line">先填上航班日期，就能看每一天的穿搭</p><a class="btn primary" href="#trips/' + encodeURIComponent(t.id) + '">填寫航班</a></div>';
      return;
    }
    // 整趟總結（最重要）
    html += '<section class="of-summary">' +
      '<div class="eyebrow">CAPSULE</div>' +
      '<p class="of-big">這 <b data-roll="of-n">' + sm.count + '</b> 件衣服，可以搭出 <b data-roll="of-y">' + sm.looks + '</b> 套</p>' +
      '<p class="muted small of-kg">清單上的衣服共 ' + App.fmtWeight(sm.weight) + (r.remain == null ? '・這趟還沒設定額度' :
        '・這趟還能放 <span data-roll="of-r">' + kg(r.remain) + '</span> kg・清單全部放進去後約 <span data-roll="of-a">' + kg(r.remain - sm.todo) + '</span> kg') + '</p>';
    if (sm.unused.length) {
      html += '<div class="of-tip"><div class="of-tip-title">這幾件可以不帶</div>' +
        '<div class="of-chips">' + sm.unused.map(function (m) { return '<span class="of-chip">' + esc(m.name) + '</span>'; }).join('') + '</div>' +
        '<button type="button" class="btn ghost small-btn" data-of-drop="1">從打包清單移除（' + sm.unused.length + ' 件）</button></div>';
    }
    if (sm.best) {
      html += '<div class="of-tip"><div class="of-tip-title">多帶「' + esc(sm.best.m.name) + '」，可以多 ' + sm.best.z + ' 套</div>' +
        '<p class="muted small">' + App.fmtWeight(sm.best.m.weight || 0) + '</p>' +
        '<button type="button" class="btn ghost small-btn" data-of-add="' + esc(sm.best.m.id) + '">加入打包清單</button></div>';
    }
    html += '</section>';
    // 每一天
    html += '<section class="of-days"><div class="sec-head"><span class="eyebrow">DAYS</span></div>' + planned.map(function (p) {
      var d = p.day, w = p.ctx.w;
      return '<a class="od-row" href="#outfit/' + encodeURIComponent(t.id) + '/' + d.date + '">' +
        '<span class="od-date">' + esc(md(d.date)) + '</span>' +
        '<span class="od-main"><span class="od-city">' + esc(d.flight || d.city) + (homeAt(d.city) ? '<span class="muted small">・有家</span>' : '') + '</span>' +
        '<span class="od-weather">' + weatherText(w) + '</span>' +
        (p.acts.length ? '<span class="od-acts muted small">' + esc(p.acts.join('・')) + '</span>' : '') + '</span>' +
        lookTile(p) + '</a>';
    }).join('') + '</section>';
    view().innerHTML = html;
    if (window.Photos) Photos.fillThumbs(view());
    if (window.UI) UI.rollAll(view());   // 拿掉、加進衣服後數字平滑滾動
  }
  function kg(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  // ---------- 某一天的穿搭（平拍） ----------
  var dayCtx = null;
  function renderDay() {
    var t = curTrip, planned = planTrip(t);
    var p = planned.find(function (x) { return x.day.date === curDate; });
    if (!p) { location.replace('#outfit/' + encodeURIComponent(t.id)); return; }
    var d = p.day, plan = planOf(t.id, d.date, false), r = p.outfit, picks = r.picks;
    dayCtx = { p: p, r: r };
    var useDress = !!picks.dress;
    var slots = useDress ? ['dress', 'outer', 'shoes', 'acc1', 'acc2'] : ['top', 'bottom', 'outer', 'shoes', 'acc1', 'acc2'];
    var acts = ACTS.concat((App.customs('outfit-act') || []).filter(function (a) { return ACTS.indexOf(a) < 0; }));
    var reasons = [];
    if (p.ctx.w) {
      if (r.needOuter) reasons.push(p.ctx.w.lo + '°C，要有外套');
      if (p.ctx.w.rain) reasons.push('可能下雨，避開不適合雨天的鞋子');
    }
    if (inList(p.acts, '正式場合')) reasons.push('正式場合，選正式風格');
    if (inList(p.acts, '長途飛行')) reasons.push('長途飛行，選舒適的');
    var html = '<div class="page-head of-day-head"><div><a class="link small" href="#outfit/' + encodeURIComponent(t.id) + '">‹ 每日穿搭</a>' +
      '<h1 data-en="DAY ' + (planned.indexOf(p) + 1) + '">' + esc(md(d.date)) + ' ' + esc(d.flight || d.city) + '</h1></div></div>' +
      '<div class="of-weather">' + weatherText(p.ctx.w) + (homeAt(d.city) && homeAt(d.city) !== homeAt(curTrip.origin) ? '<span class="muted small">' + esc(App.homeCity(homeAt(d.city))) + '有家：那裡的衣服也能穿、不用帶</span>' : '') + '</div>' +
      '<div class="field-title">當天活動</div><div class="chips of-acts">' + acts.map(function (a) {
        return '<button type="button" class="chip' + (inList(p.acts, a) ? ' on' : '') + '" data-of-act="' + esc(a) + '">' + esc(a) + '</button>';
      }).join('') + '<button type="button" class="chip" data-of-act-add="1">＋ 自己新增</button></div>' +
      (reasons.length ? '<p class="muted small of-why">' + esc(reasons.join('・')) + '</p>' : '') +
      '<div class="of-board' + (useDress ? ' dress' : '') + '">' + slots.map(function (slot) { return slotHTML(slot, r, plan); }).join('') + '</div>' +
      (r.byPart.dress.length && (r.byPart.top.length || r.byPart.bottom.length) ?
        '<p class="of-form"><button type="button" class="link small" data-of-form="' + (useDress ? 'sep' : 'dress') + '">' + (useDress ? '改成上衣＋下身' : '改成洋裝') + '</button></p>' : '') +
      '<div class="of-actions"><button type="button" class="btn ghost" data-of-shuffle="1">換一套</button>' +
      '<button type="button" class="btn primary" data-of-confirm="1">' + (plan && plan.confirmed ? '已確定・更新這套' : '確定這套') + '</button></div>' +
      '<p class="muted small of-note">確定後，這套用到的衣服會加進這趟的打包清單（已經在清單裡的不會重複；在有家城市的衣服不用帶）。</p>';
    view().innerHTML = html;
    if (window.Photos) Photos.fillThumbs(view());
    // 每個部位捲到目前選的那一件
    view().querySelectorAll('.of-track').forEach(function (tr) {
      var i = +tr.getAttribute('data-index') || 0;
      tr.scrollLeft = i * tr.clientWidth;
    });
  }

  function slotCands(slot, r) {
    var part = slot === 'acc1' || slot === 'acc2' ? 'acc' : slot;
    var list = r.byPart[part].slice().sort(function (a, b) { return score(b, dayCtx.p.ctx) - score(a, dayCtx.p.ctx); });
    var out = list.map(function (c) { return c; });
    if (slot === 'outer' || part === 'acc') out.unshift(null);   // 外套、配件可以不搭
    return out;
  }
  function slotHTML(slot, r, plan) {
    var cands = slotCands(slot, r), cur = r.picks[slot] || '';
    var idx = Math.max(0, cands.findIndex(function (c) { return (c ? c.m.id : '') === cur; }));
    var curC = cands[idx], locked = !!(plan && plan.locks && plan.locks[slot]);
    return '<div class="of-slot of-' + slot + '" data-slot="' + slot + '">' +
      '<div class="of-slot-head"><span class="eyebrow">' + PART_NAME[slot] + '</span>' +
      '<button type="button" class="of-lock' + (locked ? ' on' : '') + '" data-of-lock="' + slot + '" aria-label="' + (locked ? '取消固定' : '固定這件') + '">' + lockIcon(locked) + '</button></div>' +
      '<div class="of-stage"><button type="button" class="of-arrow prev" data-of-step="-1" aria-label="上一件">‹</button>' +
      '<div class="of-track" data-index="' + idx + '">' + cands.map(function (c) { return itemCard(slot, c ? c.m : null); }).join('') + '</div>' +
      '<button type="button" class="of-arrow next" data-of-step="1" aria-label="下一件">›</button></div>' +
      '<div class="of-cap"><span class="of-name">' + (curC ? esc(curC.m.name) : (slot === 'outer' ? '不穿外套' : '不搭配')) + '</span>' +
      '<span class="muted small of-src">' + srcTag(curC) + '</span></div></div>';
  }
  function lockIcon(on) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="5" y="11" width="14" height="9"/>' + (on ? '<path d="M8 11V8a4 4 0 0 1 8 0v3"/>' : '<path d="M8 11V8a4 4 0 0 1 7.5-2"/>') + '</svg>';
  }

  // 滑到某一件：記下這天選的這件
  function choose(slot, index) {
    var r = dayCtx.r, cands = slotCands(slot, r), c = cands[index];
    var plan = planOf(curTrip.id, curDate, true);
    if (!plan.chosen) plan.chosen = {};
    plan.picks[slot] = c ? c.m.id : '';
    plan.chosen[slot] = true;
    dayCtx.r.picks[slot] = plan.picks[slot];
    if (plan.confirmed) plan.confirmed = false;
    App.save();
    var el = view().querySelector('[data-slot="' + slot + '"]');
    if (el) {
      el.querySelector('.of-name').textContent = c ? c.m.name : (slot === 'outer' ? '不穿外套' : '不搭配');
      el.querySelector('.of-src').innerHTML = srcTag(c);
      el.querySelector('.of-track').setAttribute('data-index', index);
    }
    var cb = view().querySelector('[data-of-confirm]'); if (cb) cb.textContent = '確定這套';
  }

  // 這天的活動
  function setActs(tid, date, acts) {
    var plan = planOf(tid, date, true);
    plan.acts = acts.slice();
    App.save();
    return plan;
  }
  // 確定這套：這套用到的衣服加進這趟的打包清單（已經在清單裡的不重複；在有家城市的不用帶）
  function confirm(tid, date) {
    var t = tripById(tid); if (!t) return 0;
    var planned = planTrip(t), p = planned.find(function (x) { return x.day.date === date; });
    if (!p) return 0;
    var plan = planOf(tid, date, true), added = 0;
    plan.picks = Object.assign({}, p.outfit.picks);
    plan.confirmed = true;
    Object.keys(plan.picks).forEach(function (k) {
      var id = plan.picks[k]; if (!id) return;
      var c = p.outfit.cands.find(function (x) { return x.m.id === id; });
      if (c && c.src === 'home') return;
      var list = window.Packing.listOf(t);
      var e = list.entries.find(function (x) { return x.catalogId === id && x.status === 'take'; });
      if (!e) { window.Packing.addToTrip(t, App.entryById(id)); added++; }
    });
    App.save();
    return added;
  }

  // ---------- 操作 ----------
  var scrollTimer = null;
  view().addEventListener('scroll', function (e) {
    var tr = e.target;
    if (!tr.classList || !tr.classList.contains('of-track')) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth));
      if (i !== +tr.getAttribute('data-index')) choose(tr.closest('[data-slot]').getAttribute('data-slot'), i);
    }, 140);
  }, true);

  view().addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-of-step]'))) {
      var tr = el.parentNode.querySelector('.of-track'), n = tr.children.length;
      var i = (+tr.getAttribute('data-index') + (+el.getAttribute('data-of-step')) + n) % n;
      tr.scrollTo({ left: i * tr.clientWidth, behavior: 'smooth' });
      choose(el.closest('[data-slot]').getAttribute('data-slot'), i);
      return;
    }
    if ((el = t.closest('[data-of-lock]'))) {
      var slot = el.getAttribute('data-of-lock'), plan = planOf(curTrip.id, curDate, true);
      plan.locks[slot] = !plan.locks[slot];
      if (plan.locks[slot]) { plan.picks[slot] = dayCtx.r.picks[slot] || ''; } else delete plan.locks[slot];
      App.save();
      el.classList.toggle('on', !!plan.locks[slot]);
      el.innerHTML = lockIcon(!!plan.locks[slot]);
      App.toast(plan.locks[slot] ? '已固定這件' : '已取消固定');
      return;
    }
    if ((el = t.closest('[data-of-act]'))) {
      var a = el.getAttribute('data-of-act'), cur = (planOf(curTrip.id, curDate, false) || {}).acts || dayCtx.p.acts.slice();
      var next = inList(cur, a) ? cur.filter(function (x) { return x !== a; }) : cur.concat([a]);
      var pl = setActs(curTrip.id, curDate, next);
      pl.chosen = {}; Object.keys(pl.picks).forEach(function (k) { if (!pl.locks[k]) delete pl.picks[k]; });   // 活動改了：重新配（鎖住的保留）
      pl.confirmed = false;
      App.save(); renderDay();
      return;
    }
    if (t.closest('[data-of-act-add]')) {
      window.Clothing.askText('新增一種活動', '').then(function (v) {
        v = String(v || '').trim().slice(0, 12); if (!v) return;
        App.addCustom('outfit-act', v);
        var cur2 = (planOf(curTrip.id, curDate, false) || {}).acts || dayCtx.p.acts.slice();
        if (!inList(cur2, v)) setActs(curTrip.id, curDate, cur2.concat([v]));
        renderDay();
      });
      return;
    }
    if ((el = t.closest('[data-of-form]'))) {
      var pf = planOf(curTrip.id, curDate, true);
      pf.form = el.getAttribute('data-of-form');
      if (!pf.chosen) pf.chosen = {};
      ['top', 'bottom', 'dress'].forEach(function (k) { delete pf.picks[k]; delete pf.locks[k]; delete pf.chosen[k]; });
      pf.confirmed = false;
      App.save(); renderDay();
      return;
    }
    if (t.closest('[data-of-shuffle]')) {
      var ps = planOf(curTrip.id, curDate, true);
      ps.seed = (ps.seed || 0) + 1;
      ps.chosen = {}; Object.keys(ps.picks).forEach(function (k) { if (!ps.locks[k]) delete ps.picks[k]; });
      ps.confirmed = false;
      App.save(); renderDay();
      App.toast('換了一套');
      return;
    }
    if (t.closest('[data-of-confirm]')) {
      var n = confirm(curTrip.id, curDate);
      App.toast(n ? '已確定這套，加了 ' + n + ' 件到打包清單' : '已確定這套');
      renderDay();
      return;
    }
    if (t.closest('[data-of-drop]')) {
      var sm = summary(curTrip, planTrip(curTrip));
      if (!sm.unused.length || !window.confirm('要把這 ' + sm.unused.length + ' 件從打包清單移除嗎？\n' + sm.unused.map(function (m) { return m.name; }).join('、'))) return;
      var k = window.Packing.removeFromTrip(curTrip, sm.unused.map(function (m) { return m.id; }));
      App.save(); renderList();
      App.toast('已從打包清單移除 ' + k + ' 件');
      return;
    }
    if ((el = t.closest('[data-of-add]'))) {
      var m = App.entryById(el.getAttribute('data-of-add'));
      if (m) { window.Packing.addToTrip(curTrip, m); App.save(); renderList(); App.toast('已加入打包清單：' + m.name); }
      return;
    }
  });

  // 範例剛建好、或資料從雲端回來：目前在每日穿搭就重畫一次
  function refresh() {
    if (location.hash.indexOf('#outfit') !== 0) return;
    var parts = location.hash.slice(1).split('/');
    show(decodeURIComponent(parts[1] || ''), decodeURIComponent(parts[2] || ''));
  }

  window.Outfit = { show: show, refresh: refresh, setActs: setActs, confirm: confirm, tripDays: tripDays, planTrip: planTrip, summary: summary, ACTS: ACTS };
})();
