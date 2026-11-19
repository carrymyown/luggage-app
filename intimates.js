/*
 * 衣櫃 → 貼身衣物：襪子、內衣褲只記數量（不用照片），依家分開記
 *
 * state.intimates：[{ id, name, group('socks'|'under'), role, unit, weight(每雙／每件 kg), disposable(用完就丟), counts{ 家: 數量 }, createdAt, updatedAt }]
 *   role：warm 保暖長襪／long 一般長襪／short 短襪／set 成套內衣褲／sport 運動內衣／brief 一般內褲／disposable 免洗內褲／''（自己新增的）
 *   預設項目用固定 id、updatedAt 0：兩台裝置都有預設時不會重複，改過的那台會蓋過沒改的。
 * 打包：依這趟住幾晚建議數量（冷的地方保暖長襪、熱的地方短襪、有運動行程加運動內衣），
 *   目的地的家已經有的會扣掉（顯示「東京的家有 3 雙」）；打勾＝放進行李，那個家的數量跟著減少，拿出來會加回去。
 * 免洗內褲（用完就丟）：旅程中每過一天扣掉一件，行李重量跟著變輕；用完的不會回到任何一個家。
 * 必帶清單裡的「內衣褲」「襪子」改成連到這裡（依天數自動帶入，不會重複出現）。
 */
