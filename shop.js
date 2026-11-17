/*
 * 回程購物與送禮（底部「＋」→ 記一筆購物；首頁剩餘公斤數下方的入口）
 *
 * state.shopping
 *   plans      計畫要買：{ id, tripId, name, weight(每個 kg), qty, purchaseId(買了之後連到購物紀錄), createdAt }
 *   purchases  購物紀錄：{ id, tripId, purpose, name, weight(每個 kg), qty, price, category, city, bagId, homeDest(之後放到哪個家),
 *                         placedHome(整理行李時已經放到哪個家), photoId, unpackedHome／unpackedDate(紀念品到家自動拿出行李),
 *                         planId, date, createdAt, updatedAt }
 *     purpose：own 自己會帶出門（預設，舊資料也是）／souvenir 紀念品、放家裡就好
 *     （「送人」直接存成 state.gifts 的一份禮物，旅途中買的禮物也會列在購物紀錄裡）
 *   ratio      （舊資料：以前的計畫／衝動購物比例，已不使用）
 * state.gifts  送禮：{ id, tripId, name, weight(每個 kg), qty, to(送給誰), city(在哪個城市送), status, source, drawerId,
 *                     bagId, home(不在行李裡時放在哪個家), givenDate, createdAt, updatedAt }
 *   status：want 想買／bought 已買好／packed 在行李裡／given 已送出
 *   source：home 出發前從家裡帶／trip 旅途中買／drawer 從抽屜挑
 * 放進行李的購物和禮物，會在 state.items 有一筆（purchaseId／giftId），首頁剩餘公斤數自動扣掉。
 */
