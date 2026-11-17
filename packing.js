/*
 * 打包清單：選一趟旅程 → 自動產生要帶的清單，分成隨身小包、背包、手提、托運四區
 *
 * 資料存在 state.packLists（每趟旅程一份，id＝旅程 id）：
 *   { id, zones: { pouch: { on, bagId }, personal: {…}, carry: {…}, checked: {…} },
 *   zones 就是「這趟每種行李用哪個行李箱」，首頁「我的行李」和這裡共用；
 *   還沒選行李箱時 bagId 是「尚未選擇」的占位行李（App.autoBag，空箱算 0）
 *     seasons[], activities[], entries[], createdAt, updatedAt }
 *   entries：{ id, key, catalogId, name, weight(每單位 kg), qty, unit, category,
 *              zone(carry／checked／personal), status(take 要帶／home 家裡已有／removed 已刪除),
 *              checked(已收好), itemId(打勾後對應首頁行李清單 state.items 的 id), carryOnly, source }
 *
 * 行李箱本身用 state.bags（{ id, name, kind, limit, tare }），每一區對應一個行李箱；
 * 之後做完整的行李箱設定頁時，直接在 state.bags 上加欄位（品牌、尺寸、照片…）即可。
 *
 * 打勾＝真的放進行李：會在 state.items 加一筆，衣物的位置同時變成「在行李裡」。
 */