(function () {
  'use strict';

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;

  var DEFAULTS = [
    ['int-sock-warm', '保暖長襪（棉）', 'socks', 'warm', '雙', 0.06],
    ['int-sock-long', '一般長襪', 'socks', 'long', '雙', 0.04],
    ['int-sock-short', '短襪', 'socks', 'short', '雙', 0.03],
    ['int-set', '成套內衣褲', 'under', 'set', '套', 0.08],
    ['int-sport', '運動內衣', 'under', 'sport', '件', 0.06],
    ['int-brief', '一般內褲', 'under', 'brief', '件', 0.04],
    ['int-disposable', '免洗內褲', 'under', 'disposable', '件', 0.02]
  ];
  var GROUPS = [['socks', '襪子'], ['under', '內衣褲']];
  var UNITS = ['雙', '件', '套'];
  var LINKED_MUST = ['內衣褲', '襪子'];   // 必帶清單裡改成連到貼身衣物的項目
  var SPORT_ACTS = ['運動', '網球', '登山', '騎馬', '跑步', '登山健行', '游泳'];

  function st() { return App.state(); }
  function makeDefaults() {
    return DEFAULTS.map(function (d) {
      return { id: d[0], name: d[1], group: d[2], role: d[3], unit: d[4], weight: d[5], disposable: d[3] === 'disposable', counts: {}, createdAt: 0, updatedAt: 0 };
    });
  }
  // 還沒有貼身衣物的資料：放進預設項目（不另外存檔，下次存檔時一起存）
  function ensure(s) {
    s = s || st();
    if (!Array.isArray(s.intimates)) s.intimates = makeDefaults();
    s.intimates.forEach(function (x) { if (!x.counts || typeof x.counts !== 'object') x.counts = {}; });
    return s.intimates;
  }
  function items() { return ensure(); }
  function byId(id) { return items().find(function (x) { return x.id === id; }) || null; }
  function touch(x) { x.updatedAt = Date.now(); }
  function countAt(x, home) { return Math.max(0, parseInt(x.counts[home], 10) || 0); }

  // ---------- 新增、修改、數量（表單和範例都用這裡，格式才會一樣） ----------
  // o：{ name, group('socks'|'under'), unit, weight(kg), disposable, role? }
  function create(o) {
    var x = { id: App.uid(), name: String(o.name || '').trim().slice(0, 30), group: o.group === 'socks' ? 'socks' : 'under', role: o.role || '',
      unit: o.unit || (o.group === 'socks' ? '雙' : '件'), weight: Math.max(0, Number(o.weight) || 0), disposable: !!o.disposable,
      counts: {}, createdAt: Date.now(), updatedAt: Date.now() };
    if (!x.name) return null;
    items().push(x);
    return x;
  }
  function update(id, o) {
    var x = byId(id); if (!x) return null;
    if (o.name != null && String(o.name).trim()) x.name = String(o.name).trim().slice(0, 30);
    if (o.group) x.group = o.group === 'socks' ? 'socks' : 'under';
    if (o.unit) x.unit = o.unit;
    if (o.weight != null && isFinite(Number(o.weight))) x.weight = Math.max(0, Number(o.weight));
    if (o.disposable != null) x.disposable = !!o.disposable;
    touch(x);
    return x;
  }
  function remove(id) { st().intimates = items().filter(function (x) { return x.id !== id; }); }
  function setCount(id, home, n) {
    var x = byId(id); if (!x || !home) return null;
    x.counts[home] = Math.max(0, Math.min(999, parseInt(n, 10) || 0));
    touch(x);
    return x;
  }
  function addCount(id, home, d) { var x = byId(id); return x ? setCount(id, home, countAt(x, home) + d) : null; }

  // ---------- 打包時的建議數量 ----------
  function homeFor(city) { return window.Trips ? window.Trips.homeFor(city) : null; }
  // 回傳 [{ item, qty, notes[] }]：依住幾晚、天氣、活動，扣掉目的地的家已經有的
  function suggest(t) {
    if (!t || !window.Outfit) return [];
    var plan = window.Outfit.planTrip(t);
    var nights = Math.max(0, plan.length - 1);
    if (!nights) return [];
    var origin = homeFor(t.origin);
    var need = { warm: 0, long: 0, short: 0, set: nights, sport: 0 };
    var atHome = {};   // 住在別的家的晚數
    var sportDays = 0;
    plan.forEach(function (p, i) {
      var acts = p.acts || [];
      if (acts.some(function (a) { return SPORT_ACTS.indexOf(a) >= 0; })) sportDays++;
      if (i >= nights) return;
      var w = p.ctx.w, avg = w ? (w.hi + w.lo) / 2 : 20;
      if (avg < 12) need.warm++; else if (avg >= 25) need.short++; else need.long++;
      var h = homeFor(p.day.city);
      if (h && h !== origin) atHome[h] = (atHome[h] || 0) + 1;
    });
    if (!sportDays && (t.activities || []).some(function (a) { return SPORT_ACTS.indexOf(a) >= 0; })) sportDays = 1;
    need.sport = sportDays;
    var list = items();
    function first(role) { return list.find(function (x) { return x.role === role; }); }
    // 少了某種襪子（被刪掉了）：用其他襪子代替
    var sockFallback = first('long') || first('warm') || first('short');
    var out = {};
    function want(item, n, why) {
      if (!item || n <= 0) return;
      var o = out[item.id] || (out[item.id] = { item: item, qty: 0, need: 0, notes: [], why: why });
      o.need += n;
    }
    want(first('warm') || sockFallback, need.warm, 'cold');
    want(first('long') || sockFallback, need.long, 'mild');
    want(first('short') || sockFallback, need.short, 'hot');
    want(first('set') || first('brief'), need.set, 'nights');
    want(first('sport'), need.sport, 'sport');
    // 目的地的家已經有的：扣掉
    return Object.keys(out).map(function (id) {
      var o = out[id], left = o.need;
      Object.keys(atHome).forEach(function (h) {
        var have = countAt(o.item, h);
        if (!have) return;
        left -= Math.min(have, atHome[h], left);
        o.notes.push({ home: h, have: have });
      });
      o.qty = Math.max(0, left);
      o.nights = nights;
      return o;
    });
  }
  // 建議數量的說明：「依 7 晚建議・東京的家有 3 雙」
  function noteOf(o) {
    var parts = [];
    if (o.why === 'sport') parts.push('有運動行程');
    else if (o.why === 'cold') parts.push('天氣冷');
    else if (o.why === 'hot') parts.push('天氣熱');
    if (o.why !== 'sport') parts.push('依 ' + o.nights + ' 晚建議');
    o.notes.forEach(function (n) { parts.push((App.homeCity ? App.homeCity(n.home) : n.home) + '的家有 ' + n.have + ' ' + o.item.unit); });
    return parts.join('・');
  }

  // ---------- 打勾放進行李／拿出來：那個家的數量跟著變 ----------
  function onPack(e, it, trip) {
    var x = byId(e.intimateId); if (!x) return;
    var home = trip ? homeFor(trip.origin) : '';
    it.intimateId = x.id; it.disposable = !!x.disposable; it.fromHome = home || ''; it.tripId = trip ? trip.id : '';
    it.packedQty = it.qty; it.used = 0;
    if (home) { x.counts[home] = Math.max(0, countAt(x, home) - it.qty); touch(x); }
  }
  function onUnpack(it) {
    var x = it && it.intimateId && byId(it.intimateId); if (!x || !it.fromHome) return;
    x.counts[it.fromHome] = countAt(x, it.fromHome) + Math.max(0, it.qty);   // 用完的（免洗）不會回來
    touch(x);
  }
  // 整理行李時留在某個家：剩下的數量放進那個家
  function leftAtHome(it, home) {
    var x = it && it.intimateId && byId(it.intimateId); if (!x || !home) return;
    x.counts[home] = countAt(x, home) + Math.max(0, it.qty);
    touch(x);
  }
  // 免洗內褲：旅程中每過一天扣掉一件（行李變輕；用完的不回到任何一個家）
  function diffDays(a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((Date.UTC(+y[0], +y[1] - 1, +y[2]) - Date.UTC(+x[0], +x[1] - 1, +x[2])) / 86400000); }
  function consume() {
    var s = st(), today = App.todayStr(), changed = false;
    (s.items || []).forEach(function (it) {
      if (!it.intimateId || !it.disposable || !it.tripId) return;
      var t = s.trips.find(function (x) { return x.id === it.tripId; });
      var start = t && t.legs.map(function (l) { return l.date; }).filter(Boolean).sort()[0];
      if (!start) return;
      var target = Math.max(0, Math.min(it.packedQty || 0, diffDays(start, today)));
      var d = target - (it.used || 0);
      if (d <= 0) return;
      it.used = target;
      it.qty = Math.max(0, (it.packedQty || 0) - target);
      changed = true;
    });
    return changed;
  }

  // ---------- 衣櫃裡的「貼身衣物」：清單，名稱、數量、單位、加減按鈕；依家分開 ----------
  var curHome = '';
  function homes() { return App.homes(); }
  function renderInto(box) {
    ensure();
    var hs = homes();
    if (!curHome || hs.indexOf(curHome) < 0) curHome = hs[0] || '';
    if (!hs.length) { box.innerHTML = '<p class="muted small">還沒有家。先在右上角帳號裡新增一個家，就能記每個家有幾件。</p>'; return; }
    var html = '<div class="int-homes chips" role="group" aria-label="家">' + hs.map(function (h) {
      return '<button type="button" class="chip' + (h === curHome ? ' on' : '') + '" data-int-home="' + esc(h) + '">' + esc(h) + '</button>';
    }).join('') + '</div>' +
      '<p class="muted small int-intro">只記數量，不用照片。點名稱可以改名稱和每件的重量，打包時用來算重量。</p>';
    GROUPS.forEach(function (g) {
      var rows = items().filter(function (x) { return x.group === g[0]; });
      html += '<section class="int-group"><div class="int-group-head">' + g[1] + '</div>' + (rows.length ? rows.map(function (x) {
        var n = countAt(x, curHome);
        return '<div class="int-row">' +
          '<button type="button" class="int-name" data-int-edit="' + esc(x.id) + '"><span class="int-title">' + esc(x.name) + '</span>' +
            '<span class="muted small">每' + esc(x.unit) + '約 ' + App.fmtWeight(x.weight || 0) + (x.disposable ? '・用完就丟' : '') + '</span></button>' +
          '<div class="int-step"><button type="button" class="int-btn" data-int-dec="' + esc(x.id) + '" aria-label="減少"' + (n ? '' : ' disabled') + '>−</button>' +
            '<span class="int-n"><b>' + n + '</b> ' + esc(x.unit) + '</span>' +
            '<button type="button" class="int-btn" data-int-inc="' + esc(x.id) + '" aria-label="增加">＋</button></div></div>';
      }).join('') : '<p class="muted small">還沒有項目。</p>') + '</section>';
    });
    html += '<button type="button" class="btn ghost int-add" data-int-add="1">＋ 新增項目</button>';
    box.innerHTML = html;
  }

  // ---------- 新增／修改一項 ----------
  var editing = null;
  function openSheet(id) {
    var x = id ? byId(id) : null;
    editing = x ? x.id : null;
    $('#int-title').textContent = x ? '修改貼身衣物' : '新增貼身衣物';
    $('#int-name').value = x ? x.name : '';
    $('#int-group').innerHTML = GROUPS.map(function (g) { return '<option value="' + g[0] + '"' + ((x ? x.group : 'socks') === g[0] ? ' selected' : '') + '>' + g[1] + '</option>'; }).join('');
    $('#int-unit').innerHTML = UNITS.map(function (u) { return '<option value="' + u + '"' + ((x ? x.unit : '雙') === u ? ' selected' : '') + '>' + u + '</option>'; }).join('');
    $('#int-weight').value = x ? Math.round((x.weight || 0) * 1000) : '';
    $('#int-disposable').checked = !!(x && x.disposable);
    $('#int-delete').hidden = !x;
    $('#int-sheet').hidden = false;
    setTimeout(function () { $('#int-name').focus(); }, 50);
  }
  function save() {
    var name = $('#int-name').value.trim();
    if (!name) { App.toast('請輸入名稱'); return; }
    var g = parseFloat($('#int-weight').value);
    var o = { name: name, group: $('#int-group').value, unit: $('#int-unit').value, weight: isFinite(g) && g >= 0 ? g / 1000 : undefined, disposable: $('#int-disposable').checked };
    if (editing) update(editing, o); else { if (o.weight == null) o.weight = o.group === 'socks' ? 0.04 : 0.05; create(o); }
    App.save();
    $('#int-sheet').hidden = true;
    App.toast(editing ? '已儲存' : '已新增：' + name);
    App.refreshView();
  }
  $('#int-form').addEventListener('submit', function (ev) { ev.preventDefault(); save(); });
  $('#int-sheet').addEventListener('click', function (ev) {
    if (ev.target.id === 'int-delete' && editing) {
      var x = byId(editing);
      if (!x || !confirm('要刪除「' + x.name + '」嗎？\n（每個家記的數量會一起刪除；已經放進行李的不受影響）')) return;
      remove(editing); App.save(); $('#int-sheet').hidden = true; App.toast('已刪除'); App.refreshView();
      return;
    }
    if (ev.target.id === 'int-sheet' || ev.target.id === 'int-cancel') $('#int-sheet').hidden = true;
  });
  document.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('[data-must-int]') && window.Closet && window.Closet.showIntimates) window.Closet.showIntimates();   // 必帶清單 → 貼身衣物
    var el = ev.target.closest && ev.target.closest('[data-int-home], [data-int-inc], [data-int-dec], [data-int-edit], [data-int-add]');
    if (!el) return;
    if (el.hasAttribute('data-int-home')) { curHome = el.getAttribute('data-int-home'); App.refreshView(); return; }
    if (el.hasAttribute('data-int-inc')) { addCount(el.getAttribute('data-int-inc'), curHome, 1); App.save(); App.refreshView(); return; }
    if (el.hasAttribute('data-int-dec')) { addCount(el.getAttribute('data-int-dec'), curHome, -1); App.save(); App.refreshView(); return; }
    if (el.hasAttribute('data-int-edit')) { openSheet(el.getAttribute('data-int-edit')); return; }
    if (el.hasAttribute('data-int-add')) openSheet(null);
  });

  ensure();
  window.Intimates = {
    items: items, byId: byId, ensure: ensure, create: create, update: update, remove: remove, setCount: setCount, addCount: addCount, countAt: countAt,
    suggest: suggest, noteOf: noteOf, onPack: onPack, onUnpack: onUnpack, leftAtHome: leftAtHome, consume: consume,
    renderInto: renderInto, openSheet: openSheet, LINKED_MUST: LINKED_MUST, setHome: function (h) { curHome = h; }
  };
})();