(function () {
  'use strict';

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;
  var DEFAULT_RATIO = 0.7;
  var STATUS = [['want', '想買'], ['bought', '已買好'], ['packed', '在行李裡'], ['given', '已送出']];
  var SOURCES = [['home', '從家裡帶'], ['trip', '旅途中買'], ['drawer', '從抽屜挑']];
  // 記一筆購物時先選「這是什麼」
  var PURPOSES = [['own', '自己會帶出門'], ['souvenir', '紀念品／放家裡就好'], ['gift', '送人']];
  var PURPOSE_TAG = { own: '自己帶', souvenir: '紀念品', gift: '送人' };
  function purposeOf(p) { return p && p.purpose === 'souvenir' ? 'souvenir' : 'own'; }

  function st() { return App.state(); }
  function sh() { return st().shopping; }
  function fmt(n) { var r = Math.round((Number(n) || 0) * 10) / 10; return (Object.is(r, -0) ? 0 : r).toFixed(1); }
  function num(v) { var n = parseFloat(v); return isFinite(n) && n >= 0 ? n : 0; }
  function tripById(id) { return st().trips.find(function (t) { return t.id === id; }); }
  function itemOfPurchase(p) { return st().items.find(function (it) { return it.purchaseId === p.id; }); }
  function itemOfGift(g) { return st().items.find(function (it) { return it.giftId === g.id; }); }
  function giftById(id) { return st().gifts.find(function (g) { return g.id === id; }); }
  function purchaseById(id) { return sh().purchases.find(function (p) { return p.id === id; }); }
  function statusName(s) { return (STATUS.find(function (x) { return x[0] === s; }) || [, ''])[1]; }
  function bagName(id) { var b = App.bagById(id); return b ? b.name : ''; }
  function sameCity(a, b) {
    var x = App.norm(a || ''), y = App.norm(b || '');
    return !!x && !!y && (x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0);
  }

  // 禮物狀態以行李清單為準：行李裡有＝在行李裡；被拿出來了＝已買好
  function giftStatus(g) {
    if (g.status === 'given') return 'given';
    if (itemOfGift(g)) return 'packed';
    return g.status === 'packed' ? 'bought' : (g.status || 'want');
  }

  // ---------- 旅程 ----------
  function sortedTrips() {
    return st().trips.slice().sort(function (a, b) {
      var da = (a.legs[0] || {}).date || '', db = (b.legs[0] || {}).date || '';
      return db.localeCompare(da);
    });
  }
  function defaultTripId() {
    var n = App.nextLeg();
    if (n) return n.trip.id;
    var t = sortedTrips()[0];
    return t ? t.id : '';
  }
  function tripCities(t) {
    var out = [];
    (t ? t.legs : []).forEach(function (l) {
      [l.from, l.to].forEach(function (c) { c = (c || '').trim(); if (c && out.indexOf(c) < 0) out.push(c); });
    });
    return out;
  }

  var tripId = '';
  var tab = 'buy';
  var giftView = 'list';

  function curTrip() {
    if (!tripById(tripId)) tripId = defaultTripId();
    return tripById(tripId);
  }

  // ---------- 額度計算 ----------
  function ratioOf(id) {
    var r = sh().ratio[id];
    return typeof r === 'number' && r >= 0 && r <= 1 ? r : DEFAULT_RATIO;
  }

  function tripWeights(id) {
    var planUsed = 0, impulseUsed = 0, reserve = 0, boughtCount = 0, boughtW = 0;
    sh().purchases.forEach(function (p) {
      if (p.tripId !== id) return;
      var w = p.weight * p.qty;
      boughtCount++; boughtW += w;
      if (!itemOfPurchase(p)) return;          // 不在行李裡就不佔額度
      if (p.planId) planUsed += w; else impulseUsed += w;
    });
    sh().plans.forEach(function (pl) {
      if (pl.tripId === id && !(pl.purchaseId && purchaseById(pl.purchaseId))) reserve += pl.weight * pl.qty;
    });
    st().gifts.forEach(function (g) {
      if (g.tripId !== id) return;
      var s = giftStatus(g);
      if (s === 'want') reserve += g.weight * g.qty;                                  // 想買的禮物先預留在計畫購物
      else if (s === 'packed' && g.source === 'trip') planUsed += g.weight * g.qty;   // 旅途中買的禮物算計畫購物
    });
    return { planUsed: planUsed, impulseUsed: impulseUsed, reserve: reserve, boughtCount: boughtCount, boughtW: boughtW };
  }

  // 還可以買多少：就是這趟旅程的剩餘公斤數（和首頁旅程卡同一個數字；購物和行李裡的禮物已經扣掉）
  function quota(id) {
    var t = tripById(id);
    var r = t ? App.tripRemain(t) : null;
    if (!r || r.remain == null) return { remain: null };
    return { remain: r.remain, leg: r.leg, tight: r.tight, trip: t };
  }

  // ---------- 首頁 ----------
  function hereCity() {
    var T = window.Trips;
    if (!T) return null;
    var today = App.todayStr(), best = null;
    st().trips.forEach(function (t) {
      t.legs.forEach(function (l, i) {
        var arr = T.arrivalDate(l);
        if (!arr || arr > today || !l.to) return;
        var nx = t.legs[i + 1];
        if (nx && nx.date && nx.date < today) return;   // 已經離開這個城市
        var d = (Date.parse(today) - Date.parse(arr)) / 86400000;
        if (d > 21) return;
        if (!best || arr >= best.date) best = { city: l.to, date: arr, trip: t };
      });
    });
    return best;
  }

  function giftsHere() {
    var h = hereCity();
    if (!h) return { here: null, list: [] };
    return {
      here: h,
      list: st().gifts.filter(function (g) {
        var s = giftStatus(g);
        return (s === 'bought' || s === 'packed') && sameCity(g.city, h.city);
      })
    };
  }

  function renderHomeBits() {
    var entry = $('#shop-entry');
    if (entry) {
      var id = defaultTripId();
      var w = id ? tripWeights(id) : { boughtCount: 0, boughtW: 0 };
      var gifts = st().gifts.filter(function (g) { return g.tripId === id && giftStatus(g) !== 'given'; }).length;
      $('#shop-entry-sub').textContent = '已買 ' + w.boughtCount + ' 件・' + fmt(w.boughtW) + ' kg' + (gifts ? '・禮物 ' + gifts + ' 份' : '');
    }
    var box = $('#gift-banner');
    if (!box) return;
    var gh = giftsHere();
    if (!gh.list.length) { box.hidden = true; box.innerHTML = ''; return; }
    var people = [];
    gh.list.forEach(function (g) { var p = g.to || '未填對象'; if (people.indexOf(p) < 0) people.push(p); });
    var n = gh.list.reduce(function (s, g) { return s + (g.qty || 1); }, 0);
    box.hidden = false;
    box.innerHTML = '<div class="arrival-text">' + App.GIFT_ICON + ' 這裡有 <b>' + n + '</b> 份禮物要送<br><span class="muted small">' +
      esc(gh.here.city) + '・給 ' + esc(people.join('、')) + '</span></div>' +
      '<div class="arrival-btns"><a class="btn primary small-btn" href="#shop/gift">查看禮物</a></div>';
  }

  // ---------- 頁面 ----------
  function show(which) {
    tab = which === 'gift' ? 'gift' : 'buy';
    render();
  }

  function render() {
    var trips = sortedTrips();
    var t = curTrip();
    $('#shop-empty').hidden = !!trips.length;
    $('#shop-main').hidden = !trips.length;
    Array.prototype.forEach.call(document.querySelectorAll('[data-shop-tab]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-shop-tab') === tab);
    });
    $('#shop-h1').textContent = tab === 'gift' ? '送禮與伴手禮' : '回程購物';
    $('#shop-h1').setAttribute('data-en', tab === 'gift' ? 'GIFTS' : 'SHOPPING');
    if (!trips.length) return;
    $('#shop-trip').innerHTML = trips.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === tripId ? ' selected' : '') + '>' + esc(x.name || '未命名旅程') + '</option>';
    }).join('');
    $('#shop-buy').hidden = tab !== 'buy';
    $('#shop-gift').hidden = tab !== 'gift';
    if (tab === 'buy') renderBuy(t); else renderGift(t);
  }

  function renderQuota(t) {
    var q = quota(t.id);
    if (q.remain == null) {
      $('#shop-remain').textContent = '—';
      $('#shop-remain').classList.remove('over');
      $('#shop-remain-note').textContent = '這趟還沒設定額度';
      return q;
    }
    $('#shop-remain').textContent = fmt(q.remain);
    $('#shop-remain').classList.toggle('over', q.remain < 0);
    $('#shop-remain-note').textContent = q.remain < 0 ? '已經超重了' : (q.tight && q.leg ? '依最緊的一段「' + (q.leg.from || '?') + ' → ' + (q.leg.to || '?') + '」' : '');
    return q;
  }

  function tryText(w, q) {
    if (!q || q.remain == null) return '';
    var left = q.remain - w;
    return '<span class="' + (left < 0 ? 'over' : '') + '">買了之後還剩 <b>' + fmt(left) + '</b> 公斤' + (left < 0 ? '（超重了）' : '') + '</span>';
  }

  function renderTry() {
    var t = curTrip(); if (!t) return;
    var w = num($('#shop-try').value);
    $('#shop-try-out').innerHTML = $('#shop-try').value === '' ? '<span class="muted">輸入重量，先算算看</span>' : tryText(w, quota(t.id));
  }

  function renderBuy(t) {
    renderQuota(t);
    renderTry();
    renderRecords(t);
  }

  function purchaseLoc(p) {
    var it = itemOfPurchase(p);
    if (it) return '🧳 ' + (bagName(it.bagId) || '行李');
    if (p.placedHome) return '📍 已放到' + p.placedHome;
    if (p.unpackedHome) return '已帶回' + p.unpackedHome + '的家';
    return '不在行李裡';
  }

  // 購物紀錄：自己帶／紀念品／送人（旅途中買的禮物）三種，用小標籤區分，可以篩選
  var recFilter = '';
  function recordsOf(tid) {
    var buys = sh().purchases.filter(function (p) { return p.tripId === tid; }).map(function (p) {
      return { kind: purposeOf(p), rec: p, at: p.createdAt || 0, w: p.weight * p.qty };
    });
    var gifts = st().gifts.filter(function (g) { return g.tripId === tid && g.source === 'trip' && giftStatus(g) !== 'want'; }).map(function (g) {
      return { kind: 'gift', rec: g, at: g.createdAt || 0, w: g.weight * g.qty };
    });
    return buys.concat(gifts).sort(function (a, b) { return b.at - a.at; });
  }
  function recRow(r) {
    var x = r.rec;
    var meta = r.kind === 'gift' ? [x.to ? '給 ' + x.to : '', x.city, giftStatus(x) === 'given' ? '已送出' : itemOfGift(x) ? '🧳 ' + (bagName(itemOfGift(x).bagId) || '行李') : '']
      : [x.city, x.price, purchaseLoc(x), r.kind === 'own' && x.homeDest ? '之後放' + x.homeDest : ''];
    return '<button type="button" class="sr-row" ' + (r.kind === 'gift' ? 'data-gift-edit' : 'data-buy-edit') + '="' + esc(x.id) + '">' +
      (r.kind === 'own' && x.photoId ? '<img class="bp-thumb" data-photo="' + esc(x.photoId) + '" alt="">' : '') +
      '<span class="sr-info"><b>' + esc(x.name) + (x.qty > 1 ? ' × ' + x.qty : '') + '<span class="pur-tag pur-' + r.kind + '">' + PURPOSE_TAG[r.kind] + '</span></b>' +
      '<span class="muted small">' + esc(meta.filter(Boolean).join('・')) + '</span></span>' +
      '<span class="bp-w">' + App.fmtWeight(r.w) + '</span></button>';
  }
  function renderRecords(t) {
    var trips = [t].concat(sortedTrips().filter(function (x) { return x.id !== t.id; }));
    var filter = '<div class="chips pur-filter">' + [['', '全部']].concat([['own', '自己帶'], ['souvenir', '紀念品'], ['gift', '送人']]).map(function (f) {
      return '<button type="button" class="chip' + (recFilter === f[0] ? ' on' : '') + '" data-rec-filter="' + f[0] + '">' + f[1] + '</button>';
    }).join('') + '</div>';
    var html = trips.map(function (x) {
      var all = recordsOf(x.id);
      var list = all.filter(function (r) { return !recFilter || r.kind === recFilter; });
      if (!all.length && x.id !== t.id) return '';
      if (!list.length && x.id !== t.id) return '';
      var w = list.reduce(function (s, r) { return s + r.w; }, 0);
      return '<div class="sr-group"><div class="sr-head"><span>' + esc(x.name || '未命名旅程') + '</span><span class="muted small">' + list.length + ' 件・' + fmt(w) + ' kg</span></div>' +
        (list.length ? list.map(recRow).join('') : '<p class="muted small">' + (recFilter ? '這趟沒有這一類的購物。' : '這趟還沒有購物紀錄。') + '</p>') + '</div>';
    }).join('');
    $('#shop-records').innerHTML = filter + html;
    Photos.fillThumbs($('#shop-records'));
  }

  // ---------- 送禮 ----------
  function giftRow(g, withTrip) {
    var s = giftStatus(g);
    if (s === 'given') {
      return '<div class="gf-row done gf-given">' +
        '<button type="button" class="gf-main" data-gift-edit="' + esc(g.id) + '">' + App.GIFT_ICON +
        '<span class="sr-info"><b>' + esc(g.name) + (g.qty > 1 ? ' × ' + g.qty : '') + '</b><span class="muted small">' +
        esc([g.to ? '給 ' + g.to : '', g.city, g.givenDate ? window.Trips.fmtDate(g.givenDate) : ''].filter(Boolean).join('・')) + '</span></span>' +
        '<span class="gf-side"><span class="gf-status s-given">已送出</span></span></button>' +
        '<button type="button" class="link small gf-act gf-del" data-gift-del="' + esc(g.id) + '">刪除</button></div>';
    }
    var it = itemOfGift(g);
    var t = tripById(g.tripId);
    var meta = [g.to ? '給 ' + g.to : '還沒決定送誰', g.city, s === 'packed' && it ? bagName(it.bagId) : '', s === 'bought' && g.home ? '在' + g.home : '',
      s === 'given' && g.givenDate ? window.Trips.fmtDate(g.givenDate) + '送出' : '', withTrip && t ? t.name : ''].filter(Boolean).join('・');
    var act = s === 'want' ? ['bought', '已買好'] : s === 'bought' ? ['pack', '放進行李'] : s === 'packed' ? ['given', '已送出'] : null;
    return '<div class="gf-row' + (s === 'given' ? ' done' : '') + '">' +
      '<button type="button" class="gf-main" data-gift-edit="' + esc(g.id) + '">' + App.GIFT_ICON +
      '<span class="sr-info"><b>' + esc(g.name) + (g.qty > 1 ? ' × ' + g.qty : '') + '</b><span class="muted small">' + esc(meta) + '</span></span>' +
      '<span class="gf-side"><span class="gf-status s-' + s + '">' + statusName(s) + '</span><span class="muted small">' + App.fmtWeight(g.weight * g.qty) + '</span></span></button>' +
      (act ? '<button type="button" class="link small gf-act" data-gift-act="' + act[0] + '" data-gift-id="' + esc(g.id) + '">' + act[1] + ' ›</button>' : '') +
      '</div>';
  }

  function renderGift(t) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-gift-view]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-gift-view') === giftView);
    });
    var gh = giftsHere();
    $('#gift-here').hidden = !gh.list.length;
    if (gh.list.length) {
      $('#gift-here').innerHTML = '<div class="arrival-text">' + App.GIFT_ICON + ' 在' + esc(gh.here.city) + '有 <b>' + gh.list.length + '</b> 項禮物要送</div>' +
        gh.list.map(function (g) { return giftRow(g, true); }).join('');
    }
    if (giftView === 'list') {
      var list = st().gifts.filter(function (g) { return g.tripId === t.id; });
      var order = ['want', 'bought', 'packed', 'given'];
      list.sort(function (a, b) { return order.indexOf(giftStatus(a)) - order.indexOf(giftStatus(b)); });
      var w = list.filter(function (g) { return giftStatus(g) === 'packed'; }).reduce(function (s, g) { return s + g.weight * g.qty; }, 0);
      $('#gift-list').innerHTML = list.length ?
        '<p class="muted small gf-sum">' + list.length + ' 項・在行李裡 ' + fmt(w) + ' kg</p>' + list.map(function (g) { return giftRow(g, false); }).join('') :
        '<p class="muted small">這趟還沒有禮物。可以先記下想買的。</p>';
    } else {
      var by = {};
      st().gifts.forEach(function (g) { var p = g.to || '未填對象'; (by[p] = by[p] || []).push(g); });
      var names = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length; });
      $('#gift-list').innerHTML = names.length ? names.map(function (p) {
        var arr = by[p].slice().sort(function (a, b) { return (b.givenDate || '').localeCompare(a.givenDate || '') || (b.createdAt || 0) - (a.createdAt || 0); });
        var given = arr.filter(function (g) { return giftStatus(g) === 'given'; }).length;
        return '<div class="sr-group"><div class="sr-head"><span>' + esc(p) + '</span><span class="muted small">' + arr.length + ' 份・已送 ' + given + '</span></div>' +
          arr.map(function (g) { return giftRow(g, true); }).join('') + '</div>';
      }).join('') : '<p class="muted small">還沒有送禮紀錄。</p>';
    }
  }

  // ---------- 記一筆購物 ----------
  var buy = null;   // 編輯中的購物紀錄（新的或舊的副本）

  function chipList(el, list, value, attr, extra) {
    el.innerHTML = list.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, label = Array.isArray(o) ? o[1] : o;
      return '<button type="button" class="chip' + (v === value ? ' on' : '') + '" ' + attr + '="' + esc(v) + '">' + esc(label) + '</button>';
    }).join('') + (extra || '');
  }

  function defaultBagId() {
    // 這趟用到的箱子優先（托運優先），不會選到放在別的家的箱子
    var bags = App.pickBags().filter(function (b) { return App.isTripBag(b.id); });
    if (!bags.length) bags = App.pickBags();
    var pick = bags.find(function (b) { return b.kind === 'checked'; }) || bags[0];
    return pick ? pick.id : '';
  }

  function openBuy(id, plan) {
    var t = curTrip();
    if (!t) { App.toast('請先新增一趟旅程'); return; }
    var p = id && purchaseById(id);
    if (p) {
      var it = itemOfPurchase(p);
      buy = JSON.parse(JSON.stringify(p));
      buy.bagId = it ? it.bagId : '';
      buy.isNew = false;
      buy.purpose = purposeOf(p);
    } else {
      var here = hereCity();
      buy = { id: App.uid(), tripId: t.id, name: plan ? plan.name : '', weight: plan ? plan.weight : '', qty: plan ? plan.qty : 1, price: '',
        category: '必備品', city: here && here.trip.id === t.id ? here.city : '', bagId: defaultBagId(), homeDest: '', planId: plan ? plan.id : null, isNew: true,
        purpose: 'own', photoId: null };
    }
    buyPhoto = { blob: null, removed: false };
    $('#buy-to').value = '';
    showBuyPhoto(null);
    if (buy.photoId) Photos.url(buy.photoId).then(function (u) { if (!buyPhoto.blob && !buyPhoto.removed) showBuyPhoto(u); });
    $('#buy-title').textContent = buy.isNew ? (plan ? '買了：' + plan.name : '記一筆購物') : '編輯購物紀錄';
    $('#buy-name').value = buy.name;
    $('#buy-weight').value = buy.weight === '' ? '' : buy.weight;
    $('#buy-qty').value = buy.qty || 1;
    $('#buy-price').value = buy.price || '';
    $('#buy-cat').innerHTML = App.categories().map(function (c) {
      return '<option' + (c.name === buy.category ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    $('#buy-delete').hidden = buy.isNew;
    // 已經放到家裡（進了抽屜）的購物：只留作紀錄，東西本身到抽屜改，才不會有兩份不一樣的資料
    buy.locked = !buy.isNew && !!(p && p.placedHome) && !itemOfPurchase(p);
    $('#buy-note').hidden = !buy.locked;
    $('#buy-note').textContent = buy.locked ? '這筆已經放到' + p.placedHome + '的家，現在在「我的抽屜」裡。這裡只留作購物紀錄；要改名稱或重量請到抽屜。' : '';
    ['#buy-name', '#buy-weight', '#buy-qty', '#buy-price', '#buy-cat'].forEach(function (s) { $(s).disabled = buy.locked; });
    $('#buy-save').hidden = buy.locked;
    $('#buy-sheet').classList.toggle('locked', buy.locked);
    renderBuyForm();
    $('#buy-sheet').hidden = false;
    $('#buy-sheet .org-panel').scrollTop = 0;
    if (buy.isNew && !plan) setTimeout(function () { $('#buy-name').focus(); }, 50);
  }

  var buyPhoto = { blob: null, removed: false };
  function showBuyPhoto(url) {
    $('#buy-photo-img').hidden = !url;
    if (url) $('#buy-photo-img').src = url; else $('#buy-photo-img').removeAttribute('src');
    $('#buy-photo-hint').hidden = !!url;
    $('#buy-photo-remove').hidden = !url;
  }
  $('#buy-photo').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    Photos.compress(file).then(function (ph) {
      buyPhoto = { blob: ph, removed: false };
      showBuyPhoto(URL.createObjectURL(ph.blob));
    }).catch(function () { App.toast('這張照片讀不到，請換一張試試'); });
  });
  $('#buy-photo-remove').addEventListener('click', function () { buyPhoto = { blob: null, removed: true }; showBuyPhoto(null); });

  function renderBuyForm() {
    // 這是什麼：自己會帶出門／紀念品、放家裡就好／送人（已經存好的購物不能改成送人）
    var opts = buy.isNew ? PURPOSES : PURPOSES.filter(function (x) { return x[0] !== 'gift'; });
    $('#buy-purpose').innerHTML = opts.map(function (x) {
      return '<button type="button" class="' + (buy.purpose === x[0] ? 'on' : '') + '" data-buy-purpose="' + x[0] + '">' + x[1] + '</button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#buy-sheet [data-for]'), function (el) {
      el.hidden = el.getAttribute('data-for').split(' ').indexOf(buy.purpose) < 0;
    });
    $('#buy-city-title').textContent = buy.purpose === 'gift' ? '在哪個城市送' : '在哪個城市買';
    $('#buy-name').placeholder = buy.purpose === 'gift' ? '例如：鳳梨酥、茶葉' : '買了什麼';
    chipList($('#buy-bag'), App.pickBags().map(function (b) { return [b.id, App.bagLabel(b)]; }).concat([['', '不放進行李']]), buy.bagId, 'data-buy-bag');
    var cities = tripCities(tripById(buy.tripId));
    if (buy.city && cities.indexOf(buy.city) < 0) cities.push(buy.city);
    chipList($('#buy-city'), cities, buy.city, 'data-buy-city', '<button type="button" class="chip" data-buy-city-other="1">其他</button>');
    chipList($('#buy-home'), App.homes().concat([['', '未定']]), buy.homeDest, 'data-buy-home');
    buyTry();
  }

  function buyTry() {
    var w = num($('#buy-weight').value) * Math.max(1, parseInt($('#buy-qty').value, 10) || 1);
    var q = quota(buy.tripId);
    if (q.remain == null) { $('#buy-try').innerHTML = ''; return; }
    // 編輯舊紀錄：原本已算在行李裡的先加回來
    var old = !buy.isNew && purchaseById(buy.id);
    var back = old && itemOfPurchase(old) ? old.weight * old.qty : 0;
    var left = q.remain + back - (buy.bagId ? w : 0);
    $('#buy-try').innerHTML = buy.bagId ? '<span class="' + (left < 0 ? 'over' : '') + '">買了之後還剩 <b>' + fmt(left) + '</b> 公斤' + (left < 0 ? '（超重了）' : '') + '</span>' :
      '<span class="muted">不放進行李，不會扣剩餘公斤數</span>';
  }

  // ---------- 記一筆購物（表單和範例資料都用這裡，格式才會一樣） ----------
  // p：要修改的紀錄（新增就給 null）
  // o：{ id?, tripId, planId?, date?, purpose('own'|'souvenir'), name, weight(kg), qty, price, category, city, homeDest, bagId, photoId? }
  // （「送人」不在這裡：用 writeGift 存成一份禮物）
  function writePurchase(p, o) {
    var s = st(), isNew = !p;
    if (isNew) p = { id: o.id || App.uid(), createdAt: Date.now(), date: o.date || App.todayStr(), planId: o.planId || null, tripId: o.tripId };
    p.name = o.name;
    p.weight = num(o.weight);
    p.qty = Math.max(1, parseInt(o.qty, 10) || 1);
    p.price = String(o.price || '').trim().slice(0, 20);
    p.category = o.category || '必備品';
    p.city = o.city || '';
    p.purpose = o.purpose === 'souvenir' ? 'souvenir' : 'own';
    // 紀念品：不問放哪個家、不要照片（到家自動從行李拿出來）
    p.homeDest = p.purpose === 'own' ? (o.homeDest || '') : '';
    p.photoId = p.purpose === 'own' ? (o.photoId || null) : null;
    p.bagId = o.bagId || '';
    p.updatedAt = Date.now();
    if (isNew) {
      sh().purchases.push(p);
      var plan = p.planId && sh().plans.find(function (x) { return x.id === p.planId; });
      if (plan) plan.purchaseId = p.id;
    }
    // 行李清單：放進行李就有一筆，不放就拿掉
    var it = itemOfPurchase(p);
    if (p.bagId) {
      if (!it) { it = { id: App.uid(), purchaseId: p.id }; s.items.push(it); }
      it.name = p.name; it.weight = p.weight; it.qty = p.qty; it.unit = '個'; it.category = p.category; it.bagId = p.bagId;
      p.placedHome = '';
    } else if (it) {
      s.items = s.items.filter(function (x) { return x !== it; });
    }
    return p;
  }

  function saveBuy() {
    var name = $('#buy-name').value.trim();
    if (!name) { App.toast('請輸入名稱'); return; }
    // 送人：存成「送禮」分頁裡的一份禮物（在行李裡就算進重量）
    if (buy.purpose === 'gift') {
      writeGift(null, { tripId: buy.tripId, name: name, weight: $('#buy-weight').value, qty: $('#buy-qty').value, to: $('#buy-to').value,
        city: buy.city, source: 'trip', status: buy.bagId ? 'packed' : 'bought', bagId: buy.bagId });
      App.save();
      $('#buy-sheet').hidden = true;
      App.toast('已記成禮物：' + name);
      render();
      return;
    }
    var p = buy.isNew ? null : purchaseById(buy.id);
    if (!buy.isNew && !p) return;
    var oldPhoto = p && p.photoId;
    var photoId = buy.purpose === 'own' ? (buyPhoto.removed ? null : (buyPhoto.blob ? 'buy-' + buy.id : buy.photoId || null)) : null;
    var job = buyPhoto.blob && photoId ? Photos.put(photoId, buyPhoto.blob).catch(function () { photoId = null; App.toast('照片存不進去'); }) : Promise.resolve();
    job.then(function () {
      writePurchase(p, {
        id: buy.id, tripId: buy.tripId, planId: buy.planId, purpose: buy.purpose, name: name,
        weight: $('#buy-weight').value, qty: $('#buy-qty').value, price: $('#buy-price').value,
        category: $('#buy-cat').value, city: buy.city, homeDest: buy.homeDest, bagId: buy.bagId, photoId: photoId
      });
      if (oldPhoto && oldPhoto !== photoId) App.dropPhotoIfUnused(oldPhoto);
      App.save();
      $('#buy-sheet').hidden = true;
      App.toast(buy.isNew ? '已記下：' + name : '已儲存');
      render();
    });
  }

  function deleteBuy() {
    var p = purchaseById(buy.id);
    if (!p || !confirm('要刪除購物紀錄「' + p.name + '」嗎？（也會從行李拿出來）')) return;
    sh().purchases = sh().purchases.filter(function (x) { return x !== p; });
    st().items = st().items.filter(function (it) { return it.purchaseId !== p.id; });
    sh().plans.forEach(function (pl) { if (pl.purchaseId === p.id) pl.purchaseId = null; });
    if (p.photoId) App.dropPhotoIfUnused(p.photoId);
    App.save();
    $('#buy-sheet').hidden = true;
    App.toast('已刪除');
    render();
  }

  $('#buy-sheet').addEventListener('click', function (e) {
    var t = e.target, el;
    if (buy && buy.locked && t.closest('[data-buy-bag], [data-buy-city], [data-buy-city-other], [data-buy-home]')) return;
    if ((el = t.closest('[data-buy-purpose]'))) { buy.purpose = el.getAttribute('data-buy-purpose'); renderBuyForm(); return; }
    if ((el = t.closest('[data-buy-bag]'))) { buy.bagId = el.getAttribute('data-buy-bag'); renderBuyForm(); return; }
    if ((el = t.closest('[data-buy-city-other]'))) {
      window.Clothing.askText('在哪個城市買的？', '').then(function (v) { v = (v || '').trim().slice(0, 20); if (v) { buy.city = v; renderBuyForm(); } });
      return;
    }
    if ((el = t.closest('[data-buy-city]'))) { var c = el.getAttribute('data-buy-city'); buy.city = buy.city === c ? '' : c; renderBuyForm(); return; }
    if ((el = t.closest('[data-buy-home]'))) { buy.homeDest = el.getAttribute('data-buy-home'); renderBuyForm(); return; }
    if (t.id === 'buy-save') { saveBuy(); return; }
    if (t.id === 'buy-delete') { deleteBuy(); return; }
    if (t.id === 'buy-sheet' || t.id === 'buy-cancel') $('#buy-sheet').hidden = true;
  });
  $('#buy-weight').addEventListener('input', buyTry);
  $('#buy-qty').addEventListener('input', buyTry);

  // ---------- 禮物 ----------
  var gift = null;

  function drawerGifts() {
    return st().memory.filter(function (m) { return !App.isCloth(m) && m.category === '禮物'; });
  }

  function openGift(id) {
    var t = curTrip();
    if (!t) { App.toast('請先新增一趟旅程'); return; }
    var g = id && giftById(id);
    if (g) {
      gift = JSON.parse(JSON.stringify(g));
      gift.status = giftStatus(g);
      var it = itemOfGift(g);
      gift.bagId = it ? it.bagId : (g.bagId || defaultBagId());
      gift.isNew = false;
    } else {
      gift = { id: App.uid(), tripId: t.id, name: '', weight: '', qty: 1, to: '', city: '', status: 'want', source: 'trip', drawerId: null,
        bagId: defaultBagId(), home: '', isNew: true };
    }
    $('#gift-title').textContent = gift.isNew ? '新增禮物' : '編輯禮物';
    var dm0 = gift.source === 'drawer' && gift.drawerId && App.entryById(gift.drawerId);
    if (dm0) { gift.name = dm0.name; gift.weight = dm0.weight || 0; }
    $('#gift-name').value = gift.name;
    $('#gift-weight').value = gift.weight === '' ? '' : gift.weight;
    $('#gift-qty').value = gift.qty || 1;
    $('#gift-to').value = gift.to || '';
    var names = [];
    st().gifts.forEach(function (x) { if (x.to && names.indexOf(x.to) < 0) names.push(x.to); });
    $('#gift-to-list').innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
    $('#gift-to-chips').innerHTML = names.slice(0, 8).map(function (n) {
      return '<button type="button" class="chip" data-gift-to="' + esc(n) + '">' + esc(n) + '</button>';
    }).join('');
    $('#gift-delete').hidden = gift.isNew;
    renderGiftForm();
    $('#gift-sheet').hidden = false;
    $('#gift-sheet .org-panel').scrollTop = 0;
  }

  function renderGiftForm() {
    $('#gift-source').innerHTML = SOURCES.map(function (x) {
      return '<button type="button" class="' + (gift.source === x[0] ? 'on' : '') + '" data-gift-source="' + x[0] + '">' + x[1] + '</button>';
    }).join('');
    var dg = drawerGifts();
    $('#gift-drawer-wrap').hidden = gift.source !== 'drawer';
    $('#gift-drawer').innerHTML = dg.length ? dg.map(function (m) {
      var loc = App.locOf(m);
      return '<button type="button" class="chip' + (gift.drawerId === m.id ? ' on' : '') + '" data-gift-drawer="' + esc(m.id) + '">' + esc(m.name) +
        (loc && loc.state === 'home' ? '・' + esc(loc.home) : '') + '</button>';
    }).join('') : '<p class="muted small">抽屜裡還沒有「禮物」品類的東西。</p>';
    var cities = tripCities(tripById(gift.tripId));
    if (gift.city && cities.indexOf(gift.city) < 0) cities.push(gift.city);
    chipList($('#gift-city'), cities, gift.city, 'data-gift-city', '<button type="button" class="chip" data-gift-city-other="1">其他</button>');
    $('#gift-status').innerHTML = STATUS.map(function (x) {
      return '<button type="button" class="' + (gift.status === x[0] ? 'on' : '') + '" data-gift-status="' + x[0] + '">' + x[1] + '</button>';
    }).join('');
    $('#gift-bag-wrap').hidden = gift.status !== 'packed';
    var fromDrawer = gift.source === 'drawer' && !!gift.drawerId && !!App.entryById(gift.drawerId);
    $('#gift-name').disabled = fromDrawer;
    $('#gift-weight').disabled = fromDrawer;
    $('#gift-drawer-note').hidden = !fromDrawer;
    chipList($('#gift-bag'), App.pickBags().map(function (b) { return [b.id, App.bagLabel(b)]; }), gift.bagId, 'data-gift-bag');
  }

  // 把禮物放進行李（從抽屜挑的，抽屜那件的位置也一起變成「在行李裡」）
  function packGift(g, bagId) {
    var s = st();
    var it = itemOfGift(g);
    if (!bagId) bagId = defaultBagId();
    if (!it) {
      var m = g.drawerId && App.entryById(g.drawerId);
      // 抽屜那件已經在行李裡：直接用行李裡那份，不要重複算重量
      var already = m && s.items.find(function (x) { return x.catalogId === m.id && !x.giftId; });
      if (already) {
        bagId = already.bagId;
        if ((already.qty || 1) > g.qty) {
          already.qty -= g.qty;
          it = { id: App.uid(), giftId: g.id, catalogId: m.id };
          s.items.push(it);
        } else {
          it = already;
          it.giftId = g.id;
        }
      } else {
        it = { id: App.uid(), giftId: g.id };
        if (m) it.catalogId = m.id;
        s.items.push(it);
      }
    }
    it.name = g.name; it.weight = g.weight; it.qty = g.qty; it.unit = '份'; it.category = '禮物'; it.bagId = bagId;
    var m2 = it.catalogId && App.entryById(it.catalogId);
    if (m2) App.markPacked(m2, bagId);
    g.bagId = bagId;
    g.status = 'packed';
  }

  function unpackGift(g) {
    var it = itemOfGift(g);
    if (!it) return;
    st().items = st().items.filter(function (x) { return x !== it; });
    var m = it.catalogId && App.entryById(it.catalogId);
    if (m) App.restoreHome(m);
  }

  // 送出：從行李拿掉；抽屜裡的那件數量也扣掉
  function giveGift(g) {
    var it0 = itemOfGift(g);
    var wasPacked = !!it0;
    // 打包清單上對應的那一項也拿掉（送出去了，不會再出現在「要帶什麼」）
    if (it0) (st().packLists || []).forEach(function (l) {
      l.entries = l.entries.filter(function (e) {
        if (e.itemId !== it0.id) return true;
        if (e.source === 'bag' || e.source === 'manual') return false;
        e.status = 'removed'; e.checked = false; e.itemId = null;
        return true;
      });
    });
    unpackGift(g);
    var m = g.drawerId && App.entryById(g.drawerId);
    if (m && g.status !== 'given' && m.count > 0) {
      m.count = Math.max(0, m.count - (g.qty || 1));
      if (!m.count) m.stock = 'out';
      m.updatedAt = Date.now();
    }
    g.status = 'given';
    g.givenDate = App.todayStr();
    g.home = '';   // 送出去了，不放進任何家
    return wasPacked;
  }

  function setGiftStatus(g, s, bagId) {
    if (s === 'packed') packGift(g, bagId);
    else if (s === 'given') { if (g.status !== 'given') giveGift(g); }
    else { unpackGift(g); g.status = s; g.givenDate = ''; }
    g.updatedAt = Date.now();
  }

  // ---------- 新增／修改禮物（表單和範例資料都用這裡，格式才會一樣） ----------
  // g：要修改的禮物（新增就給 null）
  // o：{ id?, tripId, name, weight(kg), qty, to, city, source('trip'|'drawer'|'home'), drawerId, status, bagId }
  function writeGift(g, o) {
    var isNew = !g;
    if (isNew) g = { id: o.id || App.uid(), tripId: o.tripId, createdAt: Date.now(), status: 'want', givenDate: '' };
    g.name = o.name;
    g.weight = num(o.weight);
    var dm = o.source === 'drawer' && o.drawerId && App.entryById(o.drawerId);
    if (dm) { g.name = dm.name; g.weight = dm.weight || 0; }
    g.qty = Math.max(1, parseInt(o.qty, 10) || 1);
    g.to = String(o.to || '').trim().slice(0, 20);
    g.city = o.city || '';
    g.source = o.source;
    g.drawerId = o.source === 'drawer' ? o.drawerId : null;
    if (isNew) st().gifts.push(g);
    var prev = giftStatus(g);
    if (prev !== o.status || o.status === 'packed') setGiftStatus(g, o.status, o.bagId);
    g.updatedAt = Date.now();
    return g;
  }

  function saveGift() {
    var name = $('#gift-name').value.trim();
    if (!name) { App.toast('請輸入禮物名稱'); return; }
    var g = gift.isNew ? null : giftById(gift.id);
    if (!gift.isNew && !g) return;
    writeGift(g, {
      id: gift.id, tripId: gift.tripId, name: name, weight: $('#gift-weight').value, qty: $('#gift-qty').value,
      to: $('#gift-to').value, city: gift.city, source: gift.source, drawerId: gift.drawerId, status: gift.status, bagId: gift.bagId
    });
    App.save();
    $('#gift-sheet').hidden = true;
    App.toast(gift.isNew ? '已新增禮物' : '已儲存');
    render();
  }

  function deleteGift() {
    var g = giftById(gift.id);
    if (!g || !confirm('要刪除禮物「' + g.name + '」嗎？（也會從行李拿出來）')) return;
    unpackGift(g);
    st().gifts = st().gifts.filter(function (x) { return x !== g; });
    App.save();
    $('#gift-sheet').hidden = true;
    App.toast('已刪除');
    render();
  }

  $('#gift-sheet').addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-gift-source]'))) { gift.source = el.getAttribute('data-gift-source'); if (gift.source === 'home' && gift.status === 'want') gift.status = 'bought'; renderGiftForm(); return; }
    if ((el = t.closest('[data-gift-drawer]'))) {
      var m = App.entryById(el.getAttribute('data-gift-drawer'));
      gift.drawerId = m.id;
      $('#gift-name').value = m.name;   // 從抽屜挑的：名稱、重量都跟抽屜那件一樣
      $('#gift-weight').value = Math.round((m.weight || 0) * 1000) / 1000;
      if (gift.status === 'want') gift.status = 'bought';
      renderGiftForm();
      return;
    }
    if ((el = t.closest('[data-gift-city-other]'))) {
      window.Clothing.askText('在哪個城市送？', '').then(function (v) { v = (v || '').trim().slice(0, 20); if (v) { gift.city = v; renderGiftForm(); } });
      return;
    }
    if ((el = t.closest('[data-gift-city]'))) { var c = el.getAttribute('data-gift-city'); gift.city = gift.city === c ? '' : c; renderGiftForm(); return; }
    if ((el = t.closest('[data-gift-to]'))) { $('#gift-to').value = el.getAttribute('data-gift-to'); return; }
    if ((el = t.closest('[data-gift-status]'))) { gift.status = el.getAttribute('data-gift-status'); renderGiftForm(); return; }
    if ((el = t.closest('[data-gift-bag]'))) { gift.bagId = el.getAttribute('data-gift-bag'); renderGiftForm(); return; }
    if (t.id === 'gift-save') { saveGift(); return; }
    if (t.id === 'gift-delete') { deleteGift(); return; }
    if (t.id === 'gift-sheet' || t.id === 'gift-cancel') $('#gift-sheet').hidden = true;
  });

  // ---------- 頁面操作 ----------
  $('#view-shop').addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-shop-tab]'))) { tab = el.getAttribute('data-shop-tab'); location.hash = tab === 'gift' ? '#shop/gift' : '#shop'; render(); return; }
    if ((el = t.closest('[data-gift-view]'))) { giftView = el.getAttribute('data-gift-view'); render(); return; }
    if ((el = t.closest('[data-plan-buy]'))) {
      var pl = sh().plans.find(function (x) { return x.id === el.getAttribute('data-plan-buy'); });
      if (!pl) return;
      if (pl.purchaseId && purchaseById(pl.purchaseId)) openBuy(pl.purchaseId); else openBuy(null, pl);
      return;
    }
    if ((el = t.closest('[data-plan-del]'))) {
      var id = el.getAttribute('data-plan-del');
      sh().plans = sh().plans.filter(function (x) { return x.id !== id; });
      App.save(); render();
      return;
    }
    if ((el = t.closest('[data-rec-filter]'))) { recFilter = el.getAttribute('data-rec-filter'); render(); return; }
    if ((el = t.closest('[data-gift-del]'))) {
      var gd = giftById(el.getAttribute('data-gift-del'));
      if (gd && confirm('要刪除「' + gd.name + '」這筆送禮紀錄嗎？')) {
        st().gifts = st().gifts.filter(function (x) { return x !== gd; });
        App.save(); render();
      }
      return;
    }
    if ((el = t.closest('[data-buy-edit]'))) { openBuy(el.getAttribute('data-buy-edit')); return; }
    if ((el = t.closest('[data-gift-act]'))) {
      var g = giftById(el.getAttribute('data-gift-id'));
      var act = el.getAttribute('data-gift-act');
      if (!g) return;
      if (act === 'given') {
        if (!confirm('「' + g.name + '」' + (g.to ? '已經送給' + g.to : '已經送出') + '了嗎？會從行李拿出來。')) return;
        setGiftStatus(g, 'given');
        App.toast('已送出，行李少了 ' + App.fmtWeight(g.weight * g.qty));
      } else if (act === 'pack') { setGiftStatus(g, 'packed', g.bagId); App.toast('已放進' + bagName(itemOfGift(g).bagId)); }
      else { setGiftStatus(g, 'bought'); App.toast('已買好：' + g.name); }
      App.save(); render();
      return;
    }
    if ((el = t.closest('[data-gift-edit]'))) { openGift(el.getAttribute('data-gift-edit')); return; }
    if (t.id === 'shop-record') { openBuy(null); return; }
    if (t.id === 'gift-add') { openGift(null); return; }
  });

  $('#shop-trip').addEventListener('change', function () { tripId = this.value; render(); });
  $('#shop-try').addEventListener('input', renderTry);

  // 整理行李用：這筆行李物品是購物或禮物時的資訊
  function itemInfo(it) {
    if (it.purchaseId) { var p = purchaseById(it.purchaseId); return p ? { kind: 'buy', homeDest: p.homeDest, rec: p } : null; }
    if (it.giftId) { var g = giftById(it.giftId); return g ? { kind: 'gift', rec: g } : null; }
    return null;
  }

  // 整理行李時留在某個家：購物放進那個家的抽屜；禮物記成「已買好、在那個家」
  function leftAtHome(it, home, date) {
    var info = itemInfo(it);
    if (!info) return;
    if (info.kind === 'buy') {
      var p = info.rec;
      if (purposeOf(p) === 'souvenir') { p.unpackedHome = home; p.unpackedDate = date; return; }   // 紀念品不進衣櫃或抽屜
      p.placedHome = home;
      if (!it.catalogId) {
        st().memory.push(App.normalizeEntry({
          photoId: p.photoId || null,
          name: p.name, weight: p.weight, unit: '個', category: p.category || '必備品', uses: 0, estimated: false,
          home: home, count: p.qty, countUnit: '個', stock: '', drawer: true, fromPurchase: p.id,
          location: { state: 'home', home: home, since: date }, moves: [{ home: home, date: date }]
        }));
      }
    } else {
      var g = info.rec;
      g.status = 'bought'; g.home = home; g.updatedAt = Date.now();
    }
  }

  // 從首頁旅程卡進來：直接看那一趟的購物和送禮
  function openTrip(id) {
    if (tripById(id)) tripId = id;
    location.hash = '#shop';
  }

  // 抵達任何一個家：紀念品自動從行李拿出來（不進衣櫃或抽屜，只留購物紀錄）
  function isSouvenirItem(it) { var i = itemInfo(it); return !!(i && i.kind === 'buy' && purposeOf(i.rec) === 'souvenir'); }
  function dropSouvenirs(home, date) {
    var s = st(), n = 0;
    s.items = s.items.filter(function (it) {
      if (!isSouvenirItem(it)) return true;
      var p = itemInfo(it).rec;
      p.unpackedHome = home; p.unpackedDate = date; p.updatedAt = Date.now();
      n++;
      return false;
    });
    return n;
  }

  window.Shop = {
    show: show, writePurchase: writePurchase, writeGift: writeGift, openTrip: openTrip, renderHomeBits: renderHomeBits, openBuy: openBuy, giftsHere: giftsHere,
    itemInfo: itemInfo, leftAtHome: leftAtHome, isSouvenirItem: isSouvenirItem, dropSouvenirs: dropSouvenirs
  };
})();
