/*
 * 試用範例資料（只在「範例模式」使用）
 *
 * ⚠ 維護規則：每次新增或修改功能、欄位、選項，都要回來檢查這個檔案，
 *   讓範例能示範到最新的功能。範例一律透過各功能「自己的新增函式」產生
 *   （Closet.create、Drawer.create、Bags.create、Trips.create、Packing.prepareTrip、
 *   Shop.writePurchase、Shop.writeGift、Onboard.setDefaults、App.addHome、App.addMust），跟使用者在畫面上新增的資料格式完全一樣，
 *   不要在這裡另外手寫資料結構。
 *
 * 內容都是虛構的；使用台灣用語，不出現中國大陸的城市名稱。
 * 範例資料只存在這台裝置（另一個儲存位置），不會同步到雲端，也不會跟自己的資料混在一起。
 */
(function () {
  'use strict';

  // ================= 範例內容（要改範例，改這一段就好） =================

  // 範例使用者的家
  // 範例使用者的家：家的名字可以自由取，判斷抵達哪個家用「所在城市」
  var HOMES = [{ name: '台北', city: '台北' }, { name: '東京的公寓', city: '東京' }];
  var TOKYO = '東京的公寓';   // 下面「放在哪個家」用的是家的名字

  // 第一次使用設定裡的「常搭的航空公司和行李額度」：新增旅程時第一段會自動帶入
  var DEFAULTS = { airline: '長榮航空', checked: 23, carry: 7, personal: '' };

  // 衣櫃：沒有照片，畫面會用第一個顏色畫成色塊；不放品牌
  // group／type／subtype 要用 clothing.js 裡的選項
  var CLOSET = [
    { name: '白色 T 恤', group: '上衣', type: 'T 恤', colors: ['白'], home: '台北', weight: 0.2 },
    { name: '牛仔褲', group: '下身', type: '牛仔褲', colors: ['藍'], home: '台北', weight: 0.6 },
    { name: '米色針織衫', group: '上衣', type: '針織衫', colors: ['米'], home: '台北', weight: 0.35 },
    { name: '風衣', group: '外套', type: '外套', colors: ['咖啡'], home: '台北', weight: 0.8 },
    { name: '白色運動鞋', group: '鞋子', type: '運動鞋', subtype: '休閒運動鞋', colors: ['白'], home: '台北', weight: 0.7 },
    { name: '黑色樂福鞋', group: '鞋子', type: '平底鞋', subtype: '樂福鞋', colors: ['黑'], home: TOKYO, weight: 0.6 },
    { name: '棒球帽', group: '帽子', type: '棒球帽', colors: ['海軍藍'], home: TOKYO, weight: 0.1 },
    { name: '金色耳環', group: '配件', type: '耳環', colors: ['金色'], home: '台北', weight: 0.02 },
    { name: '黑色洋裝', group: '洋裝／連身', type: '', colors: ['黑'], home: TOKYO, weight: 0.35 },
    { name: '藍色襯衫', group: '上衣', type: '襯衫', colors: ['藍'], home: TOKYO, weight: 0.25 }
  ];

  // 抽屜：分別放在台北和東京的公寓；count 空白代表「有，不記數量」
  var DRAWER = [
    { key: 'passport', name: '護照', category: '必備品', weight: 0.04, home: '台北', unit: '本' },
    { name: '錢包', category: '必備品', weight: 0.15, home: '台北', unit: '個' },
    { name: '充電線', category: '電線電器', weight: 0.05, home: '台北', count: 1, unit: '包' },
    { name: '轉接頭', category: '電線電器', weight: 0.06, home: TOKYO, count: 2, unit: '個' },
    { name: '洗面乳', category: '保養品', weight: 0.12, home: TOKYO, count: 1, unit: '條' },
    { name: '面膜', category: '保養品', weight: 0.03, home: '台北', count: 5, unit: '片' },
    { name: '維他命', category: '保健品', weight: 0.15, home: '台北', count: 1, unit: '瓶' },
    { name: '牙刷組', category: '必備品', weight: 0.05, home: TOKYO, count: 1, unit: '組' },
    { key: 'cake', name: '鳳梨酥禮盒', category: '禮物', weight: 0.5, home: '台北', count: 1, unit: '盒' }
  ];

  // 行李箱：kind = pouch 隨身小包／personal 背包／carry 手提／checked 托運
  // 東京的家另外放一個托運箱，示範到東京可以換行李箱
  var BAGS = [
    { key: 'checked', name: '28 吋托運箱', kind: 'checked', tare: 4.5, size: '28 吋', style: '五五開', material: '硬箱', home: '台北' },
    { key: 'carry', name: '20 吋登機箱', kind: 'carry', tare: 2.6, size: '20 吋', style: '五五開', material: '硬箱', home: '台北' },
    { key: 'personal', name: '後背包', kind: 'personal', tare: 0.8, material: '布箱', home: '台北' },
    { key: 'pouch', name: '隨身小包', kind: 'pouch', tare: 0.3, material: '布箱', home: '台北' },
    { key: 'tokyo', name: '東京的托運箱', kind: 'checked', tare: 4.2, size: '28 吋', style: '三七開', material: '硬箱', home: TOKYO }
  ];

  // 旅程：下個月 10 號出發，大約 8 天（day = 第幾天出發）
  // 台北 → 東京（直飛，在東京的家停留、可以換行李箱）→ 首爾 → 台北（在大阪轉機，行李直掛）
  var ALLOW = { checked: 23, carry: 7, personal: 5 };
  var TRIP = {
    name: '台北・東京・首爾', origin: '台北', endHome: '台北', pouchMode: 'personal', seasons: ['冬'], activities: [],
    shopGoal: 5,   // 首頁的購物目標：留 5 公斤給回程購物
    legs: [
      { day: 0, from: '台北', to: '東京', depTime: '08:50', arrTime: '13:05', flightNo: 'BR198', airline: '長榮航空', allowance: ALLOW,
        connection: { baggage: 'recheck', mode: 'enter', stayDays: 4, note: '在東京的家停留，可以換行李箱' } },
      { day: 4, to: '首爾', depTime: '10:20', arrTime: '12:50', flightNo: 'JL95', airline: '日本航空', allowance: ALLOW,
        connection: { baggage: 'recheck', mode: 'enter', stayDays: 3, note: '去首爾找朋友' } },
      { day: 7, to: '大阪', depTime: '09:10', arrTime: '10:55', flightNo: 'CI171', airline: '中華航空', allowance: ALLOW,
        connection: { baggage: 'through', mode: 'transit' } },
      { day: 7, to: '台北', depTime: '13:00', arrTime: '15:05', flightNo: 'CI153', airline: '中華航空', allowance: ALLOW }
    ]
  };

  // 必帶清單：預設內容（護照、錢包、手機、行動電源…）之外，示範自己加一樣
  var MUST_EXTRA = [{ name: '眼罩', zone: 'personal', weight: 0.02 }];

  // 這趟用哪幾個行李箱（對應上面 BAGS 的 key）
  var PACK_ZONES = { pouch: 'pouch', personal: 'personal', carry: 'carry', checked: 'checked' };
  // 打包清單：會依照衣櫃、季節和必帶清單自動列出（分頁一「要帶什麼」）；另外用「＋ 加入」加進這幾樣抽屜裡的東西
  // 打勾的會移到分頁二「行李箱」，每個箱子標題旁顯示還能放多少
  var ADD_TO_LIST = ['面膜', '維他命'];
  // 已經打勾（放進行李）的東西，其他的還沒打勾
  var PACKED = ['護照', '錢包', '白色 T 恤', '牛仔褲', '充電線', '白色運動鞋'];

  // 在東京買一件衣服（第 2 天）
  var PURCHASES = [
    { day: 2, name: '羊毛圍巾', weight: 0.2, qty: 1, price: '¥3,990', category: '必備品', city: '東京', homeDest: '台北', bag: 'checked' }
  ];

  // 帶一盒鳳梨酥（抽屜裡的那盒）送首爾的朋友，已經放進行李
  var GIFTS = [
    { drawer: 'cake', qty: 1, to: '首爾的朋友 敏智', city: '首爾', status: 'packed', bag: 'checked' }
  ];

  // ================= 產生範例（用各功能自己的新增函式） =================

  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var PART = { '上衣': 'top', '下身': 'bottom', '洋裝／連身': 'full', '外套': 'outer', '鞋子': 'shoes', '帽子': 'hat', '配件': 'accessory' };

  function build() {
    var s = App.state();
    var now = new Date(), base = new Date(now.getFullYear(), now.getMonth() + 1, 10);
    function day(n) { var d = new Date(base); d.setDate(d.getDate() + n); return ymd(d); }

    s.homes = []; s.homeCities = {};
    HOMES.forEach(function (h) { App.addHome(h.name, h.city); });
    window.Onboard.setDefaults(DEFAULTS.airline, DEFAULTS.checked, DEFAULTS.carry, DEFAULTS.personal);

    CLOSET.forEach(function (c) {
      var tags = window.Clothing.empty();
      tags.group = c.group; tags.type = c.type || ''; tags.subtype = c.subtype || ''; tags.colors = c.colors.slice();
      tags.home = c.home; tags.part = PART[c.group] || '';
      window.Closet.create({ name: c.name, weight: c.weight, estimated: true, tags: tags, extra: { sample: true } });
    });

    var drawerIds = {};
    DRAWER.forEach(function (d) {
      var m = window.Drawer.create({ name: d.name, weight: d.weight, unit: d.unit, category: d.category, estimated: true,
        home: d.home, count: d.count, extra: { sample: true } });
      if (d.key) drawerIds[d.key] = m.id;
    });

    var bagIds = {};
    BAGS.forEach(function (b) {
      bagIds[b.key] = window.Bags.create({ name: b.name, kind: b.kind, tare: b.tare, size: b.size || '', style: b.style || '',
        material: b.material || '', home: b.home, extra: { sample: true } }).id;
    });

    // 必帶清單（產生打包清單前先加好，才會自動放進「要帶什麼」）
    MUST_EXTRA.forEach(function (m) { App.addMust(m.name, m.zone, m.weight); });

    var trip = window.Trips.create({
      id: 'sample-trip', name: TRIP.name, origin: TRIP.origin, endHome: TRIP.endHome, pouchMode: TRIP.pouchMode,
      seasons: TRIP.seasons, activities: TRIP.activities, shopGoal: TRIP.shopGoal,
      legs: TRIP.legs.map(function (l) {
        var o = {}; Object.keys(l).forEach(function (k) { if (k !== 'day') o[k] = l[k]; });
        o.date = day(l.day);
        return o;
      })
    });
    trip.sample = true;

    var zones = {};
    Object.keys(PACK_ZONES).forEach(function (k) { zones[k] = bagIds[PACK_ZONES[k]]; });
    window.Packing.prepareTrip(trip, zones, PACKED, ADD_TO_LIST);

    PURCHASES.forEach(function (p) {
      window.Shop.writePurchase(null, { tripId: trip.id, date: day(p.day), name: p.name, weight: p.weight, qty: p.qty, price: p.price,
        category: p.category, city: p.city, homeDest: p.homeDest, bagId: bagIds[p.bag] });
    });

    GIFTS.forEach(function (g) {
      var m = App.entryById(drawerIds[g.drawer]);
      window.Shop.writeGift(null, { tripId: trip.id, name: m.name, weight: m.weight, qty: g.qty, to: g.to, city: g.city,
        source: 'drawer', drawerId: m.id, status: g.status, bagId: bagIds[g.bag] });
    });

    s.onboarded = true;
    s.sampleBuilt = true;
    App.save();
  }

  window.SampleData = { build: build, homes: HOMES.map(function (h) { return h.name; }) };
})();