(function () {
  'use strict';

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;
  var norm = App.norm;

  var ZONES = [['pouch', '隨身小包'], ['personal', '背包'], ['carry', '手提'], ['checked', '托運']];
  function zoneName(z) { return (ZONES.find(function (x) { return x[0] === z; }) || [, ''])[1]; }

  // 每趟都要提醒的東西
  var MUST = [
    { key: '護照', kw: ['護照', 'passport'] },
    { key: '錢包', kw: ['錢包', '皮夾'] },
    { key: '充電線', kw: ['充電線', '傳輸線', '充電器'] }
  ];
  // 最貼身、最常拿的：新產生的清單預設放隨身小包
  var POUCH = ['護照', 'passport', '錢包', '皮夾', '手機', 'iphone', '簽證'];
  // 只能手提（不能託運或不該託運）
  var CARRY_ONLY = ['護照', '簽證', '證件', '現金', '錢包', '皮夾', '信用卡', '行動電源', '行充', '充電寶', '筆電', '電腦',
    'macbook', 'laptop', '手機', 'iphone', 'ipad', '平板', '相機', '鑰匙', '藥'];
  // 當地容易買到
  var EASY_BUY = ['牙刷', '牙膏', '洗髮', '潤髮', '沐浴', '洗面', '毛巾', '雨傘', '零食', '泡麵', '口罩', '面膜', '防曬',
    '分裝瓶', '拖鞋', '刮鬍刀', '乳液', '餅乾', '襪子', '衛生紙', '濕紙巾'];
  // 活動：kw 用來比對物品名稱，uses 對應鞋子的「用途」，styles 對應衣服的「風格」
  var ACTS = [
    { name: '騎馬', kw: ['騎馬', '馬術', '馬靴', '馬褲', '頭盔'], uses: ['騎馬'] },
    { name: '網球', kw: ['網球', '球拍'], uses: ['網球'] },
    { name: '游泳', kw: ['泳', '蛙鏡'], uses: [] },
    { name: '登山健行', kw: ['登山', '健行'], uses: ['登山'] },
    { name: '跑步', kw: ['跑步', '跑鞋', '慢跑'], uses: ['跑步'] },
    { name: '正式場合', kw: ['西裝', '領帶', '禮服'], uses: ['正式'], styles: ['正式'] },
    { name: '雨天', kw: ['雨衣', '雨靴', '雨鞋'], uses: ['雨天'] }
  ];
  var SEASONS = ['春', '夏', '秋', '冬'];
  var TROPICAL = ['曼谷', 'bangkok', 'bkk', '泰國', '普吉', '清邁', '新加坡', 'singapore', '吉隆坡', '峇里', '巴里', '胡志明',
    '馬尼拉', '宿霧', '雅加達', '金邊', '關島', '夏威夷', '杜拜'];
  var SOUTH = ['雪梨', '悉尼', '墨爾本', '布里斯本', '伯斯', '澳洲', '紐西蘭', '奧克蘭', '基督城', '皇后鎮', '開普敦', '布宜諾斯'];

  function st() { return App.state(); }
  function has(text, list) { var q = norm(text); return list.some(function (k) { return q.indexOf(norm(k)) >= 0; }); }
  function fmt(n) { var r = Math.round(n * 10) / 10; return (Object.is(r, -0) ? 0 : r).toFixed(1); }
  function level(remain, limit) { return limit == null ? 'none' : remain < 0 ? 'bad' : (limit > 0 && remain / limit < 0.2 ? 'warn' : 'ok'); }
  function touch(list) { list.updatedAt = Date.now(); }

  // ---------- 旅程資訊 ----------
  function tripById(id) { return st().trips.find(function (t) { return t.id === id; }); }

  function seasonOf(city, date) {
    if (has(city || '', TROPICAL)) return '夏';
    var m = date ? +date.split('-')[1] : new Date().getMonth() + 1;
    var s = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
    if (has(city || '', SOUTH)) s = { '春': '秋', '夏': '冬', '秋': '春', '冬': '夏' }[s];
    return s;
  }

  function tripSeasons(t) {
    var out = [];
    var end = window.Trips.endHomeOf(t);
    t.legs.forEach(function (l, i) {
      // 最後一段是回家，不算目的地
      if (i === t.legs.length - 1 && t.legs.length > 1 && end && window.Trips.homeFor(l.to) === end) return;
      var s = seasonOf(l.to, l.date);
      if (out.indexOf(s) < 0) out.push(s);
    });
    return out.length ? out : [seasonOf(t.origin, '')];
  }

  function guessActs(t) {
    var text = t.name + ' ' + t.legs.map(function (l) { return (l.connection || {}).note || ''; }).join(' ');
    return ACTS.filter(function (a) { return has(text, [a.name].concat(a.kw)); }).map(function (a) { return a.name; });
  }

  // 途經、目的地有哪些家（不含出發的家）
  function routeHomes(t) {
    var T = window.Trips, out = [];
    var origin = T.homeFor(t.origin);
    t.legs.forEach(function (l, i) {
      var h = (l.connection || {}).mode === 'transit' && i < t.legs.length - 1 ? null : T.homeFor(l.to);
      if (h && h !== origin && out.indexOf(h) < 0) out.push(h);
    });
    var end = T.endHomeOf(t);
    if (end && end !== origin && out.indexOf(end) < 0) out.push(end);
    return { origin: origin, homes: out };
  }

  // 這趟用哪一段的額度：這趟旅程接下來最近的一段（都過了就用第一段）
  function legFor(t) {
    var today = App.todayStr();
    var up = t.legs.filter(function (l) { return l.date && l.date >= today; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    return up[0] || t.legs[0] || null;
  }

  // ---------- 清單 ----------
  function lists() { return st().packLists; }
  function listFor(tripId) {
    var l = lists().find(function (x) { return x.id === tripId; });
    if (l) fixZones(l);
    return l;
  }
  // 舊清單補上隨身小包；啟用中但沒有行李箱的區，用「尚未選擇行李箱」
  function fixZones(l) {
    if (!l.zones) l.zones = {};
    ZONES.forEach(function (z) {
      var c = l.zones[z[0]];
      if (!c) c = l.zones[z[0]] = { on: z[0] === 'pouch', bagId: null };
      if (c.on && !(c.bagId && App.bagById(c.bagId))) c.bagId = App.autoBag(z[0]).id;
    });
  }

  // 這類行李箱：已經放了東西的排最前面（你正在用的箱子），再來是出發地那個家的
  function bagsOfKind(kind, originHome) {
    function used(b) { return st().items.some(function (it) { return it.bagId === b.id; }) ? 1 : 0; }
    return st().bags.filter(function (b) { return b.kind === kind && !b.auto; }).sort(function (a, b) {
      return used(b) - used(a) || (b.home === originHome ? 1 : 0) - (a.home === originHome ? 1 : 0);
    });
  }
  function originOf(list) {
    var t = tripById(list.id);
    return t && window.Trips ? window.Trips.homeFor(t.origin) : '';
  }
  function firstBag(kind, originHome) { return bagsOfKind(kind, originHome)[0]; }

  // quiet：只建立「這趟用哪些行李箱」（首頁選行李箱時），建議的物品等第一次打開打包清單再產生
  function ensureList(t, quiet) {
    var list = listFor(t.id);
    if (list) return list;
    var zones = {};
    var origin = window.Trips ? window.Trips.homeFor(t.origin) : '';
    var leg = t.legs[0];
    // 預設：隨身小包一定帶；其他種類有自己的行李箱、或航班有這項額度就帶。
    // 行李箱不自動幫你選（除非已經有箱子放了東西），先顯示「尚未選擇行李箱」
    ZONES.forEach(function (z) {
      var k = z[0];
      var mine = bagsOfKind(k, origin);
      var inUse = mine.find(function (b) { return st().items.some(function (it) { return it.bagId === b.id; }); });
      var a = leg ? App.allowanceOf(leg, App.groupOf(k, t) || k) : null;
      var on = k === 'pouch' || !!inUse || mine.length > 0 || (a != null && a > 0);
      zones[k] = { on: on, bagId: (inUse || App.autoBag(k)).id };
    });
    list = { id: t.id, zones: zones, seasons: Array.isArray(t.seasons) ? t.seasons.slice() : tripSeasons(t),
      activities: Array.isArray(t.activities) ? t.activities.slice() : guessActs(t), entries: [], createdAt: Date.now(), updatedAt: Date.now() };
    lists().push(list);
    if (quiet) list.needsGenerate = true;
    else generate(list, t);
    App.save();
    return list;
  }

  function setZone(list, z, on) {
    var cfg = list.zones[z];
    if (on && !(cfg.bagId && App.bagById(cfg.bagId))) cfg.bagId = App.autoBag(z).id;   // 尚未選擇行李箱
    cfg.on = on;
  }

  function activeZones(list) {
    return ZONES.map(function (z) { return z[0]; }).filter(function (z) {
      var c = list.zones[z];
      return c && c.on && c.bagId && App.bagById(c.bagId);
    });
  }

  function defaultZone(list, e) {
    var act = activeZones(list);
    var order = has(e.name, POUCH) ? ['pouch', 'personal', 'carry', 'checked']
      : e.carryOnly ? ['carry', 'personal', 'pouch', 'checked']
      : e.category === '電線電器' ? ['carry', 'personal', 'checked', 'pouch'] : ['checked', 'carry', 'personal', 'pouch'];
    return order.find(function (z) { return act.indexOf(z) >= 0; }) || act[0] || 'carry';
  }

  function zoneOfBag(list, bagId) {
    var act = activeZones(list);
    var z = act.find(function (k) { return list.zones[k].bagId === bagId; });
    if (z) return z;
    var b = App.bagById(bagId);
    return b && act.indexOf(b.kind) >= 0 ? b.kind : null;
  }

  function mkEntry(o) {
    return Object.assign({
      id: App.uid(), key: '', catalogId: null, name: '', weight: 0, qty: 1, unit: '個', category: '必備品',
      zone: 'carry', status: 'take', checked: false, itemId: null, carryOnly: false, source: 'auto'
    }, o);
  }

  function fromCatalog(m, source) {
    return mkEntry({
      key: 'c:' + m.id, catalogId: m.id, name: m.name, weight: m.weight || 0, unit: m.unit || '個',
      category: m.category || '必備品', carryOnly: has(m.name, CARRY_ONLY), source: source || 'auto'
    });
  }

  // 衣物適不適合這趟（季節、活動）
  function clothFits(m, list) {
    var c = m.clothing;
    var sel = ACTS.filter(function (a) { return list.activities.indexOf(a.name) >= 0; });
    var unsel = ACTS.filter(function (a) { return list.activities.indexOf(a.name) < 0; });
    if (sel.some(function (a) { return has(m.name, a.kw); })) return true;          // 這趟活動的裝備
    if (unsel.some(function (a) { return has(m.name, a.kw); })) return false;       // 別的活動的裝備
    var uses = c.uses || [];
    var special = ['騎馬', '網球', '登山', '跑步', '雨天'];
    var selUses = [].concat.apply([], sel.map(function (a) { return a.uses; }));
    if (uses.length && uses.every(function (u) { return special.indexOf(u) >= 0; }) &&
        !uses.some(function (u) { return selUses.indexOf(u) >= 0; })) return false;  // 專用鞋，這趟沒有那個活動
    if (uses.some(function (u) { return selUses.indexOf(u) >= 0; })) return true;
    var seasons = c.seasons || [];
    return !seasons.length || seasons.some(function (s) { return list.seasons.indexOf(s) >= 0; });
  }

  // 依旅程產生建議（只加上清單裡還沒有的；被刪掉的不會再加回來）
  function generate(list, t) {
    var have = {};
    list.entries.forEach(function (e) { have[e.key] = true; });
    var rh = routeHomes(t);
    var added = 0;
    function add(e) {
      if (have[e.key]) return;
      have[e.key] = true;
      if (e.status === 'take') e.zone = defaultZone(list, e);
      list.entries.push(e);
      added++;
    }
    var sel = ACTS.filter(function (a) { return list.activities.indexOf(a.name) >= 0; });

    st().memory.forEach(function (m) {
      if (App.isCloth(m)) {
        if (!clothFits(m, list)) return;
        var loc = App.locOf(m);
        var e = fromCatalog(m);
        if (loc.state === 'home' && rh.homes.indexOf(loc.home) >= 0) e.status = 'home';   // 目的地的家已經有
        else if (loc.state === 'home' && rh.origin && loc.home !== rh.origin) return;      // 放在別的家，這趟帶不到
        add(e);
      } else if (m.category === '特殊類') {
        if (sel.some(function (a) { return has(m.name, a.kw); })) add(fromCatalog(m));
      } else if ((m.uses || 0) >= 2) {
        add(fromCatalog(m));
      }
    });

    // 每趟必帶：護照、錢包、充電線、睡衣
    MUST.forEach(function (mu) {
      var inList = list.entries.some(function (e) { return e.status !== 'removed' && has(e.name, mu.kw); });
      if (inList || have['must:' + mu.key]) return;
      var m = st().memory.find(function (x) { return !App.isCloth(x) && has(x.name, mu.kw); });
      if (m && !have['c:' + m.id]) { var e = fromCatalog(m, 'must'); add(e); return; }
      if (m) return;
      var ref = App.findRef(mu.key);
      add(mkEntry({ key: 'must:' + mu.key, name: mu.key, weight: ref ? ref.weight : 0.1,
        category: ref ? ref.category : '必備品', carryOnly: has(mu.key, CARRY_ONLY), source: 'must' }));
    });
    var isSleep = function (e) {
      var m = e.catalogId && App.entryById(e.catalogId);
      return (m && m.clothing && m.clothing.group === '睡衣') || e.key === 'must:睡衣';
    };
    if (!list.entries.some(isSleep)) {
      var pj = st().memory.find(function (m) {
        if (!(m.clothing && m.clothing.group === '睡衣')) return false;
        var loc = App.locOf(m);
        return !(loc.state === 'home' && rh.origin && loc.home !== rh.origin);
      });
      if (pj) add(fromCatalog(pj, 'must'));
      else add(mkEntry({ key: 'must:睡衣', name: '睡衣', weight: 0.35, unit: '套', source: 'must' }));
    }
    touch(list);
    return added;
  }

  // 讓清單和首頁的行李清單一致：
  //   行李裡有、清單上沒打勾的 → 打勾；清單上打勾、行李裡已經拿掉的 → 取消打勾
  function reconcile(list) {
    var changed = false;
    var items = st().items;
    var byItem = {};
    // 從行李帶進來的項目（例如禮物、旅途中買的），行李裡沒有了就一起拿掉，不再算成「還沒收」
    list.entries = list.entries.filter(function (e) {
      if (e.checked && e.source === 'bag' && !items.some(function (it) { return it.id === e.itemId; })) { changed = true; return false; }
      return true;
    });
    list.entries.forEach(function (e) {
      if (e.checked && !items.some(function (it) { return it.id === e.itemId; })) {
        e.checked = false; e.itemId = null; changed = true;
      }
      if (e.itemId) byItem[e.itemId] = e;
      // 衣櫃、抽屜裡改過名稱或重量：清單跟著用最新的（同一樣東西只有一個重量）
      var m = e.catalogId && App.entryById(e.catalogId);
      if (m && (e.name !== m.name || e.weight !== m.weight)) { e.name = m.name; e.weight = m.weight; changed = true; }
    });
    items.forEach(function (it) {
      if (byItem[it.id]) {
        var z0 = zoneOfBag(list, it.bagId);
        if (z0 && byItem[it.id].zone !== z0) { byItem[it.id].zone = z0; changed = true; }
        return;
      }
      var z = zoneOfBag(list, it.bagId);
      if (!z) return;   // 放在這趟沒用到的行李箱
      var e = it.catalogId && list.entries.find(function (x) { return x.catalogId === it.catalogId && !x.checked; });
      if (!e) {
        e = mkEntry({ key: it.catalogId ? 'c:' + it.catalogId + ':' + it.id : 'i:' + it.id, catalogId: it.catalogId || null,
          name: it.name, weight: it.weight, qty: it.qty, unit: it.unit, category: it.category,
          carryOnly: has(it.name, CARRY_ONLY), source: 'bag' });
        if (it.giftId) e.giftId = it.giftId;
        if (it.purchaseId) e.purchaseId = it.purchaseId;
        list.entries.push(e);
      }
      e.status = 'take'; e.zone = z; e.checked = true; e.itemId = it.id;
      changed = true;
    });
    if (changed) touch(list);
    return changed;
  }

  // ---------- 打勾、移動、刪除 ----------
  function setChecked(list, e, on) {
    var s = st();
    var m = e.catalogId && App.entryById(e.catalogId);
    if (on && !e.checked) {
      var bagId = list.zones[e.zone].bagId;
      if (m) App.markPacked(m, bagId);
      var it = { id: App.uid(), name: e.name, weight: e.weight, qty: e.qty, unit: e.unit, category: e.category, bagId: bagId, catalogId: e.catalogId || undefined };
      if (e.giftId) it.giftId = e.giftId;
      if (e.purchaseId) it.purchaseId = e.purchaseId;
      s.items.push(it);
      if (m) m.uses = (m.uses || 0) + 1;
      e.checked = true; e.itemId = it.id;
    } else if (!on && e.checked) {
      var id = e.itemId;
      e.checked = false; e.itemId = null;
      s.items = s.items.filter(function (x) { return x.id !== id; });
      if (m) App.restoreHome(m);   // 位置回到原本的家
    }
    touch(list);
  }

  function moveEntry(list, e, z) {
    if (e.zone === z && e.status === 'take') return;
    e.zone = z; e.status = 'take';
    if (e.checked) {
      var bagId = list.zones[z].bagId;
      var it = st().items.find(function (x) { return x.id === e.itemId; });
      if (it) it.bagId = bagId;
      var m = e.catalogId && App.entryById(e.catalogId);
      if (m) App.markPacked(m, bagId);
    }
    touch(list);
  }

  function removeEntry(list, e) {
    if (e.checked) setChecked(list, e, false);
    if (e.source === 'manual' || e.source === 'bag') list.entries = list.entries.filter(function (x) { return x !== e; });
    else e.status = 'removed';   // 建議的項目記成「已刪除」，重新產生時不會再跑出來
    touch(list);
  }

  // ---------- 重量 ----------
  // 依額度分組的重量（例如背包＋隨身小包一起比）：{ key, label, weight, limit(null＝尚未設定額度), tare, level }
  function groupLabel(key, kinds) {
    if (key === 'personal' && kinds.indexOf('pouch') >= 0) return kinds.indexOf('personal') >= 0 ? '背包＋隨身小包' : '隨身小包（算在背包額度）';
    return zoneName(key);
  }
  function zoneStats(list, t) {
    var leg = t ? legFor(t) : null;
    var groups = {}, order = [];
    activeZones(list).forEach(function (z) {
      var bag = App.bagById(list.zones[z].bagId);
      var tare = bag.auto ? 0 : Number(bag.tare) || 0;
      var w = tare;
      list.entries.forEach(function (e) { if (e.status === 'take' && e.zone === z) w += e.weight * e.qty; });
      var g = App.groupOf(z, t);
      if (!g) return;   // 隨身小包不計算
      if (!groups[g]) { groups[g] = { key: g, kinds: [], weight: 0, tare: 0, limit: leg ? App.allowanceOf(leg, g) : null }; order.push(g); }
      groups[g].kinds.push(z); groups[g].weight += w; groups[g].tare += tare;
    });
    return order.map(function (g) {
      var x = groups[g];
      x.label = groupLabel(g, x.kinds);
      x.level = level(x.limit == null ? 0 : x.limit - x.weight, x.limit);
      return x;
    });
  }

  // 給首頁用：下一趟旅程的清單上「要帶但還沒收好」的重量（依行李箱）
  // 打包清單上還沒收的東西只在出發前算進重量（出發後沒帶的就是沒帶）
  function pendingByBag() {
    var next = App.nextLeg();
    var list = next && next.index === 0 && listFor(next.trip.id);
    var out = {};
    if (!list) return out;
    reconcile(list);
    var act = activeZones(list);
    list.entries.forEach(function (e) {
      if (e.status !== 'take' || e.checked || act.indexOf(e.zone) < 0) return;
      var id = list.zones[e.zone].bagId;
      if (!out[id]) out[id] = { weight: 0, count: 0 };
      out[id].weight += e.weight * e.qty;
      out[id].count++;
    });
    return out;
  }

  // ---------- 畫面 ----------
  var curTrip = null, curList = null;

  function sortedTrips() {
    return st().trips.slice().sort(function (a, b) {
      var da = a.legs.map(function (l) { return l.date; }).filter(Boolean).sort()[0] || '9999';
      var db = b.legs.map(function (l) { return l.date; }).filter(Boolean).sort()[0] || '9999';
      return da.localeCompare(db);
    });
  }

  function show() {
    var trips = sortedTrips();
    $('#pack-empty').hidden = trips.length > 0;
    $('#pack-main').hidden = !trips.length;
    if (!trips.length) return;
    var saved = null;
    try { saved = localStorage.getItem('luggage-pack-trip'); } catch (e) { /* 不影響 */ }
    var next = App.nextLeg();
    var t = tripById(curTrip && curTrip.id) || tripById(saved) || (next && next.trip) || trips[0];
    $('#pack-trip').innerHTML = trips.map(function (x) {
      var d = x.legs.map(function (l) { return l.date; }).filter(Boolean).sort()[0];
      return '<option value="' + esc(x.id) + '"' + (x.id === t.id ? ' selected' : '') + '>' + esc(x.name) +
        (d ? '（' + window.Trips.fmtDate(d) + '）' : '') + '</option>';
    }).join('');
    open(t);
  }

  function open(t) {
    curTrip = t;
    try { localStorage.setItem('luggage-pack-trip', t.id); } catch (e) { /* 不影響 */ }
    curList = ensureList(t);
    if (curList.needsGenerate) { delete curList.needsGenerate; generate(curList, t); App.save(); }
    syncTripSettings(t, curList);
    if (reconcile(curList)) App.save();
    render();
  }

  // 範例資料用：產生清單、選好行李箱、把幾樣先打勾（和真的操作走同一套流程）
  // addNames：另外用「＋ 加入」加進清單的東西（衣櫃／抽屜裡的名稱）
  function prepareTrip(t, zones, checkNames, addNames) {
    var list = ensureList(t);
    if (list.needsGenerate) { delete list.needsGenerate; generate(list, t); }
    syncTripSettings(t, list);
    Object.keys(zones).forEach(function (k) { setTripZone(t, k, zones[k]); });
    (addNames || []).forEach(function (name) {
      var m = st().memory.find(function (x) { return x.name === name; });
      if (m) addToList(list, m);
    });
    reconcile(list);
    list.entries.forEach(function (e) {
      if (e.status === 'take' && !e.checked && checkNames.indexOf(e.name) >= 0) setChecked(list, e, true);
    });
    touch(list);
    App.save();
    return list;
  }

  // 季節與活動在行程裡設定；行程改了，打包清單自動補上需要的物品
  function syncTripSettings(t, list) {
    if (!Array.isArray(t.seasons)) t.seasons = (list.seasons || tripSeasons(t)).slice();      // 舊資料：沿用清單上的設定
    if (!Array.isArray(t.activities)) t.activities = (list.activities || guessActs(t)).slice();
    var same = JSON.stringify(list.seasons) === JSON.stringify(t.seasons) && JSON.stringify(list.activities) === JSON.stringify(t.activities);
    if (same) return;
    list.seasons = t.seasons.slice();
    list.activities = t.activities.slice();
    var n = generate(list, t);
    touch(list);
    App.save();
    if (n) App.toast('依行程補上了 ' + n + ' 項需要的物品');
  }

  function thumb(e) {
    var m = e.catalogId && App.entryById(e.catalogId);
    return m && m.photoId ? '<img class="org-thumb" data-photo="' + esc(m.photoId) + '" alt="">' : '';
  }

  // 每個物品只顯示：打勾框、品名、重量；點品名可以移到別區或刪除
  function rowHTML(e) {
    return '<div class="pk-row pk-simple' + (e.checked ? ' done' : '') + '" data-e="' + esc(e.id) + '">' +
      '<button type="button" class="pk-check" data-check="' + esc(e.id) + '" aria-label="' + (e.checked ? '取消收好' : '收好了') + '">' + (e.checked ? '✓' : '') + '</button>' +
      '<button type="button" class="pk-name" data-row="' + esc(e.id) + '">' + esc(e.name) + (e.qty > 1 ? ' × ' + e.qty : '') + '</button>' +
      '<span class="pk-w-item">' + esc(App.fmtWeight(e.weight * e.qty)) + '</span></div>';
  }

  function render() {
    var list = curList;
    // 只有一趟旅程時不顯示選旅程
    $('#pack-trip-wrap').hidden = st().trips.length < 2;
    renderRemain();

    // 依隨身小包、背包、手提、托運分組；打勾的變淡、排到該組最下面
    var act = activeZones(list);
    $('#pack-zones').innerHTML = act.map(function (z) {
      var rows = list.entries.filter(function (e) { return e.status === 'take' && e.zone === z; })
        .sort(function (a, b) { return (a.checked ? 1 : 0) - (b.checked ? 1 : 0); });
      if (!rows.length) return '';
      return '<div class="pk-zone" data-zone="' + z + '">' +
        '<div class="pk-zone-head"><b>' + zoneName(z) + '</b></div>' +
        rows.map(rowHTML).join('') + '</div>';
    }).join('') || '<p class="muted small">清單是空的。點「＋ 新增」從衣櫃、抽屜挑，或直接輸入。</p>';

    var home = list.entries.filter(function (e) { return e.status === 'home'; });
    $('#pack-home-wrap').hidden = !home.length;
    $('#pack-home').innerHTML = home.map(function (e) {
      return '<button type="button" class="pk-row pk-simple gray" data-take="' + esc(e.id) + '" aria-label="改成要帶：' + esc(e.name) + '">' +
        '<span class="pk-name">' + esc(e.name) + '</span><span class="pk-w-item">' + esc(App.fmtWeight(e.weight * e.qty)) + '</span></button>';
    }).join('');
  }

  // 最上方一行：還能放幾公斤（和首頁旅程卡的剩餘公斤數同一個計算；打勾就扣、取消打勾就加回來）
  function renderRemain() {
    var r = App.tripRemain(curTrip);
    var el = $('#pack-remain');
    var lv = r.remain == null ? 'none' : level(r.remain, r.limit);
    el.className = 'pk-remain ' + lv;
    $('#pack-remain-num').textContent = r.remain == null ? '—' : fmt(r.remain);
    if (window.UI) window.UI.roll($('#pack-remain-num'), 'pack:' + curTrip.id);   // 打勾後數字平滑滾動
    el.title = r.remain == null ? '這趟還沒設定額度' : '';
  }

  function entryById(id) { return curList.entries.find(function (e) { return e.id === id; }); }
  function commit() { App.save(); render(); }

  // ---------- 操作 ----------
  $('#pack-trip').addEventListener('change', function () { var t = tripById(this.value); if (t) open(t); });

  $('#view-pack').addEventListener('click', function (ev) {
    if (!curList) return;
    var t = ev.target, el;
    if ((el = t.closest('[data-check]'))) {
      var e = entryById(el.getAttribute('data-check'));
      setChecked(curList, e, !e.checked);
      commit();
      if (e.checked && window.UI) window.UI.pop(document.querySelector('#view-pack [data-check="' + e.id + '"]'));   // 打勾的小動畫
      return;
    }
    if ((el = t.closest('[data-row]'))) { openMove(entryById(el.getAttribute('data-row'))); return; }
    if ((el = t.closest('[data-remove]'))) {
      var e2 = entryById(el.getAttribute('data-remove'));
      if (e2.checked && !confirm('「' + e2.name + '」已經收好了，要從清單刪除並從行李拿出來嗎？')) return;
      removeEntry(curList, e2);
      commit();
      return;
    }
    if ((el = t.closest('[data-take]'))) {
      var e3 = entryById(el.getAttribute('data-take'));
      e3.status = 'take'; e3.zone = defaultZone(curList, e3); touch(curList);
      App.toast('已改成要帶：' + e3.name);
      commit();
      return;
    }
    if ((el = t.closest('[data-zone-toggle]'))) {
      var z = el.getAttribute('data-zone-toggle');
      var on = !(curList.zones[z].on && App.bagById(curList.zones[z].bagId));
      var msg = setTripZone(curTrip, z, on ? (curList.zones[z].bagId || App.autoBag(z).id) : 'off');
      if (msg) { App.toast(msg); return; }
      render();
      return;
    }
    if ((el = t.closest('[data-season]'))) { toggle(curList.seasons, el.getAttribute('data-season')); touch(curList); commit(); return; }
    if ((el = t.closest('[data-act]'))) { toggle(curList.activities, el.getAttribute('data-act')); touch(curList); commit(); return; }
    if (t.id === 'pack-regen') {
      var n = generate(curList, curTrip);
      App.toast(n ? '新增了 ' + n + ' 項建議' : '沒有新的建議');
      commit();
      return;
    }
    if (t.id === 'pack-add') { openAdd(); return; }
    if (t.id === 'pack-check') { openCheck(); return; }
  });

  function toggle(arr, v) { var i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }


  // ---------- 拖曳到別區（按住 ⠿ 拖；只點一下則跳出選單） ----------
  var drag = null;
  $('#view-pack').addEventListener('pointerdown', function (ev) {
    var h = ev.target.closest('[data-handle]');
    if (!h || !curList) return;
    ev.preventDefault();
    drag = { id: h.getAttribute('data-handle'), x: ev.clientX, y: ev.clientY, moved: false, ghost: null, pid: ev.pointerId, handle: h };
    try { h.setPointerCapture(ev.pointerId); } catch (e) { /* 不支援就算了 */ }
  });
  document.addEventListener('pointermove', function (ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    if (!drag.moved && Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 8) return;
    if (!drag.moved) {
      drag.moved = true;
      var e = entryById(drag.id);
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'pk-ghost';
      drag.ghost.textContent = e ? e.name : '';
      document.body.appendChild(drag.ghost);
      document.body.classList.add('pk-dragging');
    }
    drag.ghost.style.left = ev.clientX + 'px';
    drag.ghost.style.top = ev.clientY + 'px';
    if (ev.clientY < 90) window.scrollBy(0, -14);
    else if (ev.clientY > window.innerHeight - 150) window.scrollBy(0, 14);
    var over = zoneAt(ev.clientX, ev.clientY);
    document.querySelectorAll('.pk-zone').forEach(function (z) { z.classList.toggle('over', z === over); });
  });
  function zoneAt(x, y) {
    var el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest('.pk-zone') : null;
  }
  function endDrag(ev, cancel) {
    if (!drag || (ev && ev.pointerId !== drag.pid)) return;
    var d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    document.body.classList.remove('pk-dragging');
    document.querySelectorAll('.pk-zone.over').forEach(function (z) { z.classList.remove('over'); });
    if (cancel) return;
    var e = entryById(d.id);
    if (!e) return;
    if (!d.moved) { openMove(e); return; }
    var over = zoneAt(ev.clientX, ev.clientY);
    if (over) tryMove(e, over.getAttribute('data-zone'));
  }
  document.addEventListener('pointerup', function (ev) { endDrag(ev, false); });
  document.addEventListener('pointercancel', function (ev) { endDrag(ev, true); });

  function tryMove(e, z) {
    if (e.zone === z) return;
    if (e.carryOnly && z === 'checked' && !confirm('「' + e.name + '」標記為只能手提，確定要放到托運嗎？')) return;
    moveEntry(curList, e, z);
    App.toast('已移到' + zoneName(z) + '：' + e.name);
    commit();
  }

  var moveTarget = null;
  function openMove(e) {
    moveTarget = e;
    $('#pk-move-title').textContent = '「' + e.name + '」';
    $('#pk-move-list').innerHTML = activeZones(curList).map(function (z) {
      return '<button type="button" class="btn ghost sheet-bag' + (z === e.zone ? ' cur' : '') + '" data-move-zone="' + z + '">' +
        (z === e.zone ? '放在' + zoneName(z) + '（目前）' : '移到' + zoneName(z)) + '</button>';
    }).join('') + '<button type="button" class="btn danger" data-move-remove="1">從清單刪除</button>';
    $('#pk-move-sheet').hidden = false;
  }
  $('#pk-move-sheet').addEventListener('click', function (ev) {
    if (ev.target.closest('[data-move-remove]') && moveTarget) {
      var er = moveTarget;
      $('#pk-move-sheet').hidden = true; moveTarget = null;
      if (er.checked && !confirm('「' + er.name + '」已經收好了，要從清單刪除並從行李拿出來嗎？')) return;
      removeEntry(curList, er); commit();
      return;
    }
    var b = ev.target.closest('[data-move-zone]');
    if (b && moveTarget) { var e = moveTarget; $('#pk-move-sheet').hidden = true; moveTarget = null; tryMove(e, b.getAttribute('data-move-zone')); return; }
    if (ev.target.id === 'pk-move-sheet' || ev.target.id === 'pk-move-cancel') { $('#pk-move-sheet').hidden = true; moveTarget = null; }
  });

  // ---------- 手動新增 ----------
  function openAdd() {
    if (!curList || $('#pack-main').hidden) return;
    $('#pk-add-name').value = ''; $('#pk-add-weight').value = ''; $('#pk-add-qty').value = 1; $('#pk-add-only').checked = false;
    $('#pk-add-zone').innerHTML = activeZones(curList).map(function (z) { return '<option value="' + z + '">' + zoneName(z) + '</option>'; }).join('');
    var names = [];
    st().memory.forEach(function (m) { if (names.indexOf(m.name) < 0) names.push(m.name); });
    (window.REFERENCE_WEIGHTS || []).forEach(function (r) { if (names.indexOf(r.name) < 0) names.push(r.name); });
    $('#pk-add-names').innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
    $('#pk-add-search').value = '';
    setAddTab('closet');
    $('#pk-add-sheet').hidden = false;
  }

  // ＋ 新增：從衣櫃挑／從抽屜挑／直接輸入
  var addTab = 'closet';
  function setAddTab(tab) {
    addTab = tab;
    Array.prototype.forEach.call(document.querySelectorAll('[data-pk-tab]'), function (b) { b.classList.toggle('on', b.getAttribute('data-pk-tab') === tab); });
    var input = tab === 'input';
    $('#pk-add-pick').hidden = input;
    $('#pk-add-input').hidden = !input;
    $('#pk-add-submit').hidden = !input;
    if (input) setTimeout(function () { $('#pk-add-name').focus(); }, 50);
    else renderPick();
  }
  function renderPick() {
    var q = norm($('#pk-add-search').value.trim());
    var inList = {};
    curList.entries.forEach(function (e) { if (e.catalogId && e.status === 'take') inList[e.catalogId] = true; });
    var list = st().memory.filter(function (m) {
      return (addTab === 'closet' ? App.isCloth(m) : !App.isCloth(m)) && (!q || norm(m.name).indexOf(q) >= 0);
    }).sort(function (a, b) { return (inList[a.id] ? 1 : 0) - (inList[b.id] ? 1 : 0) || a.name.localeCompare(b.name); });
    $('#pk-add-list').innerHTML = list.length ? list.map(function (m) {
      var loc = App.locOf(m);
      return '<button type="button" class="more-row' + (inList[m.id] ? ' in' : '') + '" data-pk-pick="' + esc(m.id) + '"' + (inList[m.id] ? ' disabled' : '') + '>' +
        '<span class="more-name">' + esc(m.name) + '<span class="muted small">' + esc(App.fmtWeight(m.weight || 0)) +
        (loc && loc.home ? '・' + esc(loc.home) : '') + '</span></span>' +
        '<span class="more-plus" aria-hidden="true">' + (inList[m.id] ? '✓' : '＋') + '</span></button>';
    }).join('') : '<p class="muted small">' + (addTab === 'closet' ? '衣櫃' : '抽屜') + '裡沒有符合的東西。</p>';
  }
  // 把衣櫃／抽屜的東西加進打包清單（「＋ 加入」和範例資料都用這裡）
  function addToList(list, m) {
    var e = list.entries.find(function (x) { return x.catalogId === m.id; });
    if (!e) { e = fromCatalog(m, 'manual'); list.entries.push(e); }
    e.status = 'take';
    e.zone = defaultZone(list, e);
    touch(list);
    return e;
  }

  // 新增衣服／抽屜物品時勾了「加入下一趟的打包清單」：加進那趟的清單，放在它預設的行李區
  function addToTrip(t, m) {
    if (!t || !m) return null;
    var list = ensureList(t);
    return addToList(list, m);
  }

  function pickToList(id) {
    var m = App.entryById(id);
    if (!m) return;
    var e = addToList(curList, m);
    App.save();
    render();
    renderPick();
    App.toast('已加入' + zoneName(e.zone) + '：' + m.name);
  }
  $('#pk-add-tabs').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-pk-tab]');
    if (b) setAddTab(b.getAttribute('data-pk-tab'));
  });
  $('#pk-add-search').addEventListener('input', renderPick);
  $('#pk-add-list').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-pk-pick]');
    if (b) pickToList(b.getAttribute('data-pk-pick'));
  });
  var addMatch = null;
  $('#pk-add-name').addEventListener('input', function () {
    var name = this.value.trim();
    addMatch = st().memory.find(function (m) { return norm(m.name) === norm(name); }) || null;
    var ref = addMatch ? null : App.findRef(name);
    var w = addMatch ? addMatch.weight : ref ? ref.weight : null;
    if (w != null) $('#pk-add-weight').value = Math.round(w * 1000);
    var only = has(name, CARRY_ONLY);
    $('#pk-add-only').checked = only;
    if (only && activeZones(curList).indexOf('carry') >= 0) $('#pk-add-zone').value = 'carry';
  });
  $('#pk-add-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = $('#pk-add-name').value.trim();
    if (!name) { App.toast('請輸入名稱'); return; }
    var g = parseFloat($('#pk-add-weight').value);
    var q = Math.max(1, parseInt($('#pk-add-qty').value, 10) || 1);
    var m = addMatch && norm(addMatch.name) === norm(name) ? addMatch : null;
    var ref = App.findRef(name);
    var old = m && curList.entries.find(function (x) { return x.catalogId === m.id && x.status !== 'take'; });
    var e = old || mkEntry({ key: m ? 'c:' + m.id + ':' + App.uid() : 'm:' + App.uid(), catalogId: m ? m.id : null, source: 'manual' });
    e.name = name;
    e.weight = isFinite(g) && g >= 0 ? g / 1000 : (m ? m.weight : ref ? ref.weight : 0);
    e.qty = q;
    e.unit = m ? m.unit || '個' : ref && ref.unit ? ref.unit : '個';
    e.category = m ? m.category : ref ? ref.category : '必備品';
    e.carryOnly = $('#pk-add-only').checked;
    e.zone = $('#pk-add-zone').value;
    e.status = 'take';
    if (!old) curList.entries.push(e);
    touch(curList);
    $('#pk-add-sheet').hidden = true;
    App.toast('已加入' + zoneName(e.zone) + '：' + name);
    commit();
  });
  $('#pk-add-sheet').addEventListener('click', function (ev) {
    if (ev.target.id === 'pk-add-sheet' || ev.target.id === 'pk-add-cancel') $('#pk-add-sheet').hidden = true;
  });

  // ---------- 出發前檢查 ----------
  function openCheck() {
    var list = curList;
    var act = activeZones(list);
    var take = list.entries.filter(function (e) { return e.status === 'take' && act.indexOf(e.zone) >= 0; });
    var todo = take.filter(function (e) { return !e.checked; });
    var inList = {};
    take.forEach(function (e) { if (e.catalogId) inList[e.catalogId] = true; });
    var homeIds = {};
    list.entries.forEach(function (e) { if (e.status === 'home' && e.catalogId) homeIds[e.catalogId] = true; });
    // 常帶（放過 2 次以上）但這次沒在清單上
    var missing = st().memory.filter(function (m) {
      return (m.uses || 0) >= 2 && !inList[m.id] && !homeIds[m.id] && !take.some(function (e) { return norm(e.name) === norm(m.name); });
    });
    var easy = todo.filter(function (e) { return has(e.name, EASY_BUY); });
    var over = zoneStats(list, curTrip).filter(function (s) { return s.level === 'bad'; });

    var html = '';
    // 護照、錢包：特別確認在隨身小包裡
    var pouchOn = act.indexOf('pouch') >= 0;
    var pw = [['護照', ['護照', 'passport']], ['錢包', ['錢包', '皮夾']]].map(function (x) {
      var e = take.find(function (y) { return has(y.name, x[1]); });
      if (!e) return '<div class="ck-row"><span>清單上沒有<b>' + x[0] + '</b></span>' +
        (pouchOn ? '<button type="button" class="link" data-ck-pouch-add="' + x[0] + '">加到隨身小包</button>' : '') + '</div>';
      if (e.zone !== 'pouch') return '<div class="ck-row"><span><b>' + esc(e.name) + '</b>不在隨身小包裡（現在在' + zoneName(e.zone) + '）</span>' +
        (pouchOn ? '<button type="button" class="link" data-ck-pouch="' + esc(e.id) + '">移到隨身小包</button>' : '') + '</div>';
      if (!e.checked) return '<div class="ck-row"><span><b>' + esc(e.name) + '</b>在隨身小包，但還沒收好</span>' +
        '<button type="button" class="link" data-ck-done="' + esc(e.id) + '">收好了</button></div>';
      return '';
    }).join('');
    html += '<div class="ck-block' + (pw ? ' bad' : '') + '"><b>隨身小包：護照、錢包</b>' +
      (!pouchOn ? '<div class="muted small">這趟沒有帶隨身小包，請確認護照和錢包放在身上拿得到的地方。</div>' : '') +
      (pw || '<div class="muted small">護照和錢包都收在隨身小包裡了。</div>') + '</div>';
    if (over.length) html += '<div class="ck-block bad"><b>⚠️ 超重</b>' + over.map(function (s) {
      return '<div>' + esc(s.label) + '超過 ' + fmt(s.weight - s.limit) + ' kg</div>'; }).join('') + '</div>';
    html += '<div class="ck-block"><b>還沒收好（' + todo.length + ' 件）</b>' +
      (todo.length ? todo.map(function (e) {
        return '<div class="ck-row"><span>' + esc(e.name) + ' <span class="muted small">' + zoneName(e.zone) + '</span>' +
          (has(e.name, EASY_BUY) ? ' <span class="pk-tag easy">當地容易買到</span>' : '') + '</span>' +
          '<button type="button" class="link" data-ck-done="' + esc(e.id) + '">收好了</button></div>';
      }).join('') : '<div class="muted small">全部都收好了 🎉</div>') + '</div>';
    html += '<div class="ck-block"><b>常帶但這次沒放進清單（' + missing.length + ' 件）</b>' +
      (missing.length ? missing.map(function (m) {
        return '<div class="ck-row"><span>' + esc(m.name) + '</span><button type="button" class="link" data-ck-add="' + esc(m.id) + '">加入清單</button></div>';
      }).join('') : '<div class="muted small">沒有漏掉常帶的東西</div>') + '</div>';
    if (easy.length) html += '<div class="ck-block"><b>當地容易買到，可以不用帶</b>' + easy.map(function (e) {
      return '<div class="ck-row"><span>' + esc(e.name) + '</span><button type="button" class="link" data-ck-drop="' + esc(e.id) + '">不帶了</button></div>';
    }).join('') + '</div>';
    $('#pk-check-body').innerHTML = html;
    $('#pk-check-sheet').hidden = false;
  }
  $('#pk-check-sheet').addEventListener('click', function (ev) {
    var t = ev.target, id;
    if ((id = t.getAttribute('data-ck-pouch'))) { moveEntry(curList, entryById(id), 'pouch'); touch(curList); App.save(); render(); openCheck(); return; }
    if ((id = t.getAttribute('data-ck-pouch-add'))) {
      var nm = id, m0 = st().memory.find(function (m) { return !App.isCloth(m) && norm(m.name).indexOf(norm(nm)) >= 0; });
      var ref = App.findRef(nm);
      var ne = m0 ? fromCatalog(m0, 'manual') : mkEntry({ key: 'm:' + App.uid(), name: nm, weight: ref ? ref.weight : 0.1, category: '必備品', carryOnly: true, source: 'manual' });
      ne.zone = 'pouch'; ne.status = 'take';
      curList.entries.push(ne); touch(curList); App.save(); render(); openCheck(); return;
    }
    if ((id = t.getAttribute('data-ck-done'))) { setChecked(curList, entryById(id), true); App.save(); render(); openCheck(); return; }
    if ((id = t.getAttribute('data-ck-drop'))) { removeEntry(curList, entryById(id)); App.save(); render(); openCheck(); return; }
    if ((id = t.getAttribute('data-ck-add'))) {
      var m = App.entryById(id);
      var old = curList.entries.find(function (x) { return x.catalogId === id; });
      var e = old || fromCatalog(m, 'manual');
      e.status = 'take'; e.zone = defaultZone(curList, e);
      if (!old) curList.entries.push(e);
      touch(curList); App.save(); render(); openCheck();
      return;
    }
    if (t.id === 'pk-check-sheet' || t.id === 'pk-check-close') $('#pk-check-sheet').hidden = true;
  });

  // ---------- 給首頁「我的行李」用 ----------
  function nextList(create) {
    var n = App.nextLeg();
    if (!n) return null;
    var l = listFor(n.trip.id);
    if (!l && create) l = ensureList(n.trip);
    if (l) reconcile(l);
    return l;
  }

  // 某個行李箱裡「清單上要帶、還沒收好」的項目
  function bagPending(bagId) {
    var n = App.nextLeg();
    var l = n && n.index === 0 ? nextList(false) : null;
    if (!l) return [];
    var act = activeZones(l);
    return l.entries.filter(function (e) {
      return e.status === 'take' && !e.checked && act.indexOf(e.zone) >= 0 && l.zones[e.zone].bagId === bagId;
    });
  }

  function findEntry(id) { var l = nextList(false); return l ? { l: l, e: l.entries.find(function (x) { return x.id === id; }) } : null; }

  // 打勾：清單上的項目收好了（放進行李）
  function checkEntry(id) {
    var f = findEntry(id);
    if (!f || !f.e) return;
    setChecked(f.l, f.e, true);
    App.save();
  }

  // 取消打勾：從行李拿出來，但留在這趟的清單上（之後還要帶）
  function uncheckItem(itemId) {
    var l = nextList(true);
    if (!l) return false;
    var e = l.entries.find(function (x) { return x.itemId === itemId; });
    if (!e) return false;   // 這個行李不在這趟的打包清單裡
    setChecked(l, e, false);
    App.save();
    return true;
  }

  function zoneForBag(l, bagId) {
    return activeZones(l).find(function (z) { return l.zones[z].bagId === bagId; }) || null;
  }

  // 已放進行李的東西換到別的行李
  function moveItem(itemId, bagId) {
    var it = st().items.find(function (x) { return x.id === itemId; });
    if (!it) return;
    it.bagId = bagId;
    var m = it.catalogId && App.entryById(it.catalogId);
    if (m) App.markPacked(m, bagId);
    var l = nextList(false);
    if (l) reconcile(l);
    App.save();
  }

  // 清單上還沒收好的項目換到別的行李
  function moveEntryTo(id, bagId) {
    var f = findEntry(id);
    if (!f || !f.e) return false;
    var z = zoneForBag(f.l, bagId);
    if (!z) return false;
    moveEntry(f.l, f.e, z);
    App.save();
    return true;
  }

  // 拿出來：這趟不帶了
  function takeOutItem(itemId) {
    var l = nextList(false);
    var e = l && l.entries.find(function (x) { return x.itemId === itemId; });
    if (e) removeEntry(l, e);
    else {
      var it = st().items.find(function (x) { return x.id === itemId; });
      st().items = st().items.filter(function (x) { return x.id !== itemId; });
      var m = it && it.catalogId && App.entryById(it.catalogId);
      if (m) App.restoreHome(m);
    }
    App.save();
  }

  function takeOutEntry(id) {
    var f = findEntry(id);
    if (!f || !f.e) return;
    removeEntry(f.l, f.e);
    App.save();
  }

  // 這趟用到的行李箱：打包清單上啟用的箱子＋裡面有東西的箱子；
  // 還沒有打包清單時，用每種類型的第一個箱子（出發地的家優先，和產生清單時的預設一樣）
  function tripBagIds(t) {
    var ids = [];
    function add(id) { if (id && ids.indexOf(id) < 0 && App.bagById(id)) ids.push(id); }
    st().items.forEach(function (it) { add(it.bagId); });
    if (!t) return ids;
    var list = listFor(t.id);
    if (list) activeZones(list).forEach(function (z) { add(list.zones[z].bagId); });
    return ids;
  }

  // 還沒出發的旅程：用打包清單估重量（空箱＋清單上要帶的東西），依行李箱
  function zoneWeights(t) {
    var list = ensureList(t, true);
    var out = {};
    activeZones(list).forEach(function (z) {
      var bag = App.bagById(list.zones[z].bagId);
      var w = bag.auto ? 0 : Number(bag.tare) || 0;
      list.entries.forEach(function (e) { if (e.status === 'take' && e.zone === z && e.checked) w += e.weight * e.qty; });   // 打勾的才算
      out[bag.id] = (out[bag.id] || 0) + w;
    });
    return out;
  }

  // 首頁「我的行李」用：這趟每種行李的設定（和打包清單同一份）
  function tripZones(t) {
    var list = ensureList(t, true);
    return ZONES.map(function (z) {
      var c = list.zones[z[0]];
      var bag = c && c.bagId && App.bagById(c.bagId);
      return { kind: z[0], on: !!(c && c.on && bag), bag: bag };
    });
  }

  // 選這趟某種行李用哪個箱子（bagId），或 'off'＝這趟不帶；首頁和打包清單都用這個
  function setTripZone(t, z, val) {
    var list = ensureList(t, true);
    var cfg = list.zones[z];
    // 只有正在進行／下一趟的旅程，行李箱裡才真的有東西；其他旅程只改選擇，不搬東西
    var nx = App.nextLeg();
    var live = !!(nx && nx.trip.id === t.id);
    if (val === 'off') {
      if (!cfg.on) return '';
      if (activeZones(list).length <= 1) return '至少要帶一種行李';
      // 這區不帶：清單上的東西（含已經收進去的）移到其他區
      cfg.on = false;
      list.entries.forEach(function (e) {
        if (e.zone === z && e.status === 'take') moveEntry(list, e, defaultZone(list, e));
      });
      // 不在清單上、但放在這個箱子裡的（例如購物）也移過去
      var to = list.zones[activeZones(list)[0]].bagId;
      if (live) st().items.forEach(function (it) { if (it.bagId === cfg.bagId) it.bagId = to; });
    } else {
      if (!App.bagById(val)) return '找不到這個行李箱';
      if (!cfg.on) { cfg.on = true; if (!cfg.bagId) cfg.bagId = val; }
      var old = cfg.bagId;
      if (live && old && old !== val) App.moveBagContents(old, val);   // 已經放進去的東西一起搬過去
      cfg.bagId = val;
    }
    touch(list);
    App.save();
    return '';
  }

  window.Packing = {
    prepareTrip: prepareTrip, addToTrip: addToTrip,
    show: show, tripBagIds: tripBagIds, openAdd: openAdd, tripZones: tripZones, setTripZone: setTripZone, zoneWeights: zoneWeights,
    seasonOptions: function () { return SEASONS; }, actOptions: function () { return ACTS.map(function (a) { return a.name; }); },
    guessSeasons: tripSeasons, guessActs: guessActs, zones: function () { return ZONES; }, pendingByBag: pendingByBag, bagPending: bagPending, checkEntry: checkEntry, uncheckItem: uncheckItem,
    moveItem: moveItem, moveEntryTo: moveEntryTo, takeOutItem: takeOutItem, takeOutEntry: takeOutEntry
  };
})();
