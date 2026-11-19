(function () {
  'use strict';

  var STORE_KEY = 'luggage-app-v1';
  // 七大品類：name 存進資料，hint 只在選單裡提示
  var CATEGORY_LIST = [
    { name: '必備品', hint: '護照、現金、信用卡、簽證、衣服、鞋子配件' },
    { name: '保健品', hint: '保健食品與藥品' },
    { name: '保養品', hint: '臉部、身體、手部' },
    { name: '特殊類', hint: '騎馬、打網球等活動用品' },
    { name: '禮物', hint: '' },
    { name: '食品', hint: '' },
    { name: '電線電器', hint: '' }
  ];
  var CATEGORIES = CATEGORY_LIST.map(function (c) { return c.name; });
  var NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];
  // 第一版的舊品類，對應到新的七大品類
  var OLD_CATEGORY_MAP = {
    '衣物': '必備品', '證件文件': '必備品', '其他': '必備品',
    '藥品': '保健品', '盥洗用品': '保養品',
    '伴手禮': '禮物', '食品': '食品', '電子產品': '電線電器'
  };
  // 剩餘比例低於這個值就顯示黃色
  var WARN_RATIO = 0.2;

  // ---------- 資料 ----------
  /*
   * 存在 localStorage（luggage-app-v1）的資料結構，第 2 版：
   *
   * bags   行李：{ id, name, kind, limit(上限 kg), tare(空箱 kg) }
   *          kind：pouch 隨身小包、personal 背包／個人物品、carry 手提、checked 托運
   *          auto：true＝「尚未選擇行李箱」的占位（空箱算 0，不出現在行李箱設定）
   *          limit：沒有排行程時使用的上限；有下一段航班時改用那段的額度
   * items  行李裡的東西：{ id, name, weight(每單位 kg), qty, unit, category, bagId, catalogId }
   *          catalogId：對應到 memory 裡的哪一件（用來顯示照片）
   * memory 常帶物品＝我擁有的東西，「我的衣櫃」也是從這裡來：
   *          { id, name, weight, unit, category, bagId, uses, estimated,
   *            photoId,   照片的 id（iPad 上的暫存用這個 id），沒有照片是 null
   *            photoPath, 照片在 Supabase Storage 的路徑：item-photos 裡的 <帳號 id>/<照片 id>.jpg（登入同步後才有）
   *            clothing,  衣服標籤，不是衣服是 null（格式見 clothing.js）
   *            createdAt, updatedAt,
   *            cloudId, syncedAt,  預留：雲端儲存
   *            ai,                 預留：AI 辨識結果 { colors, pattern, group, type, confidence, model, at }
   *            location, moves,    位置與移動紀錄（見下方「物品位置」；衣物和抽屜物品都有）
   *            home,               抽屜物品放在哪個家（衣物記在 clothing.home）
   *            count, countUnit,   抽屜物品的數量（例如 5、'片'）；用「有／快用完／沒了」時 count 是 null
   *            stock }             'have' 有、'low' 快用完、'out' 沒了
   * outfits 預留（舊欄位，沒有使用）
   * dayPlans 每日穿搭：{ 旅程 id: { 日期: { acts[]（null＝預設）, picks{部位: 衣物 id}, chosen{部位: true 自己滑過}, locks{部位: true}, form（dress／sep）, seed, confirmed } } }
   * sync    預留：雲端帳號 { userId, lastSyncedAt }
   * homes   「家」的清單，衣服標籤的 clothing.home 會是其中之一
   * customOptions  在「其他」自己輸入過的選項：{ 'colors@配件/皮帶': ['酒紅'], … }
   * packLists  打包清單，每趟旅程一份（格式見 packing.js）
   * bags 也是「我的行李箱」：另有 size 尺寸、style 款式、material 材質、home 放在哪個家、photoId／photoPath 照片
   *          位置：箱子裡有東西＝跟著旅程出門；空的＝在它的家
   * shopping  回程購物：{ plans[], purchases[], ratio{ 旅程 id: 計畫購物佔比 0–1 } }（格式見 shop.js）
   * gifts     送禮：[{ id, name, weight, qty, to, city, tripId, status, source, … }]（格式見 shop.js）
   *          行李清單（items）裡的 giftId／purchaseId 連到禮物或購物紀錄
   * legacyWardrobe 上一版衣櫃的原始資料，留著備份
   * trips  旅程：{ id, name, origin, endHome, legs[], createdAt, updatedAt,
   *            endHome：最後一段結束後回到哪個家（null＝還沒設定，依最後一段抵達城市判斷；''＝未定／不回家）
   *            source,     來源：manual 手動、import 匯入訂位紀錄、ai 行程單截圖辨識（預留）
   *            importRef,  預留：匯入資訊 { platform, bookingCode, importedAt, raw }
   *            ownerId, members[], shareCode,  預留：多人共用同一份行程
   *            cloudId, syncedAt }             預留：雲端
   *          legs 航班段：{ id, from, to, date(起飛日期 YYYY-MM-DD), depTime, arrDate, arrTime(當地時間 HH:MM), flightNo, airline,
   *            connection: { baggage: through 直掛／recheck 領出, mode: transit 不入境／enter 入境停留, stayDays, note }
   *              （抵達這段的終點後、轉下一段時的設定；最後一段不用）
   *            allowance: { checked, carry, personal, pouch }（公斤；空白＝尚未設定額度，0＝這段沒有這項額度；
   *              pouch 只在旅程的 pouchMode＝separate 時用）,
   *            bookingCode,  預留：訂位代號
   *            ai }          預留：AI 辨識結果 { confidence, fromImage, at }
   *
   * 照片本身存在 IndexedDB（見 photos.js），不放在 localStorage。
   */
  var SCHEMA_VERSION = 2;
  // 「家」是每個帳號自己的清單（第一次使用時設定，帳號選單裡可以新增、改名、刪除）。
  // 這三個只用在很舊、還沒有存「家」清單的資料，讓那時候的資料不會遺失；新帳號從空的開始
  var DEFAULT_HOMES = ['曼谷', '台灣', '昆明'];
  // 每趟必帶清單（預設內容；帳號選單裡可以增加、刪除、改預設行李）
  // id 固定：兩台裝置各自建立預設清單時，雲端合併不會重複
  // zone：pouch 隨身小包／personal 背包／carry 手提／checked 托運（這趟沒帶托運時會改放背包）
  var DEFAULT_MUST = [
    ['must-passport', '護照', 'pouch', 0.04], ['must-wallet', '錢包', 'pouch', 0.15], ['must-phone', '手機', 'pouch', 0.2], ['must-card', '信用卡／現金', 'pouch', 0.05],
    ['must-powerbank', '行動電源', 'carry', 0.2], ['must-cable', '充電線一包', 'carry', 0.15], ['must-earphone', '耳機', 'carry', 0.05],
    ['must-adapter', '轉接頭', 'checked', 0.1], ['must-toothbrush', '牙刷', 'checked', 0.03], ['must-pajamas', '睡衣', 'checked', 0.35],
    ['must-underwear', '內衣褲', 'checked', 0.2], ['must-socks', '襪子', 'checked', 0.1], ['must-medicine', '常備藥', 'checked', 0.1], ['must-skincare', '基本保養品', 'checked', 0.3]
  ];
  function defaultMust() { return DEFAULT_MUST.map(function (x) { return { id: x[0], name: x[1], zone: x[2], weight: x[3] }; }); }

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      bags: [],   // 行李箱由你自己在「家 → 行李箱」新增；還沒選時顯示「尚未選擇行李箱」
      items: [],
      memory: [],
      outfits: [],
      homes: [],
      trips: [],
      sync: { userId: null, lastSyncedAt: null },
      pristine: true   // 剛裝好、還沒動過：第一次登入雲端時直接用雲端的資料（不會多出預設的行李）
    };
  }

  // 補齊常帶物品的欄位
  // 依行李名稱猜類型（隨身小包、背包、手提、托運）
  function guessBagKind(name) {
    name = String(name || '');
    if (/小包|腰包|斜背|胸包|pouch/i.test(name)) return 'pouch';
    if (/背包|個人|后背|後背|包包/.test(name)) return 'personal';
    if (/登機|手提|隨身|carry/i.test(name)) return 'carry';
    return 'checked';
  }
  // 四種行李，首頁和打包清單都照這個順序
  var BAG_KINDS = [['pouch', '隨身小包'], ['personal', '背包'], ['carry', '手提'], ['checked', '托運']];
  function kindName(k) { return (BAG_KINDS.find(function (x) { return x[0] === k; }) || [, ''])[1]; }

  // 「尚未選擇行李箱」：每種行李一個占位（id 固定，兩台裝置合併不會重複），空箱重量算 0，不會出現在行李箱設定裡
  function autoBag(kind) {
    var b = state.bags.find(function (x) { return x.id === 'auto-' + kind; }) ||
      state.bags.find(function (x) { return x.auto && x.kind === kind; });
    if (!b) { b = normalizeBag({ id: 'auto-' + kind, name: kindName(kind), kind: kind, tare: 0, auto: true }); state.bags.push(b); }
    return b;
  }

  // 隨身小包的重量算在哪一項額度：依行程設定（預設算進背包／個人物品）；不計算時回傳 null
  function groupOf(kind, trip) {
    if (kind !== 'pouch') return kind;
    var m = (trip && trip.pouchMode) || 'personal';
    return m === 'separate' ? 'pouch' : m === 'none' ? null : 'personal';
  }

  // 行李箱的欄位
  function normalizeBag(b) {
    if (!b.id) b.id = uid();
    if (!b.kind) b.kind = guessBagKind(b.name);
    ['size', 'style', 'material', 'home'].forEach(function (k) { if (b[k] == null) b[k] = ''; });
    if (b.tare == null) b.tare = 0;
    if (b.limit == null) b.limit = '';   // 舊欄位：額度現在一律讀行程設定
    if (b.photoId === undefined) b.photoId = null;
    if (b.photoPath === undefined) b.photoPath = null;
    return b;
  }

  function normalizeTrip(t) {
    if (!t.id) t.id = uid();
    if (!Array.isArray(t.legs)) t.legs = [];
    t.legs.forEach(normalizeLeg);
    ['name', 'origin'].forEach(function (k) { if (t[k] == null) t[k] = ''; });
    if (!t.createdAt) t.createdAt = Date.now();
    if (!t.updatedAt) t.updatedAt = t.createdAt;
    if (!t.source) t.source = 'manual';
    if (t.importRef === undefined) t.importRef = null;
    if (t.ownerId === undefined) t.ownerId = null;
    if (!Array.isArray(t.members)) t.members = [];
    if (t.shareCode === undefined) t.shareCode = null;
    if (t.cloudId === undefined) t.cloudId = null;
    if (t.syncedAt === undefined) t.syncedAt = null;
    if (t.endHome === undefined) t.endHome = null;
    if (!t.pouchMode) t.pouchMode = 'personal';   // 隨身小包：personal 算進背包額度／separate 單獨計算／none 不計算
    return t;
  }

  function normalizeLeg(l) {
    if (!l.id) l.id = uid();
    ['from', 'to', 'date', 'depTime', 'arrDate', 'arrTime', 'flightNo', 'airline'].forEach(function (k) { if (l[k] == null) l[k] = ''; });
    if (!l.connection) l.connection = { baggage: '', mode: '', stayDays: '', note: '' };
    if (!l.allowance) l.allowance = { checked: '', carry: '', personal: '' };
    if (l.allowance.pouch === undefined) l.allowance.pouch = '';
    if (l.bookingCode === undefined) l.bookingCode = null;
    if (l.ai === undefined) l.ai = null;
    return l;
  }

  function normalizeEntry(m) {
    if (!m.id) m.id = uid();
    if (m.photoId === undefined) m.photoId = null;
    if (m.photoPath === undefined) m.photoPath = null;
    if (m.clothing === undefined) m.clothing = null;
    if (!m.createdAt) m.createdAt = Date.now();
    if (!m.updatedAt) m.updatedAt = m.createdAt;
    if (m.cloudId === undefined) m.cloudId = null;
    if (m.syncedAt === undefined) m.syncedAt = null;
    if (m.ai === undefined) m.ai = null;
    return m;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- 範例模式 ----------
  // 範例資料放在這台裝置另一個地方（不是 luggage- 開頭，備份也不會帶到），不同步到雲端，
  // 也完全不讀寫使用者自己的資料；清除範例＝刪掉這份、回到自己的資料
  var SAMPLE_MODE_KEY = 'cmo-sample-mode', SAMPLE_STATE_KEY = 'cmo-sample-state';
  var AUTH_KEY = 'sb-luggage-auth';   // 雲端登入（Supabase）存在這台裝置的登入資訊
  function signedIn() { try { return !!localStorage.getItem(AUTH_KEY); } catch (e) { return false; } }
  // 這次打開時顯示範例嗎？沒有登入 → 一律顯示範例；已登入但選了「再看一次範例」→ 也是範例。
  // 重新載入前不會變（畫面上的資料和存檔位置一致）；你自己的資料留在原處、不會顯示也不會被改動
  var BOOT_SAMPLE = (function () {
    try { return localStorage.getItem(SAMPLE_MODE_KEY) === '1' || !localStorage.getItem(AUTH_KEY); } catch (e) { return false; }
  })();
  function sampleMode() { return BOOT_SAMPLE; }
  function dataKey() { return sampleMode() ? SAMPLE_STATE_KEY : STORE_KEY; }
  function enterSample() {
    try { localStorage.setItem(SAMPLE_MODE_KEY, '1'); localStorage.removeItem(SAMPLE_STATE_KEY); } catch (e) { toast('這台裝置沒辦法開範例（可能是私密瀏覽）'); return; }
    location.hash = '#home';
    location.reload();
  }
  // 登出：清掉這台裝置上這個帳號的本機資料（localStorage 的 luggage- 開頭資料）和照片暫存（IndexedDB）
  // 雲端資料不動；範例資料不是帳號的資料，不在這裡清
  function clearLocalData() {
    locked = true;
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('luggage-') === 0 || k === 'cmo-after-sample')) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
      // 範例也重新產生一份乾淨的（範例裡不會留下任何你自己輸入的東西）
      localStorage.removeItem(SAMPLE_STATE_KEY);
      localStorage.removeItem(SAMPLE_MODE_KEY);
    } catch (e) { /* 不影響 */ }
    return (window.Photos && window.Photos.clearAll ? window.Photos.clearAll() : Promise.resolve()).catch(function () {});
  }
  // 登入時裝置上有範例：先清掉範例再重新載入，雲端的資料才不會跟範例混在一起
  function dropSample() {
    try { localStorage.removeItem(SAMPLE_MODE_KEY); localStorage.removeItem(SAMPLE_STATE_KEY); } catch (e) { /* 不影響 */ }
    locked = true;
    location.hash = '#home';
    location.reload();
  }
  function exitSample() {
    try {
      localStorage.removeItem(SAMPLE_STATE_KEY);
      localStorage.removeItem(SAMPLE_MODE_KEY);
      localStorage.setItem('cmo-after-sample', '1');   // 回到自己的資料後，接著進入第一次使用設定
    } catch (e) { /* 不影響 */ }
    location.hash = '#home';
    location.reload();
  }

  function load() {
    try {
      var raw = localStorage.getItem(dataKey());
      if (raw) {
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.bags) && Array.isArray(s.items) && Array.isArray(s.memory)) return migrate(s);
      }
    } catch (e) { /* 讀不到就用預設值 */ }
    return migrate(defaultState());   // 補齊所有欄位（打包清單、購物、禮物…）
  }

  function migrate(s) {
    s.items.concat(s.memory).forEach(function (x) {
      if (CATEGORIES.indexOf(x.category) < 0) x.category = OLD_CATEGORY_MAP[x.category] || '必備品';
    });
    s.memory.forEach(normalizeEntry);

    // 上一版的「我的衣櫃」：每件衣服轉成一筆常帶物品，照片 id 沿用，原始資料留作備份
    if (Array.isArray(s.wardrobe)) {
      s.wardrobe.forEach(function (w) {
        if (s.memory.some(function (m) { return m.id === w.id; })) return;
        var tags = window.Clothing ? window.Clothing.fromOld(w) : null;
        var name = [w.brand, (w.colors || []).join('/'), w.type].filter(Boolean).join(' ') || '衣服';
        s.memory.push(normalizeEntry({
          id: w.id, name: name, weight: w.weight != null ? w.weight : 0.2, unit: '個', category: '必備品',
          bagId: s.bags[0] && s.bags[0].id, uses: 0, estimated: !w.weightByUser,
          photoId: w.id, clothing: tags, createdAt: w.createdAt || Date.now()
        }));
      });
      s.legacyWardrobe = (s.legacyWardrobe || []).concat(s.wardrobe);
      delete s.wardrobe;
    }
    // 衣服標籤升級到第 3 版（帽子、圍巾從配件獨立出來、鞋子改成大類＋款式）
    s.memory.forEach(function (m) {
      if (m.clothing && window.Clothing) window.Clothing.upgrade(m.clothing);
    });
    s.items.forEach(function (it) {
      if (it.wardrobeId) { it.catalogId = it.wardrobeId; delete it.wardrobeId; }
    });

    if (!Array.isArray(s.outfits)) s.outfits = [];
    if (!Array.isArray(s.homes)) s.homes = DEFAULT_HOMES.slice();
    if (!s.customOptions || typeof s.customOptions !== 'object') s.customOptions = {};
    if (!Array.isArray(s.packLists)) s.packLists = [];
    if (!s.dayPlans || typeof s.dayPlans !== 'object' || Array.isArray(s.dayPlans)) s.dayPlans = {};
    if (!s.prefs || typeof s.prefs !== 'object' || Array.isArray(s.prefs)) s.prefs = {};
    if (!s.cityAvail || typeof s.cityAvail !== 'object' || Array.isArray(s.cityAvail)) s.cityAvail = { byCountry: {}, byCity: {} };   // 城市當地好不好買
    // 衣服標籤新版：顏色補上三種之一（深色／淺色／大地色，詳細顏色保留）、場合「度假」轉成「休閒」
    if (window.Clothing && window.Clothing.fixTags) (s.memory || []).forEach(function (m) { if (m && m.clothing) window.Clothing.fixTags(m.clothing); });   // 個人設定：lang 語言（zh／en），跟著雲端同步
    s.bags.forEach(normalizeBag);
    // 以前 app 自己建立的預設行李（托運行李 4 kg、登機箱 2.5 kg、打包清單自動建立的 0 kg）不是你選的行李箱：
    // 改成「尚未選擇行李箱」（資料保留，空箱不算，等你選真正用的行李箱）
    s.bags.forEach(function (b) {
      if (b.auto) return;
      var plain = !b.size && !b.style && !b.material && !b.home && !b.photoId;
      var t = Number(b.tare) || 0;
      if (plain && ((b.name === '托運行李' && (t === 4 || t === 0)) || (b.name === '登機箱' && (t === 2.5 || t === 0)) ||
          ((b.name === '手提行李' || b.name === '背包') && t === 0))) b.auto = true;
    });
    if (!s.shopping || typeof s.shopping !== 'object') s.shopping = {};
    if (!Array.isArray(s.shopping.plans)) s.shopping.plans = [];
    if (!Array.isArray(s.shopping.purchases)) s.shopping.purchases = [];
    if (!s.shopping.ratio || typeof s.shopping.ratio !== 'object') s.shopping.ratio = {};
    if (!Array.isArray(s.gifts)) s.gifts = [];
    if (!Array.isArray(s.trips)) s.trips = [];
    s.trips.forEach(normalizeTrip);
    // 必帶清單：以前沒有 → 用預設內容（之後你刪光了也不會再自動加回來）
    if (!Array.isArray(s.mustList)) s.mustList = defaultMust();
    // 家的所在城市：以前沒有這個欄位，所在城市先用家的名字（例如曼谷、台北），不會遺失
    if (!s.homeCities || typeof s.homeCities !== 'object' || Array.isArray(s.homeCities)) s.homeCities = {};
    s.homes.forEach(function (h) { if (!s.homeCities[h]) s.homeCities[h] = h; });
    // 旅程已經刪掉、畫面上看不到的購物、禮物、打包清單：一併清理（放進家裡的物品會留著）
    var tripIds = {};
    s.trips.forEach(function (t) { tripIds[t.id] = true; });
    var orphan = {};
    function lost(id) { if (id && !tripIds[id]) orphan[id] = true; }
    s.shopping.purchases.forEach(function (x) { lost(x.tripId); });
    s.shopping.plans.forEach(function (x) { lost(x.tripId); });
    s.gifts.forEach(function (x) { lost(x.tripId); });
    s.packLists.forEach(function (x) { lost(x.id); });
    Object.keys(s.shopping.ratio).forEach(lost);
    Object.keys(s.dayPlans).forEach(lost);
    Object.keys(orphan).forEach(function (id) { purgeTripData(s, id); });
    s.bags.forEach(function (b) { if (!b.kind) b.kind = guessBagKind(b.name); });
    // 首頁原本填的額度：搬到行程裡還沒填的航班段（只做一次；填過或填 0 的不動）
    if (!s.allowanceMoved) {
      s.trips.forEach(function (t) {
        t.legs.forEach(function (l) {
          ['checked', 'carry', 'personal'].forEach(function (k) {
            var v = l.allowance[k];
            if (v !== '' && v != null) return;
            var bags = s.bags.filter(function (b) { return b.kind === k; });
            if (!bags.length) return;
            l.allowance[k] = bags.reduce(function (sum, b) { return sum + (Number(b.limit) || 0); }, 0);
          });
        });
      });
      s.allowanceMoved = true;
    }
    if (!s.sync) s.sync = { userId: null, lastSyncedAt: null };
    // 已經有資料的帳號不用再看「第一次使用設定」
    if (s.onboarded == null) s.onboarded = !isEmptyState(s);
    s.schemaVersion = SCHEMA_VERSION;
    return s;
  }

  // 登出清資料後到重新載入前，不再寫入任何資料（避免把剛清掉的資料又存回去）
  var locked = false;
  function save() {
    if (locked) return;
    delete state.pristine;
    try { localStorage.setItem(dataKey(), JSON.stringify(state)); }
    catch (e) { toast('無法儲存（瀏覽器可能在私密模式）'); }
    // 有登入雲端的話，稍後自動同步（範例模式不同步）
    if (window.Cloud && !sampleMode()) window.Cloud.schedule();
    // 有設預留空間：打包快吃到預留空間就提醒
    clearTimeout(goalTimer);
    goalTimer = setTimeout(function () { checkGoals(false); }, 50);
  }
  var goalTimer = null;

  // 存檔但不觸發同步（雲端同步自己用）
  function saveQuiet() {
    if (locked) return;
    try { localStorage.setItem(dataKey(), JSON.stringify(state)); } catch (e) { /* 下次再存 */ }
  }

  // 雲端合併後套用到這台裝置（不會再觸發同步）
  function replaceState(next) {
    if (sampleMode()) return;   // 範例模式中不接收雲端的資料
    state = migrate(JSON.parse(JSON.stringify(next)));
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 下次再存 */ }
    refreshView();
  }

  // 重畫目前的畫面；正在填表單（編輯衣服、旅程）時先不重畫，避免打斷
  function refreshView() {
    // 表單頁（網址有 /）不重畫，免得打到一半的內容不見；每日穿搭只是顯示，資料回來就重畫
    if (/\//.test(location.hash)) { if (window.Outfit && location.hash.indexOf('#outfit/') === 0) window.Outfit.refresh(); return; }
    route();
  }

  var state = load();

  // ---------- 工具 ----------
  var $ = function (sel) { return document.querySelector(sel); };

  function fmt(n) {
    var r = Math.round(n * 10) / 10;
    return (Object.is(r, -0) ? 0 : r).toFixed(1);
  }

  function fmtWeight(kg) {
    return kg < 1 ? Math.round(kg * 1000) + ' g' : (Math.round(kg * 100) / 100) + ' kg';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function entryById(id) {
    return state.memory.find(function (m) { return m.id === id; });
  }

  function bagById(id) {
    return state.bags.find(function (b) { return b.id === id; });
  }

  function bagLoad(bag) {
    return state.items.reduce(function (sum, it) {
      return it.bagId === bag.id ? sum + it.weight * it.qty : sum;
    }, bag.auto ? 0 : Number(bag.tare) || 0);   // 尚未選擇行李箱：空箱算 0
  }

  function level(remain, limit) {
    if (limit == null) return 'none';
    if (remain < 0) return 'bad';
    if (limit > 0 && remain / limit < WARN_RATIO) return 'warn';
    return 'ok';
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  // ---------- 下一段航班 ----------
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // 今天（含）以後、日期最近的一段航班；今天已經起飛（過了起飛時間或已整理過抵達）的不算
  function nextLeg() {
    var today = todayStr(), best = null;
    var d = new Date(), now = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    state.trips.forEach(function (t) {
      t.legs.forEach(function (l, i) {
        if (!l.date || l.date < today) return;
        if (l.date === today && (l.arrivalDone || l.arrivalPrompted || (l.depTime && l.depTime <= now))) return;
        if (!best || l.date < best.leg.date) best = { trip: t, leg: l, index: i };
      });
    });
    return best;
  }

  // 這段航班某種額度的公斤數；沒填回傳 null
  function allowanceOf(leg, kind) {
    var v = leg.allowance && leg.allowance[kind];
    return v === '' || v == null ? null : Number(v) || 0;
  }

  // 挑行李時的順序：這趟用到的箱子排前面（預設選第一個），放在家裡的箱子排後面並註明在哪
  function pickBags() {
    var act = activeBags(nextLeg());
    return act.concat(state.bags.filter(function (b) { return act.indexOf(b) < 0 && !b.auto; }));
  }
  function isTripBag(id) { return activeBags(nextLeg()).some(function (b) { return b.id === id; }); }
  function bagLabel(b) {
    if (b.auto) return kindName(b.kind) + '（尚未選擇行李箱）';
    return b.name + (!isTripBag(b.id) && b.home ? '（在' + b.home + '）' : '');
  }
  function bagOptions() {
    return pickBags().map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(bagLabel(b)) + '</option>'; }).join('');
  }

  // 這趟用到的行李箱（放在家裡沒帶的箱子不算空箱重量）
  function activeBags(next) {
    var ids = window.Packing ? window.Packing.tripBagIds(next && next.trip) : null;
    var real = state.bags.filter(function (b) { return !b.auto; });
    if (!ids) return real;
    if (!ids.length && !next) return real;   // 沒有旅程：列出自己的行李箱
    return state.bags.filter(function (b) { return ids.indexOf(b.id) >= 0; });
  }

  // 「修改額度」連到行程設定裡那一段航班
  function legLink(next) {
    return legLinkFor(next.trip, next.index);
  }
  function legLinkFor(trip, index) {
    return '#trips/' + encodeURIComponent(trip.id) + '/leg/' + (index || 0);
  }

  // ---------- 首頁 ----------
  var openBag = null;   // 展開中的行李
  var homeTripId = null;   // 旅程卡目前看的是哪一趟

  // 這趟旅程接下來要飛的各段：正在進行的從下一段起，還沒出發的全部
  function legsAhead(trip) {
    var n = nextLeg();
    var from = n && n.trip.id === trip.id ? n.index : 0;
    var out = [];
    trip.legs.forEach(function (l, i) { if (i >= from) out.push({ leg: l, index: i }); });
    return out;
  }

  // 這趟旅程每個行李箱的重量。
  // 正在進行／下一趟：行李裡的東西（打包、購物、還在行李裡的禮物）＋出發前清單上還沒收好的；
  // 之後的旅程：空箱＋打包清單上要帶的東西（估計）
  function tripWeights(trip) {
    var n = nextLeg();
    if (n && n.trip.id === trip.id) {
      var pend = {};   // 打包清單上還沒打勾的不算：打勾＝放進行李才扣重量
      var used = activeBags(n), loads = {};
      used.forEach(function (b) { loads[b.id] = bagLoad(b) + (pend[b.id] ? pend[b.id].weight : 0); });
      return { live: true, bags: used, loads: loads, pend: pend };
    }
    var est = window.Packing ? window.Packing.zoneWeights(trip) : {};
    var bags = state.bags.filter(function (b) { return est[b.id] != null; });
    return { live: false, bags: bags, loads: est, pend: {} };
  }

  // 某一段航班的額度對比：同一項額度的行李加在一起比（例如背包＋隨身小包）；沒填額度的那項不算進剩餘
  function legRemain(trip, leg, bags, loads) {
    var groups = {}, total = 0, limit = 0, remain = 0, known = 0, missing = [];
    bags.forEach(function (b) {
      var g = groupOf(b.kind, trip);
      if (!g) return;   // 隨身小包設定成「不計算」
      total += loads[b.id] || 0;
      if (!groups[g]) groups[g] = { key: g, load: 0, allow: leg ? allowanceOf(leg, g) : null, bags: [] };
      groups[g].load += loads[b.id] || 0;
      groups[g].bags.push(b);
    });
    Object.keys(groups).forEach(function (k) {
      var gr = groups[k];
      if (gr.allow == null) { missing.push(k); return; }
      known++; limit += gr.allow; remain += gr.allow - gr.load;
    });
    return { groups: groups, total: total, missing: missing, limit: known ? limit : null, remain: known ? remain : null };
  }

  // 一趟旅程的剩餘公斤數：各段額度不同時，用剩餘最少（最緊）的那一段
  function tripRemain(trip) {
    var w = tripWeights(trip);
    var best = null, vals = [];
    legsAhead(trip).forEach(function (x) {
      var r = legRemain(trip, x.leg, w.bags, w.loads);
      r.leg = x.leg; r.index = x.index;
      if (r.remain != null) vals.push(Math.round(r.remain * 10));
      if (!best || (r.remain != null && (best.remain == null || r.remain < best.remain))) best = r;
    });
    if (!best) { best = legRemain(trip, null, w.bags, w.loads); best.leg = null; best.index = 0; }
    best.tight = vals.filter(function (v, i) { return vals.indexOf(v) === i; }).length > 1;   // 各段剩餘不一樣，才標出最緊的那段
    best.trip = trip; best.bags = w.bags; best.loads = w.loads; best.pend = w.pend; best.live = w.live;
    best.groupOf = function (kind) { return groupOf(kind, trip); };
    var limits = {};
    w.bags.forEach(function (b) { var g = best.groups[groupOf(b.kind, trip)]; limits[b.id] = g ? g.allow : null; });
    best.limits = limits;
    return best;
  }

  // 給打包清單、購物頁用：下一趟旅程的剩餘公斤數（和首頁旅程卡同一個數字）
  function remainInfo() {
    var next = nextLeg();
    if (!next) {
      var used = activeBags(null), loads = {};
      used.forEach(function (b) { loads[b.id] = bagLoad(b); });
      return { next: null, leg: null, legIndex: 0, bags: used, loads: loads, limits: {}, groups: {}, pend: {}, total: 0, missing: [],
        groupOf: function (k) { return groupOf(k, null); }, limit: null, remain: null, tight: false };
    }
    var r = tripRemain(next.trip);
    return { next: next, leg: r.leg || next.leg, legIndex: r.leg ? r.index : next.index, bags: r.bags, loads: r.loads, limits: r.limits,
      groups: r.groups, pend: r.pend, total: r.total, missing: r.missing, groupOf: r.groupOf, limit: r.limit, remain: r.remain, tight: r.tight };
  }

  // 箱子裡的東西搬到另一個箱子（換行李箱）
  function moveBagContents(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    state.items.forEach(function (it) {
      if (it.bagId !== oldId) return;
      it.bagId = newId;
      var m = it.catalogId && entryById(it.catalogId);
      if (m) markPacked(m, newId);
    });
    (state.packLists || []).forEach(function (l) {
      Object.keys(l.zones || {}).forEach(function (z) { if (l.zones[z].bagId === oldId) l.zones[z].bagId = newId; });
    });
  }

  // 行李箱的位置：裡面有東西＝跟著旅程出門；空的＝在它的家
  function bagLocOf(b) {
    var n = state.items.filter(function (it) { return it.bagId === b.id; }).length;
    if (n) return { state: 'out', count: n, fromHome: b.home || '' };
    return b.home ? { state: 'home', home: b.home } : { state: 'none' };
  }

  // 接下來的旅程（還沒結束的），依出發日排
  function upcomingTrips() {
    var today = todayStr();
    function first(t) { return t.legs.map(function (l) { return l.date; }).filter(Boolean).sort()[0] || '9999'; }
    function last(t) {
      return t.legs.map(function (l) { return window.Trips ? window.Trips.arrivalDate(l) : l.date; }).filter(Boolean).sort().pop() || '';
    }
    return state.trips.filter(function (t) { return t.legs.length && last(t) >= today; })
      .sort(function (a, b) { return first(a).localeCompare(first(b)); });
  }

  function md(d) { var p = d.split('-'); return (+p[1]) + '/' + (+p[2]); }
  function tripDates(t) {
    var ds = t.legs.map(function (l) { return l.date; }).filter(Boolean).sort();
    var ends = t.legs.map(function (l) { return window.Trips.arrivalDate(l); }).filter(Boolean).sort();
    if (!ds.length) return '日期未定';
    var end = ends[ends.length - 1] || ds[ds.length - 1];
    return end === ds[0] ? window.Trips.fmtDate(ds[0]) : md(ds[0]) + ' – ' + window.Trips.fmtDate(end);
  }
  function tripRoute(t) {
    var c = [];
    t.legs.forEach(function (l, i) {
      if (i === 0 && l.from) c.push(l.from);
      if (l.to && c[c.length - 1] !== l.to) c.push(l.to);
    });
    // 每個城市名稱不在中間斷行（手機上「台北」不會被拆成兩行）
    return c.map(function (x) { return '<span class="nw">' + esc(x) + '</span>'; }).join(' → ') || '路線未定';
  }

  // ---------- 預留空間（可選）：這趟想留給購物和送禮的公斤數（資料欄位沿用 shopGoal）；打包吃到這個空間時提醒 ----------
  var GOAL_NEAR = 1;   // 離預留空間只剩 1 公斤以內就算「快吃到」
  function goalOf(t) { var g = t && t.shopGoal; return g === '' || g == null || !isFinite(Number(g)) ? null : Number(g); }
  // 預留空間「已用」：這趟在行李裡的購物和禮物重量（它們本來就該用預留空間，不算打包吃掉的）
  function shoppingWeight(trip) {
    var sh = state.shopping || { purchases: [] };
    return state.items.reduce(function (sum, it) {
      var p = it.purchaseId && sh.purchases.find(function (x) { return x.id === it.purchaseId; });
      var g = it.giftId && (state.gifts || []).find(function (x) { return x.id === it.giftId; });
      if ((p && p.tripId === trip.id) || (g && g.tripId === trip.id)) return sum + (Number(it.weight) || 0) * (Number(it.qty) || 1);
      return sum;
    }, 0);
  }
  // 已用：行李裡的購物和禮物，加上補貨要在路上買的預估重量
  function reserveOf(trip) { return { goal: goalOf(trip), used: shoppingWeight(trip) + (window.Consumables ? window.Consumables.plannedWeight(trip) : 0) }; }
  function kgShort(v) { var r = Math.round((Number(v) || 0) * 10) / 10; return String(Object.is(r, -0) ? 0 : r); }
  // 預留空間那一行的文字：「預留空間 已用 2 / 5 kg」，沒設定：「設定預留空間」
  function reserveText(trip) {
    var rv = reserveOf(trip);
    return rv.goal == null ? '設定預留空間' : '預留空間 已用 ' + kgShort(rv.used) + ' / ' + kgShort(rv.goal) + ' kg';
  }
  // 打包後留給購物和送禮的空間，和預留空間比：ok／near 快吃到／over 已經吃到
  function goalStatus(trip, r) {
    var goal = goalOf(trip);
    r = r || tripRemain(trip);
    if (goal == null || r.remain == null) return null;
    var free = r.remain + (r.live ? shoppingWeight(trip) : 0);
    return { goal: goal, free: free, level: free < goal ? 'over' : free - goal <= GOAL_NEAR ? 'near' : 'ok' };
  }

  var goalSeen = {};   // 每趟旅程上次的狀態（只在變差的那一刻提醒一次）
  var goalReady = false;
  function checkGoals(silent) {
    if (!silent && !goalReady) return;
    goalReady = true;
    var msg = '';
    upcomingTrips().forEach(function (t) {
      var g = goalStatus(t);
      var now = g ? g.level : 'none', before = goalSeen[t.id] || 'none';
      goalSeen[t.id] = now;
      if (silent || !g || msg) return;
      var rank = { none: 0, ok: 0, near: 1, over: 2 };
      if (rank[now] <= rank[before]) return;
      var name = t.name ? '「' + t.name + '」' : '這趟';
      msg = now === 'over'
        ? name + '打包的重量已經用到預留空間了。\n預留空間 ' + fmt(g.goal) + ' kg，現在打包後只剩 ' + fmt(Math.max(0, g.free)) + ' kg 可以放購物和禮物。'
        : name + '打包的重量快用到預留空間了。\n再放 ' + fmt(g.free - g.goal) + ' kg 就會開始佔用預留空間的 ' + fmt(g.goal) + ' kg。';
    });
    if (msg) {
      $('#goal-alert-text').textContent = msg;
      $('#goal-alert').hidden = false;
    }
  }

  var goalTripId = null;
  function openGoal(id) {
    var t = state.trips.find(function (x) { return x.id === id; });
    if (!t) return;
    goalTripId = id;
    $('#goal-title').textContent = (t.name ? '「' + t.name + '」' : '這趟') + '的預留空間';
    $('#goal-input').value = goalOf(t) == null ? '' : goalOf(t);
    $('#goal-sheet').hidden = false;
    setTimeout(function () { $('#goal-input').focus(); }, 50);
  }
  function setGoal(v) {
    var t = state.trips.find(function (x) { return x.id === goalTripId; });
    $('#goal-sheet').hidden = true;
    if (!t) return;
    t.shopGoal = v;
    t.updatedAt = Date.now();
    var g = goalStatus(t);
    goalSeen[t.id] = g ? g.level : 'none';   // 剛設定時不跳提醒，直接在卡片上顯示
    save();
    toast(v === '' ? '已取消預留空間' : '預留空間：' + fmt(v) + ' kg');
    renderHome();
    if (window.Shop && /^#shop/.test(location.hash)) window.Shop.refresh();
  }
  $('#goal-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = parseFloat($('#goal-input').value);
    if (!isFinite(v) || v < 0) { toast('請輸入公斤數，或按「不設定」'); return; }
    setGoal(Math.round(v * 10) / 10);
  });
  $('#goal-clear').addEventListener('click', function () { setGoal(''); });
  $('#goal-sheet').addEventListener('click', function (e) { if (e.target.id === 'goal-sheet' || e.target.id === 'goal-cancel') $('#goal-sheet').hidden = true; });
  $('#goal-alert').addEventListener('click', function (e) { if (e.target.id === 'goal-alert' || e.target.id === 'goal-alert-ok') $('#goal-alert').hidden = true; });

  function tripCard(t) {
    var r = tripRemain(t);
    // 快滿（剩不到 15%）、超重：數字旁邊小字標出來（黑白，不靠顏色）
    var blv = r.remain == null ? 'none' : UI.barLevel(r.limit - r.remain, r.limit);
    return '<div class="trip-card" role="link" tabindex="0" data-trip-card="' + esc(t.id) + '">' +
      '<div class="tc-date">' + esc(tripDates(t)) + '<span class="tc-name">' + esc(t.name || '') + '</span></div>' +
      '<div class="tc-route">' + tripRoute(t) + '</div>' +
      '<div class="tc-label">剩餘公斤數<span class="lbl-en">REMAINING</span></div>' +
      '<div class="tc-value' + (r.remain == null ? ' none' : '') + '"><span data-roll="tc:' + esc(t.id) + '">' + (r.remain == null ? '—' : fmt(r.remain)) + '</span><small> kg' +
      (blv === 'over' ? '<em class="tc-flag">超重</em>' : blv === 'warn' ? '<em class="tc-flag">快滿</em>' : '') + '</small></div>' +
      (r.remain == null ? '<div class="tc-note">尚未設定額度</div>' :
        r.tight && r.leg ? '<div class="tc-note">最緊：' + esc(r.leg.from || '?') + ' → ' + esc(r.leg.to || '?') + '</div>' : '') +
      reserveLine(t) + outfitLine(t) +
      '</div>';
  }
  // 今天（或明天）在這趟旅程裡：多一行「今天的穿搭 ›」，點了直接進那天的穿搭頁
  function outfitLine(t) {
    if (!window.Outfit) return '';
    var days = window.Outfit.tripDays(t).map(function (d) { return d.date; });
    var today = todayStr(), p = today.split('-'), tm = new Date(+p[0], +p[1] - 1, +p[2] + 1);
    var tomorrow = tm.getFullYear() + '-' + String(tm.getMonth() + 1).padStart(2, '0') + '-' + String(tm.getDate()).padStart(2, '0');
    var d = days.indexOf(today) >= 0 ? today : days.indexOf(tomorrow) >= 0 ? tomorrow : '';
    if (!d) return '';
    return '<button type="button" class="link small tc-shop tc-outfit" data-outfit-day="' + esc(t.id) + '/' + d + '">' + (d === today ? '今天' : '明天') + '的穿搭 ›</button>';
  }
  // 旅程卡裡的預留空間（購物和送禮共用）：「預留空間 已用 2 / 5 kg ›」點了進這趟的購物和送禮頁；
  // 沒設定時「設定預留空間 ›」點了可以設定（也可以不設）
  function reserveLine(t) {
    var set = goalOf(t) != null;
    return '<div class="tc-goal-row"><button type="button" class="link small tc-goal tc-reserve" ' + (set ? 'data-shop-trip' : 'data-goal') + '="' + esc(t.id) + '">' +
      esc(reserveText(t)) + ' ›</button></div>';
  }
  // 點旅程卡進行程設定；點「設定預留空間」開設定、點「預留空間 已用…」進這趟的購物和送禮
  $('#trip-cards').addEventListener('click', function (e) {
    var g = e.target.closest('[data-goal]');
    if (g) { openGoal(g.getAttribute('data-goal')); return; }
    var sp = e.target.closest('[data-shop-trip]');
    if (sp) { if (window.Shop) window.Shop.openTrip(sp.getAttribute('data-shop-trip')); return; }
    var od = e.target.closest('[data-outfit-day]');
    if (od) { var x = od.getAttribute('data-outfit-day').split('/'); location.hash = '#outfit/' + encodeURIComponent(x[0]) + '/' + x[1]; return; }
    var c = e.target.closest('[data-trip-card]');
    if (c) location.hash = '#trips/' + encodeURIComponent(c.getAttribute('data-trip-card'));
  });

  function renderHome() {
    var n0 = nextLeg();
    if (n0 && window.Packing) window.Packing.tripZones(n0.trip);   // 先確定這趟每種行李用哪個箱子（和打包清單同一份）
    if (window.Shop) window.Shop.renderHomeBits();
    if (window.Consumables) window.Consumables.renderHome();   // 補貨提醒
    if (window.Organize) window.Organize.check();
    var trips = upcomingTrips();
    $('#trip-none').hidden = trips.length > 0;
    $('#trip-cards').hidden = !trips.length;
    $('#bags-block').hidden = !trips.length;
    $('#trip-dots').hidden = trips.length < 2;
    if (!trips.length) { $('#trip-cards').innerHTML = ''; $('#bag-list').innerHTML = ''; return; }
    if (!trips.some(function (t) { return t.id === homeTripId; })) homeTripId = n0 && trips.some(function (t) { return t.id === n0.trip.id; }) ? n0.trip.id : trips[0].id;
    var box = $('#trip-cards');
    box.innerHTML = trips.map(tripCard).join('');
    var idx = trips.findIndex(function (t) { return t.id === homeTripId; });
    box.scrollLeft = idx * box.clientWidth;   // 停在目前看的那一趟
    renderDots(trips, idx);
    renderBags();
    if (window.UI) window.UI.rollAll(box);   // 剩餘公斤數改變時平滑滾動
  }

  function renderDots(trips, idx) {
    $('#trip-dots').innerHTML = trips.map(function (t, i) {
      return '<button type="button" class="' + (i === idx ? 'on' : '') + '" data-trip-dot="' + i + '" aria-label="' + esc(t.name || '旅程') + '"></button>';
    }).join('');
  }

  // 左右滑到另一趟：下方「我的行李」跟著換
  var swipeTimer = null;
  $('#trip-cards').addEventListener('scroll', function () {
    clearTimeout(swipeTimer);
    var box = this;
    swipeTimer = setTimeout(function () {
      var trips = upcomingTrips();
      var i = Math.max(0, Math.min(trips.length - 1, Math.round(box.scrollLeft / (box.clientWidth || 1))));
      if (trips[i] && trips[i].id !== homeTripId) {
        homeTripId = trips[i].id;
        openBag = null;
        renderDots(trips, i);
        renderBags();
      }
    }, 120);
  });
  $('#trip-dots').addEventListener('click', function (e) {
    var b = e.target.closest('[data-trip-dot]');
    if (!b) return;
    var box = $('#trip-cards');
    box.scrollTo({ left: +b.getAttribute('data-trip-dot') * box.clientWidth, behavior: 'smooth' });
  });

  function homeTrip() { return state.trips.find(function (t) { return t.id === homeTripId; }); }

  // 我的行李：這趟每種行李一行（隨身小包、背包、手提、托運），行李箱名稱、目前重量／額度
  function renderBags() {
    var trip = homeTrip();
    if (!trip || !window.Packing) { $('#bag-list').innerHTML = ''; return; }
    var r = tripRemain(trip);
    if (openBag && !bagById(openBag)) openBag = null;
    $('#bags-limit-link').href = legLinkFor(trip, r.leg ? r.index : 0);
    var zones = window.Packing.tripZones(trip);
    var shown = [];
    var html = zones.map(function (z) {
      if (!z.on) {
        return '<div class="bag-off"><span><b>' + kindName(z.kind) + '</b><span class="muted small">這趟不帶</span></span>' +
          '<button type="button" class="link small" data-pick-kind="' + z.kind + '">選擇行李箱</button></div>';
      }
      shown.push(z.bag.id);
      return bagRow(z.bag, z.kind, r, shown);
    }).join('');
    // 其他放了東西、但不在這趟清單上的行李箱（只有正在用的這趟才有）
    if (r.live) html += r.bags.filter(function (b) { return shown.indexOf(b.id) < 0; }).map(function (b) { return bagRow(b, null, r, shown); }).join('');
    $('#bag-list').innerHTML = html;
    Photos.fillThumbs($('#bag-list'));
    UI.animateBars($('#bag-list'));
  }

  function bagRow(b, zoneKind, r, shown) {
    var w = r.loads[b.id] != null ? r.loads[b.id] : (r.live ? bagLoad(b) : (b.auto ? 0 : Number(b.tare) || 0));
    var gkey = r.groupOf(b.kind);
    var gr = gkey && r.groups[gkey];
    var allow = gr ? gr.allow : null;
    // 同一項額度有好幾個行李（例如背包＋隨身小包）：額度只在排最後的那一行顯示「合計」，數字不重複
    function order(x) { return BAG_KINDS.findIndex(function (k) { return k[0] === x.kind; }); }
    var lastOfGroup = !gr || gr.bags.every(function (x) { return x.id === b.id || order(x) < order(b) || (order(x) === order(b) && gr.bags.indexOf(x) < gr.bags.indexOf(b)); });
    var shared = gr && gr.bags.length > 1;
    var items = r.live ? state.items.filter(function (it) { return it.bagId === b.id; }) : [];
    var pending = r.live && window.Packing ? window.Packing.bagPending(b.id) : [];
    var open = r.live && openBag === b.id;
    // 名稱下方一條進度條（和打包頁同一個樣式）：已放 / 額度；同一項額度的好幾個行李只在最後一行顯示合計
    var meter;
    if (!gkey) meter = '<span class="bag-note muted small">' + UI.kg(w) + ' kg・不計算</span>';
    else if (shared && !lastOfGroup) meter = '<span class="bag-note muted small">' + UI.kg(w) + ' kg・算在' + kindName(gkey) + '額度</span>';
    else if (allow == null) meter = UI.bar(w, null, 'home:' + b.id);
    else meter = UI.bar(shared ? gr.load : w, allow, 'home:' + (r.trip ? r.trip.id : '') + ':' + gkey, shared ? '<span class="wbar-share">合計</span>' : '');
    var kind = zoneKind || b.kind;
    return '<div class="bag-block' + (open ? ' open' : '') + '">' +
      '<button type="button" class="bag-row" data-bag-open="' + esc(b.id) + '" aria-expanded="' + open + '"' + (r.live ? '' : ' disabled') + '>' +
      '<span class="bag-row-name"><b>' + kindName(kind) + '</b><span class="small">' + (b.auto ? '<span class="bag-warn">尚未選擇行李箱</span>' : '<span class="muted">' + esc(b.name) + '</span>') + '</span>' + meter + '</span>' +
      (r.live ? '<span class="bag-chev" aria-hidden="true">' + (open ? '−' : '+') + '</span>' : '') + '</button>' +
      (zoneKind ? '<div class="bag-tools"><button type="button" class="link small" data-pick-kind="' + zoneKind + '">選擇行李箱</button>' +
        (b.auto ? '<span class="muted small">選了行李箱，空箱重量就會自動算進去</span>' : '') + '</div>' : '') +
      (open ? bagPanel(b, items, pending, r.live ? nextLeg() : null) : '') + '</div>';
  }

  // ---------- 首頁：選擇行李箱（和打包清單同一份） ----------
  var pickKind = null;
  function openKindSheet(kind) {
    var trip = homeTrip();
    if (!trip || !window.Packing) return;
    pickKind = kind;
    var zone = window.Packing.tripZones(trip).find(function (z) { return z.kind === kind; });
    var cur = zone && zone.on ? zone.bag : null;
    var origin = window.Trips ? window.Trips.homeFor(trip.origin) : '';
    var bags = state.bags.filter(function (b) { return !b.auto && b.kind === kind; }).sort(function (a, b) {
      return (b.home === origin ? 1 : 0) - (a.home === origin ? 1 : 0);
    });
    $('#kind-sheet-title').textContent = (trip.name ? '「' + trip.name + '」' : '這趟') + '的' + kindName(kind) + '用哪一個行李箱？';
    $('#kind-sheet-list').innerHTML = (bags.length ? bags.map(function (b) {
      return '<button type="button" class="btn ghost sheet-bag' + (cur && cur.id === b.id ? ' cur' : '') + '" data-kind-bag="' + esc(b.id) + '">' +
        esc(b.name) + '<span class="muted small">' + [b.home ? (b.home === origin ? b.home + '・出發地' : '在' + b.home) : '', b.size, '空箱 ' + fmt(Number(b.tare) || 0) + ' kg'].filter(Boolean).join('・') + '</span></button>';
    }).join('') : '<p class="muted small">「家 → 行李箱」裡還沒有' + kindName(kind) + '。</p>') +
      '<a class="link small" href="#bags" data-kind-manage="1">到「家 → 行李箱」新增或修改 ›</a>' +
      '<button type="button" class="btn ghost sheet-bag' + (zone && !zone.on ? ' cur' : '') + '" data-kind-bag="off">這趟不帶' + kindName(kind) + '</button>';
    $('#kind-sheet').hidden = false;
  }
  $('#kind-sheet').addEventListener('click', function (e) {
    var el = e.target.closest('[data-kind-bag]');
    if (el && pickKind) {
      var v = el.getAttribute('data-kind-bag');
      var msg = window.Packing.setTripZone(homeTrip(), pickKind, v);
      $('#kind-sheet').hidden = true;
      if (msg) { toast(msg); return; }
      toast(v === 'off' ? '這趟不帶' + kindName(pickKind) : '這趟的' + kindName(pickKind) + '用：' + bagById(v).name);
      renderHome();
      return;
    }
    if (e.target.closest('[data-kind-manage]')) { $('#kind-sheet').hidden = true; return; }
    if (e.target.id === 'kind-sheet' || e.target.id === 'kind-sheet-cancel') $('#kind-sheet').hidden = true;
  });

  // 展開的行李：依品類分組，可打勾、移到別的行李、拿出來
  function bagPanel(b, items, pending, next) {
    var rows = items.map(function (it) {
      return { kind: 'item', id: it.id, name: it.name, qty: it.qty, unit: it.unit, weight: it.weight * it.qty,
        category: it.giftId ? '禮物' : it.category, catalogId: it.catalogId, done: true, gift: !!it.giftId, buy: !!it.purchaseId };
    }).concat(pending.map(function (e) {
      return { kind: 'entry', id: e.id, name: e.name, qty: e.qty, unit: e.unit, weight: e.weight * e.qty,
        category: e.category, catalogId: e.catalogId, done: false };
    }));
    var done = rows.filter(function (r) { return r.done; }).length;
    var others = activeBags(next).filter(function (x) { return x.id !== b.id; });
    var groups = CATEGORIES.concat(['其他']).map(function (c) {
      var list = rows.filter(function (r) { return (CATEGORIES.indexOf(r.category) >= 0 ? r.category : '其他') === c; });
      if (!list.length) return '';
      return '<div class="bp-group"><div class="bp-cat">' + esc(c) + '</div>' + list.map(function (r) {
        var m = r.catalogId && entryById(r.catalogId);
        return '<div class="bp-row' + (r.done ? ' done' : '') + '">' +
          '<button type="button" class="bp-check" data-bp-check="' + r.kind + ':' + esc(r.id) + '" aria-label="' + (r.done ? '取消收好' : '收好了') + '">' + (r.done ? '✓' : '') + '</button>' +
          (m && m.photoId ? '<img class="bp-thumb" data-photo="' + esc(m.photoId) + '" alt="">' : '<span class="bp-thumb none" aria-hidden="true"></span>') +
          '<span class="bp-name">' + (r.gift ? GIFT_ICON : '') + (r.buy ? '<span class="bp-buy" title="旅途中買的">購</span>' : '') + esc(r.name) + (r.qty > 1 ? ' <span class="muted">× ' + r.qty + ' ' + esc(r.unit || '') + '</span>' : '') + '</span>' +
          '<span class="bp-w">' + fmtWeight(r.weight) + '</span>' +
          (others.length ? '<select class="bp-move" data-bp-move="' + r.kind + ':' + esc(r.id) + '" aria-label="移到別的行李"><option value="">移到…</option>' +
            others.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('') + '</select>' : '') +
          '<button type="button" class="bp-out" data-bp-out="' + r.kind + ':' + esc(r.id) + '" aria-label="拿出來：' + esc(r.name) + '">✕</button></div>';
      }).join('') + '</div>';
    }).join('');
    return '<div class="bag-panel">' +
      '<div class="bp-progress"><span>已收好 <b>' + done + '</b>／' + rows.length + ' 件</span>' +
      '<span class="muted small">含空箱 ' + fmt(Number(b.tare) || 0) + ' kg</span></div>' +
      (rows.length ? groups : '<p class="muted small">還沒有東西。</p>') +
      '<button type="button" class="btn ghost bp-more" data-more="' + esc(b.id) + '">＋ 放進更多東西</button></div>';
  }

  var GIFT_ICON = '<svg class="gift-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-label="禮物"><rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18"/><path d="M12 9v11"/><path d="M12 9c-1.5-3-5-3.5-5-1.2C7 9 12 9 12 9z"/><path d="M12 9c1.5-3 5-3.5 5-1.2C17 9 12 9 12 9z"/></svg>';

  function splitRef(v) { var i = v.indexOf(':'); return { kind: v.slice(0, i), id: v.slice(i + 1) }; }

  $('#bag-list').addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-pick-kind]'))) { openKindSheet(el.getAttribute('data-pick-kind')); return; }
    if ((el = e.target.closest('[data-bag-open]'))) {
      var id = el.getAttribute('data-bag-open');
      openBag = openBag === id ? null : id;
      renderHome();
      return;
    }
    if ((el = e.target.closest('[data-bp-check]'))) {
      var r = splitRef(el.getAttribute('data-bp-check'));
      var rowName = (el.closest('.bp-row') && el.closest('.bp-row').querySelector('.bp-name') || {}).textContent;
      if (r.kind === 'entry') { window.Packing.checkEntry(r.id); toast('收好了'); }
      else if (!window.Packing.uncheckItem(r.id)) {
        var it0 = state.items.find(function (x) { return x.id === r.id; });
        if (it0 && confirm('這個行李不在這趟的打包清單上。要把「' + it0.name + '」從行李拿出來嗎？')) window.Packing.takeOutItem(r.id);
      }
      renderHome();
      // 剛打勾的那一格輕輕跳一下
      if (r.kind === 'entry' && window.UI) {
        var row = [].slice.call(document.querySelectorAll('#bag-list .bp-row.done')).find(function (x) { return (x.querySelector('.bp-name') || {}).textContent === rowName; });
        if (row) window.UI.pop(row.querySelector('.bp-check'));
      }
      return;
    }
    if ((el = e.target.closest('[data-bp-out]'))) {
      var r2 = splitRef(el.getAttribute('data-bp-out'));
      var name = (el.getAttribute('data-i18n-aria-label') || el.getAttribute('aria-label')).replace('拿出來：', '');   // 英文模式時用中文原文的名稱
      if (!confirm('要把「' + name + '」從行李拿出來嗎？（這趟不帶了）')) return;
      if (r2.kind === 'entry') window.Packing.takeOutEntry(r2.id); else window.Packing.takeOutItem(r2.id);
      toast('已拿出來：' + name);
      renderHome();
      return;
    }
    if ((el = e.target.closest('[data-more]')) && window.Nav) window.Nav.openMore(el.getAttribute('data-more'));
  });

  $('#bag-list').addEventListener('change', function (e) {
    var el = e.target.closest('[data-bp-move]');
    if (!el || !el.value) return;
    var r = splitRef(el.getAttribute('data-bp-move'));
    var bag = bagById(el.value);
    if (r.kind === 'entry') {
      if (!window.Packing.moveEntryTo(r.id, el.value)) { toast('「' + bag.name + '」不在這趟的打包清單上，請先到「打包」啟用'); renderHome(); return; }
    } else window.Packing.moveItem(r.id, el.value);
    toast('已移到' + bag.name);
    renderHome();
  });

  // ---------- 放進行李 ----------
  var form = $('#add-form');
  var unit = '個';
  var managing = false;
  // 重量欄目前的來源：'' 空白、'ref' 參考重量、'memory' 常帶物品、'user' 自己輸入
  var weightSource = '';

  // ---------- 參考重量比對 ----------
  // 常見簡體字轉繁體，讓簡體輸入也能對到
  var S2T = {};
  ('线線电電头頭转轉换換机機风風药藥镜鏡键鍵盘盤装裝袜襪裤褲衬襯伞傘护護钱錢签簽证證维維鱼魚' +
   '马馬网網运運动動叶葉饼餅宝寶记記笔筆脑腦长長绒絨内內带帶凉涼阳陽叠疊隐隱妆妝晒曬体體胡鬍' +
   '垫墊温溫壶壺凤鳳红紅坚堅卷捲离離夹夾触觸阅閱读讀戴戴发髮洁潔肤膚润潤乐樂鞋鞋针針织織连連' +
   '单單数數码碼备備源源移移动動盔盔帽帽围圍巾巾腰腰拍拍罩罩').replace(/(.)(.)/g, function (_, a, b) { S2T[a] = b; });

  function norm(str) {
    return String(str).toLowerCase().replace(/[^\s]/g, function (c) { return S2T[c] || c; })
      .replace(/[\s\-_.,，。、・·()（）\[\]【】\/]+/g, '');
  }

  var REFS = (window.REFERENCE_WEIGHTS || []).map(function (r) {
    return { ref: r, keys: [r.name].concat(r.aliases || []).map(norm).filter(Boolean) };
  });

  // 寬鬆比對：完全相同 > 名稱裡包含關鍵字（例如「iPhone充電線」）> 打到一半（例如「行動電」）
  function findRef(name) {
    var q = norm(name);
    if (!q) return null;
    var best = null, bestScore = 0;
    REFS.forEach(function (x) {
      x.keys.forEach(function (k) {
        var score = 0;
        if (q === k) score = 1000 + k.length;
        // 中文名稱的重點通常在最後，例如「iPhone充電線」是充電線，不是手機
        else if (k.length >= 2 && q.indexOf(k) >= 0) score = 500 + (q.slice(-k.length) === k ? 200 : 0) + k.length;
        else if (q.length >= 2 && k.indexOf(q) === 0) score = 100 - k.length;
        if (score > bestScore) { bestScore = score; best = x.ref; }
      });
    });
    return best;
  }

  function setWeightField(kg) {
    if (kg < 1) {
      $('#f-wunit').value = 'g';
      $('#f-weight').value = Math.round(kg * 1000);
    } else {
      $('#f-wunit').value = 'kg';
      $('#f-weight').value = Math.round(kg * 1000) / 1000;
    }
  }

  function setWeightSource(src, text) {
    weightSource = src;
    $('#f-approx').hidden = src !== 'ref';
    $('#weight-hint').textContent = text || '';
    $('#weight-hint').hidden = !text;
  }

  // 名稱改變時：先找自己記過的重量，再找參考重量表
  function autofillFromName() {
    if (weightSource === 'user') return;
    var name = $('#f-name').value;
    var m = findMemory(name);
    var ref = findRef(name);
    if (!m && ref) m = state.memory.find(function (x) { return isPlain(x) && findRef(x.name) === ref; });
    if (m) {
      setWeightField(m.weight);
      if (CATEGORIES.indexOf(m.category) >= 0) $('#f-cat').value = m.category;
      setUnit(m.unit || '個');
      if (m.estimated) {
        setWeightSource('ref', '這是參考重量，秤過之後可以直接改成實際重量。');
      } else {
        setWeightSource('memory', '使用你記錄的重量（' + m.name + '）。');
      }
    } else if (ref) {
      setWeightField(ref.weight);
      $('#f-cat').value = ref.category;
      setUnit(ref.unit || '個');
      setWeightSource('ref', '參考「' + ref.name + '」' + (ref.note ? '（' + ref.note + '）' : '') +
        '的大約重量，秤過之後可以直接改成實際重量。');
    } else if (weightSource) {
      $('#f-weight').value = '';
      $('#f-wunit').value = 'kg';
      setWeightSource('');
    }
    updatePreview();
  }

  function setUnit(u) {
    unit = u;
    Array.prototype.forEach.call($('#f-unit').children, function (b) {
      b.classList.toggle('on', b.getAttribute('data-unit') === u);
      if (b.getAttribute('data-unit') === '套') b.hidden = u !== '套';   // 「套」只在睡衣時出現
    });
    updatePreview();
  }

  // ---------- 照片與衣服標籤（放進行李） ----------
  var selectedId = null;     // 從常帶物品點選的那一件
  var newPhoto = null;       // 這次新拍／新選的照片（已壓縮，還沒存）
  var entryPhotoId = null;   // 點選的常帶物品原本的照片
  var photoRemoved = false;  // 按了「移除照片」
  var tagsTouched = false;   // 自己點過標籤
  var autoName = '';         // 由標籤自動填入的名稱

  // 沒有照片、沒有衣服標籤的一般物品，才用名稱來找同一筆
  function isPlain(m) { return !m.photoId && !(m.clothing && m.clothing.group); }

  function allBrands() {
    var out = [];
    state.memory.forEach(function (m) {
      var b = m.clothing && m.clothing.brand;
      if (b && out.indexOf(b) < 0) out.push(b);
    });
    return out;
  }

  // ---------- 抽屜：新增一筆（抽屜表單、範例資料、刪除旅程時留下的禮物都用這裡，格式才會一樣） ----------
  // o：{ name, weight(kg), unit, category, estimated, home, count（數量，可空白）, id?, extra? }
  function makeDrawerEntry(o, s) {
    s = s || state;
    var today = todayStr();
    var hasCount = o.count != null && o.count !== '';
    var base = {
      name: o.name,
      weight: o.weight,
      unit: o.unit || '個',
      category: o.category,
      bagId: s.bags[0] && s.bags[0].id,
      uses: 0,
      estimated: !!o.estimated,
      home: o.home,
      count: hasCount ? o.count : null,
      countUnit: o.unit || '個',
      stock: hasCount ? '' : 'have',
      drawer: true,
      location: { state: 'home', home: o.home, since: today },
      moves: [{ home: o.home, date: today }]
    };
    if (o.id) base.id = o.id;
    return normalizeEntry(Object.assign(base, o.extra || {}));
  }

  // ---------- 必帶清單（帳號選單、打包清單、範例資料都用這裡） ----------
  var MUST_ZONES = ['pouch', 'personal', 'carry', 'checked'];
  function mustList() { return state.mustList || []; }
  function addMust(name, zone, weight) {
    name = String(name || '').trim().slice(0, 30);
    if (!name) return '請輸入名稱';
    if (mustList().some(function (m) { return norm(m.name) === norm(name); })) return '必帶清單裡已經有「' + name + '」了';
    var ref = findRef(name);
    state.mustList = mustList().concat([{ id: uid(), name: name, zone: MUST_ZONES.indexOf(zone) >= 0 ? zone : 'checked',
      weight: weight != null && weight !== '' ? Number(weight) : (ref ? ref.weight : 0.1) }]);
    save();
    return '';
  }
  function removeMust(id) { state.mustList = mustList().filter(function (m) { return m.id !== id; }); save(); }
  function setMustZone(id, zone) {
    var m = mustList().find(function (x) { return x.id === id; });
    if (m && MUST_ZONES.indexOf(zone) >= 0) { m.zone = zone; save(); }
  }

  // 每個行李（依額度分組）還能放多少：和整趟的剩餘公斤數同一個計算（最緊的那段）
  // 回傳 { 組別: { allow（null＝尚未設定額度）, load, remain } }
  function groupRemains(trip) {
    var r = tripRemain(trip), out = {};
    ['pouch', 'personal', 'carry', 'checked'].forEach(function (k) {
      var g = groupOf(k, trip);
      if (!g || out[g]) return;
      var gr = r.groups[g];
      var allow = gr ? gr.allow : (r.leg ? allowanceOf(r.leg, g) : null);
      var load = gr ? gr.load : 0;
      out[g] = { allow: allow, load: load, remain: allow == null ? null : allow - load };
    });
    return out;
  }

  // ---------- 刪除旅程：這趟的購物、禮物、打包清單 ----------
  function tripRecords(s, id) {
    var sh = s.shopping || {};
    return {
      purchases: (sh.purchases || []).filter(function (p) { return p.tripId === id; }),
      plans: (sh.plans || []).filter(function (p) { return p.tripId === id; }),
      gifts: (s.gifts || []).filter(function (g) { return g.tripId === id; }),
      list: (s.packLists || []).find(function (l) { return l.id === id; }) || null
    };
  }
  // 刪除前的確認視窗用：這趟有幾筆購物、幾份禮物、打包清單幾項
  function tripDataCounts(t) {
    var r = tripRecords(state, t.id);
    return {
      purchases: r.purchases.length,
      gifts: r.gifts.length,
      pack: r.list ? (r.list.entries || []).filter(function (e) { return e.status === 'take'; }).length : 0
    };
  }
  // 刪掉這趟的購物、禮物、打包清單。
  // 已經放進某個家的購物和禮物：物品本身留在那個家（抽屜裡），只刪掉這趟的紀錄。
  // 已經放進行李的衣櫃／抽屜物品留在行李裡；這趟買的、這趟的禮物（不是抽屜裡的）從行李拿掉。
  function purgeTripData(s, id) {
    var r = tripRecords(s, id);
    var pIds = r.purchases.map(function (p) { return p.id; });
    var gIds = r.gifts.map(function (g) { return g.id; });
    s.items = (s.items || []).filter(function (it) {
      var mine = (it.purchaseId && pIds.indexOf(it.purchaseId) >= 0) || (it.giftId && gIds.indexOf(it.giftId) >= 0);
      if (!mine) return true;
      if (it.catalogId) { delete it.purchaseId; delete it.giftId; return true; }   // 衣櫃／抽屜裡的那件：留在行李裡
      return false;
    });
    // 禮物已經放在某個家（不是從抽屜挑的）：在那個家的抽屜留一筆，物品不會不見
    r.gifts.forEach(function (g) {
      var fromDrawer = g.drawerId && (s.memory || []).some(function (m) { return m.id === g.drawerId; });
      if (g.status === 'bought' && g.home && !fromDrawer) {
        s.memory.push(makeDrawerEntry({ name: g.name, weight: Number(g.weight) || 0, unit: '份', category: '禮物', home: g.home,
          count: g.qty || 1, estimated: false }, s));
      }
    });
    var sh = s.shopping || {};
    sh.purchases = (sh.purchases || []).filter(function (p) { return p.tripId !== id; });
    sh.plans = (sh.plans || []).filter(function (p) { return p.tripId !== id; });
    if (sh.ratio) delete sh.ratio[id];
    s.gifts = (s.gifts || []).filter(function (g) { return g.tripId !== id; });
    s.packLists = (s.packLists || []).filter(function (l) { return l.id !== id; });
    if (s.dayPlans) delete s.dayPlans[id];
  }
  function deleteTrip(t) {
    purgeTripData(state, t.id);
    state.trips = state.trips.filter(function (x) { return x !== t && x.id !== t.id; });
    save();
  }
  // 下一趟旅程（還沒結束的，最早出發的那一趟）
  function nextTrip() { return upcomingTrips()[0] || null; }
  // 新增衣服／抽屜物品時的「加入下一趟的打包清單」：有下一趟才出現，預設不勾
  function renderNextPack(prefix) {
    var t = nextTrip(), wrap = $('#' + prefix + '-next-wrap');
    if (!wrap) return;
    wrap.hidden = !t;
    $('#' + prefix + '-next').checked = false;
    $('#' + prefix + '-next-trip').textContent = t ? '（' + (t.name || '下一趟') + '）' : '';
  }

  // ---------- 家 ----------
  function homes() { return state.homes; }

  // 自己輸入過的選項
  function customs(ctx) { return (state.customOptions || {})[ctx] || []; }
  function addCustom(ctx, value) {
    if (!state.customOptions) state.customOptions = {};
    var list = state.customOptions[ctx] || (state.customOptions[ctx] = []);
    if (list.indexOf(value) < 0) { list.push(value); save(); }
  }
  function removeCustom(ctx, value) {
    var list = (state.customOptions || {})[ctx];
    if (!list) return;
    var i = list.indexOf(value);
    if (i >= 0) { list.splice(i, 1); save(); }
  }
  // 每個家的所在城市：state.homeCities = { 家的名字: 城市 }
  // 家的名字可以自由取（例如「我的公寓」「爸媽家」）；判斷抵達哪個家一律用所在城市
  function homeCity(name) {
    var c = state.homeCities && state.homeCities[name];
    return c || name || '';
  }
  function setHomeCity(name, city) {
    city = String(city || '').trim().slice(0, 30);
    if (!city) return '請輸入所在城市';
    if (state.homes.indexOf(name) < 0) return '找不到這個家';
    if (!state.homeCities) state.homeCities = {};
    state.homeCities[name] = city;
    save();
    return '';
  }
  // city 沒給：所在城市先用家的名字（之後可以在帳號選單裡改）
  function addHome(name, city) {
    name = String(name || '').trim().slice(0, 20);
    city = String(city || '').trim().slice(0, 30) || name;
    if (!name || state.homes.indexOf(name) >= 0) return;
    state.homes.push(name);
    if (!state.homeCities) state.homeCities = {};
    state.homeCities[name] = city;
    save();
  }

  // 帳號裡完全沒有自己的資料（新帳號、新裝置）
  // ignoreSample：範例資料不算（只有範例＝還沒有自己的資料）
  function isEmptyState(s, ignoreSample) {
    s = s || state;
    function mine(x) { return !(ignoreSample && x && (x.sample || String(x.id || '').indexOf('sample-') === 0)); }
    return !(s.trips || []).filter(mine).length && !(s.memory || []).filter(mine).length && !(s.items || []).filter(mine).filter(function (it) {
        return !(ignoreSample && String(it.bagId || '').indexOf('sample-') === 0) && !(ignoreSample && String(it.catalogId || '').indexOf('sample-') === 0);
      }).length &&
      !(s.gifts || []).filter(mine).length && !((s.shopping || {}).purchases || []).filter(mine).length &&
      !(s.bags || []).some(function (b) { return !b.auto && mine(b); });
  }

  // ---------- 家：改名、刪除 ----------
  // 用到某個家的地方：衣櫃／抽屜物品、行李箱、行程結束後回到的家、禮物、購物
  function homeUsage(name) {
    var n = 0;
    state.memory.forEach(function (m) {
      if (m.home === name || (m.clothing && m.clothing.home === name) || (m.location && (m.location.home === name || m.location.fromHome === name))) n++;
    });
    state.bags.forEach(function (b) { if (b.home === name) n++; });
    state.trips.forEach(function (t) { if (t.endHome === name) n++; });
    (state.gifts || []).forEach(function (g) { if (g.home === name) n++; });
    ((state.shopping || {}).purchases || []).forEach(function (p) { if (p.homeDest === name || p.placedHome === name) n++; });
    return n;
  }
  function renameHome(from, to) {
    to = String(to || '').trim().slice(0, 20);
    if (!to || to === from) return '';
    if (state.homes.indexOf(to) >= 0) return '已經有「' + to + '」這個家了';
    var i = state.homes.indexOf(from);
    if (i < 0) return '找不到這個家';
    state.homes[i] = to;
    if (!state.homeCities) state.homeCities = {};
    state.homeCities[to] = state.homeCities[from] || from;   // 改名不改所在城市
    delete state.homeCities[from];
    function fix(o, k) { if (o && o[k] === from) o[k] = to; }
    state.memory.forEach(function (m) {
      fix(m, 'home'); fix(m.clothing, 'home'); fix(m.location, 'home'); fix(m.location, 'fromHome');
      (m.moves || []).forEach(function (x) { fix(x, 'home'); });
    });
    state.bags.forEach(function (b) { fix(b, 'home'); });
    state.trips.forEach(function (t) { fix(t, 'endHome'); });
    (state.gifts || []).forEach(function (g) { fix(g, 'home'); });
    ((state.shopping || {}).purchases || []).forEach(function (p) { fix(p, 'homeDest'); fix(p, 'placedHome'); });
    save();
    return '';
  }
  function removeHome(name) {
    var n = homeUsage(name);
    if (n) return '還有 ' + n + ' 樣東西、行李箱或行程用到「' + name + '」，先移到別的家再刪除';
    state.homes = state.homes.filter(function (h) { return h !== name; });
    if (state.homeCities) delete state.homeCities[name];
    save();
    return '';
  }

  // ---------- 衣櫃與行李共用：打包 ----------
  function isCloth(m) { return !!(m && m.clothing && m.clothing.group); }

  function packedItem(m) {
    return state.items.find(function (it) { return it.catalogId === m.id; });
  }

  // ---------- 物品位置（衣服、鞋子、配件） ----------
  /*
   * m.location：{ state, home, bagId, fromHome, since }
   *   state：home 在某個家、packed 在行李裡、pending 待確認（已抵達新的家，還沒決定要不要留下）
   * m.moves：移動紀錄 [{ home, date }]，例如 曼谷(11/3) → 昆明(11/8)
   * 行李清單（state.items）才是「在不在行李裡」的依據，location 記錄其他細節。
   */
  // 物品「放在哪個家」：衣物記在 clothing.home，抽屜物品記在 m.home
  function homeOfEntry(m) { return (isCloth(m) ? m.clothing.home : m.home) || ''; }
  function setHomeOfEntry(m, h) { if (isCloth(m)) m.clothing.home = h; else m.home = h; }

  function locOf(m) {
    if (!m) return null;
    var L = m.location || {};
    var item = packedItem(m);
    var origin = L.fromHome || (L.state === 'home' ? L.home : '') || homeOfEntry(m);
    if (item) {
      if (L.state === 'pending' && L.home) return { state: 'pending', home: L.home, bagId: item.bagId, fromHome: origin };
      return { state: 'packed', bagId: item.bagId, fromHome: origin };
    }
    if (L.state === 'home' && L.home) return { state: 'home', home: L.home };
    if (L.state === 'pending' && L.home) return { state: 'home', home: L.home };
    if (L.state === 'packed' && origin) return { state: 'home', home: origin };   // 從行李拿出來了，回到原本的家
    return homeOfEntry(m) ? { state: 'home', home: homeOfEntry(m) } : { state: 'none' };
  }

  // 從行李拿出來後：位置回到原本的家（不算一次移動）
  function restoreHome(m) {
    if (!m || packedItem(m)) return;
    var L = m.location || {};
    if (L.state === 'packed' || L.state === 'pending') {
      m.location = { state: 'home', home: L.fromHome || homeOfEntry(m), since: todayStr() };
    }
  }

  function locText(loc) {
    if (!loc || loc.state === 'none') return '📍 未設定家';
    if (loc.state === 'home') return '📍 ' + loc.home;
    if (loc.state === 'pending') return '⏳ 待確認（已到' + loc.home + '）';
    return '🧳 在行李裡' + (loc.fromHome ? '（從' + loc.fromHome + '帶出）' : '');
  }

  function shortDate(d) {
    if (!d) return '';
    var p = d.split('-');
    return (+p[1]) + '/' + (+p[2]) + ' ';
  }

  function addMove(m, home, date, prevHome) {
    if (!Array.isArray(m.moves)) m.moves = [];
    if (!m.moves.length && prevHome && prevHome !== home) m.moves.push({ home: prevHome, date: '' });
    var last = m.moves[m.moves.length - 1];
    if (last && last.home === home) return;
    m.moves.push({ home: home, date: date || '' });
    if (m.moves.length > 40) m.moves.shift();
  }

  function movesText(m) {
    var list = (m.moves || []).map(function (x) { return shortDate(x.date) + x.home; });
    var loc = locOf(m);
    if (!list.length && loc && loc.state === 'home') list.push(loc.home);
    if (loc && loc.state === 'packed') list.push('行李中');
    if (loc && loc.state === 'pending') list.push('待確認（' + loc.home + '）');
    return list.join(' → ');
  }

  // 放進行李：記住從哪個家帶出
  function markPacked(m, bagId) {
    if (!m) return;
    var cur = locOf(m);
    var from = cur.state === 'home' ? cur.home : (cur.fromHome || homeOfEntry(m));
    if (from && !(m.moves || []).length) addMove(m, from, '', '');
    m.location = { state: 'packed', bagId: bagId, fromHome: from, since: todayStr() };
  }

  // 放在某個家；record 為 true 時記一筆移動紀錄
  function markHome(m, home, date, record) {
    if (!m) return;
    var cur = locOf(m);
    var prev = cur.state === 'home' ? cur.home : (cur.fromHome || '');
    m.location = { state: 'home', home: home, since: date || todayStr() };
    setHomeOfEntry(m, home);
    if (record && home) addMove(m, home, date || todayStr(), prev);
  }

  // 把一件常帶物品（例如衣櫃裡的衣服）放進指定的行李
  function packEntry(m, bagId) {
    markPacked(m, bagId);
    // 抽屜物品有記數量的話，整份一起帶（例如泡麵 × 3 包）
    var counted = !isCloth(m) && m.count > 0;
    var item = {
      id: uid(), name: m.name, weight: m.weight, qty: counted ? m.count : 1, unit: counted ? (m.countUnit || m.unit || '個') : (m.unit || '個'),
      category: m.category || '必備品', bagId: bagId, catalogId: m.id
    };
    state.items.push(item);
    m.bagId = bagId;
    m.uses = (m.uses || 0) + 1;
    save();
    return item;
  }

  // 從行李拿出來（同一件放了好幾次，就全部拿出來）
  function unpackEntry(m) {
    var cur = locOf(m);
    state.items = state.items.filter(function (it) { return it.catalogId !== m.id; });
    // 取消打包：回到原本的家（不算一次移動）
    if (cur && cur.state !== 'home' && cur.state !== 'none') {
      m.location = { state: 'home', home: cur.fromHome || homeOfEntry(m), since: todayStr() };
    }
    save();
  }

  var picker = Clothing.createPicker($('#f-tags'), {
    brands: allBrands,
    homes: homes,
    addHome: addHome,
    homeCity: homeCity,
    setHomeCity: setHomeCity,
    makeDrawerEntry: makeDrawerEntry,
    tripDataCounts: tripDataCounts,
    deleteTrip: deleteTrip,
    nextTrip: nextTrip,
    mustList: mustList,
    addMust: addMust,
    removeMust: removeMust,
    setMustZone: setMustZone,
    groupRemains: groupRemains,
    renderNextPack: renderNextPack,
    customs: customs,
    addCustom: addCustom,
    watches: watches,
    onChange: function (tags, key) {
      tagsTouched = true;
      syncHeavy();
      // 睡衣以「一套」為單位
      if (key === 'group') {
        if (tags.group === '睡衣') setUnit('套');
        else if (unit === '套') setUnit('個');
      }
      if (key === 'group' || key === 'type' || key === 'subtype') {
        var tn = Clothing.typeName(tags);
        var nameEl = $('#f-name');
        // 名稱空白（或是剛才自動填的）就用種類當名稱
        if (tn && (!nameEl.value.trim() || nameEl.value === autoName)) {
          nameEl.value = autoName = tn;
          if (selectedId) deselect(true);
        }
        if (weightSource !== 'user' && weightSource !== 'memory' && tn) {
          var ref = findRef(Clothing.refName(tags)) || findRef(tags.group);
          if (ref) {
            setWeightField(ref.weight);
            setWeightSource('ref', '參考「' + ref.name + '」' + (ref.note ? '（' + ref.note + '）' : '') +
              '的大約重量，秤過之後可以直接改成實際重量。');
          }
        }
      }
      updatePreview();
    }
  });

  function syncClothingBox() {
    $('#f-clothing').hidden = $('#f-cat').value !== '必備品';
    syncHeavy();
  }

  // 鞋子很重：重量欄位特別顯眼
  function syncHeavy() {
    var heavy = $('#f-cat').value === '必備品' && picker.get().group === '鞋子';
    $('#f-weight-label').classList.toggle('weight-strong', heavy);
    $('#f-heavy-tip').hidden = !heavy;
  }

  // 衣櫃裡的手錶（錶帶選「適用手錶」用）
  function watches() {
    return state.memory.filter(function (m) {
      return m.clothing && m.clothing.group === '配件' && m.clothing.type === '手錶';
    }).map(function (m) { return { id: m.id, name: m.name }; });
  }

  function showFormPhoto(url) {
    $('#f-photo-preview').hidden = !url;
    $('#f-photo-label').textContent = url ? '換一張照片' : '加入照片';
    if (url) $('#f-photo-img').src = url;
  }

  function resetPhoto() {
    newPhoto = null;
    entryPhotoId = null;
    photoRemoved = false;
    showFormPhoto(null);
  }

  // 取消「正在使用某件常帶物品」；keepTags 為 true 時保留已點的標籤
  function deselect(keepTags) {
    selectedId = null;
    if (!newPhoto) resetPhoto();
    else entryPhotoId = null;
    if (!keepTags && !tagsTouched) picker.set(Clothing.empty());
    syncHeavy();
  }

  $('#f-photo').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    toast('照片壓縮中…');
    Photos.compress(file).then(function (p) {
      newPhoto = p;
      photoRemoved = false;
      showFormPhoto(URL.createObjectURL(p.blob));
      toast('照片已壓縮為 ' + Math.max(1, Math.round(p.size / 1024)) + ' KB');
    }).catch(function () {
      toast('這張照片讀不到，請換一張試試');
    });
  });

  $('#f-photo-remove').addEventListener('click', function () {
    newPhoto = null;
    if (entryPhotoId) photoRemoved = true;
    showFormPhoto(null);
  });

  $('#f-cat').addEventListener('change', syncClothingBox);

  function renderAdd() {
    var cat = $('#f-cat').value;
    $('#f-cat').innerHTML = CATEGORY_LIST.map(function (c, i) {
      return '<option value="' + esc(c.name) + '">' + NUMS[i] + ' ' + esc(c.name) +
        (c.hint ? '（' + esc(c.hint) + '）' : '') + '</option>';
    }).join('');
    if (cat) $('#f-cat').value = cat;

    var current = $('#f-bag').value;
    $('#f-bag').innerHTML = bagOptions();
    if (isTripBag(current)) $('#f-bag').value = current;

    syncClothingBox();
    picker.render();
    renderMemory();
    updatePreview();
  }

  function renderMemory() {
    renderClosetPick();
    var list = state.memory.filter(function (m) { return !isCloth(m); }).sort(function (a, b) {
      return (b.uses || 0) - (a.uses || 0) || (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    $('#memory-list').innerHTML = list.map(function (m) {
      return '<button type="button" class="chip' + (m.photoId ? ' has-thumb' : '') + (m.id === selectedId ? ' on' : '') +
        '" data-mem="' + esc(m.id) + '">' +
        (m.photoId ? '<img class="chip-thumb" data-photo="' + esc(m.photoId) + '" alt="">' : '') +
        esc(m.name) + ' <small>' + (m.estimated ? '約' : '') + fmtWeight(m.weight) + '/' + esc(m.unit) +
        '</small><span class="x">✕</span></button>';
    }).join('');
    Photos.fillThumbs($('#memory-list'));
    $('#memory-empty').hidden = state.memory.length > 0;
    $('#toggle-manage').hidden = list.length === 0;
    if (!list.length) managing = false;
    $('#memory-box').classList.toggle('managing', managing);
    $('#toggle-manage').textContent = managing ? '完成' : '管理';

    var names = [];
    list.forEach(function (m) { if (isPlain(m) && names.indexOf(m.name) < 0) names.push(m.name); });
    (window.REFERENCE_WEIGHTS || []).forEach(function (r) {
      if (names.indexOf(r.name) < 0) names.push(r.name);
    });
    $('#name-options').innerHTML = names.map(function (n) {
      return '<option value="' + esc(n) + '">';
    }).join('');
  }

  // 「從衣櫃挑」：顯示衣櫃裡每件衣服的小照片，點了就帶入表單
  function renderClosetPick() {
    var list = state.memory.filter(isCloth).sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    $('#closet-pick').hidden = !list.length;
    $('#closet-pick-list').innerHTML = list.map(function (m) {
      var c = m.clothing;
      var packed = packedItem(m);
      return '<button type="button" class="pick-tile' + (m.id === selectedId ? ' on' : '') + '" data-pick="' + esc(m.id) + '">' +
        '<span class="pick-ph">' + (m.photoId ? '<img data-photo="' + esc(m.photoId) + '" alt="">' : '') +
        (packed ? '<span class="packed">已打包</span>' : '') + '</span>' +
        '<span class="pick-name">' + esc(m.name) + '</span>' +
        '<span class="pick-home">' + (c.home ? '📍' + esc(c.home) : '&nbsp;') + '</span>' +
        '</button>';
    }).join('');
    Photos.fillThumbs($('#closet-pick-list'));
  }

  $('#closet-pick-list').addEventListener('click', function (e) {
    var tile = e.target.closest('[data-pick]');
    if (!tile) return;
    var m = entryById(tile.getAttribute('data-pick'));
    if (!m) return;
    if (selectedId === m.id) { deselect(); renderMemory(); return; }
    var packed = packedItem(m);
    if (packed) {
      var bag = bagById(packed.bagId);
      if (!confirm('「' + m.name + '」已經打包在' + (bag ? bag.name : '行李') + '，還要再放一次嗎？')) return;
    }
    applyMemory(m);
    toast('已從衣櫃帶入「' + m.name + '」，確認後按「加入行李」');
  });

  // 用名稱找一般物品（有照片或衣服標籤的每件都是獨立的，不用名稱合併）
  function findMemory(name) {
    var key = norm(name);
    if (!key) return null;
    return state.memory.find(function (m) { return isPlain(m) && norm(m.name) === key; });
  }

  function applyMemory(m) {
    selectedId = m.id;
    $('#f-name').value = m.name;
    autoName = '';
    setWeightField(m.weight);
    setWeightSource(m.estimated ? 'ref' : 'memory',
      m.estimated ? '這是參考重量，秤過之後可以直接改成實際重量。' : '');
    if (CATEGORIES.indexOf(m.category) >= 0) $('#f-cat').value = m.category;
    if (isTripBag(m.bagId)) $('#f-bag').value = m.bagId;
    $('#f-qty').value = 1;
    setUnit(m.unit || '個');

    newPhoto = null;
    photoRemoved = false;
    entryPhotoId = m.photoId || null;
    showFormPhoto(null);
    if (entryPhotoId) Photos.url(entryPhotoId).then(function (u) {
      if (selectedId === m.id && !newPhoto && !photoRemoved) showFormPhoto(u);
    });
    picker.set(m.clothing || Clothing.empty());
    tagsTouched = false;
    syncClothingBox();
    renderMemory();
  }

  function weightKg() {
    var v = parseFloat($('#f-weight').value);
    if (!isFinite(v) || v < 0) return NaN;
    return $('#f-wunit').value === 'g' ? v / 1000 : v;
  }

  function updatePreview() {
    var w = weightKg();
    var q = parseInt($('#f-qty').value, 10);
    var name = $('#f-name').value.trim();
    $('#preview').textContent = (isFinite(w) && q > 0)
      ? (name || '這項物品') + '：' + q + ' ' + unit + '，共 ' + fmtWeight(w * q)
      : '';
  }

  // 沒有其他物品用到這張照片，才真的刪掉
  function dropPhotoIfUnused(photoId) {
    if (!photoId) return;
    if (state.memory.some(function (m) { return m.photoId === photoId; })) return;
    if (((state.shopping || {}).purchases || []).some(function (p) { return p.photoId === photoId; })) return;   // 購物紀錄還在用
    Photos.del(photoId).catch(function () {});
    // 雲端的照片也一起刪掉（沒網路時等有網路再刪）
    if (window.Cloud) window.Cloud.queueDelete(photoId);
  }

  $('#memory-list').addEventListener('click', function (e) {
    var chip = e.target.closest('[data-mem]');
    if (!chip) return;
    var m = entryById(chip.getAttribute('data-mem'));
    if (!m) return;
    if (managing) {
      if ((m.photoId || m.clothing) && !confirm('要從常帶物品移除「' + m.name + '」嗎？照片和標籤也會一起刪除，衣櫃裡也會看不到。')) return;
      state.memory = state.memory.filter(function (x) { return x !== m; });
      dropPhotoIfUnused(m.photoId);
      if (selectedId === m.id) deselect();
      save();
      renderMemory();
      toast('已移除「' + m.name + '」');
      return;
    }
    if (selectedId === m.id) { deselect(); renderMemory(); return; }
    applyMemory(m);
    toast('已帶入「' + m.name + '」');
  });

  $('#toggle-manage').addEventListener('click', function () {
    managing = !managing;
    renderMemory();
  });

  // 輸入名稱時：自動帶入重量，並猜衣服種類
  $('#f-name').addEventListener('input', function () {
    if (selectedId) {
      var m = entryById(selectedId);
      if (!m || norm(m.name) !== norm(this.value)) { deselect(); renderMemory(); }
    }
    autoName = '';
    autofillFromName();
    if (!tagsTouched && !selectedId) {
      var g = $('#f-cat').value === '必備品' ? Clothing.guess(this.value, norm) : null;
      var cur = picker.get();
      if (g) picker.apply(g);
      else if (cur.group) picker.apply({ group: '', type: '', subtype: '' });
    }
    // 猜到是睡衣就用「套」，不是就換回「個」
    if (picker.get().group === '睡衣') setUnit('套');
    else if (unit === '套') setUnit('個');
    syncClothingBox();
  });

  // 自己改了重量或單位，就以輸入的為準
  ['#f-weight', '#f-wunit'].forEach(function (sel) {
    $(sel).addEventListener('input', function () {
      setWeightSource($('#f-weight').value ? 'user' : '');
    });
  });

  ['#f-name', '#f-weight', '#f-qty', '#f-wunit'].forEach(function (sel) {
    $(sel).addEventListener('input', updatePreview);
  });

  $('#f-unit').addEventListener('click', function (e) {
    var b = e.target.closest('[data-unit]');
    if (b) setUnit(b.getAttribute('data-unit'));
  });

  form.querySelector('.stepper').addEventListener('click', function (e) {
    var b = e.target.closest('[data-step]');
    if (!b) return;
    var q = parseInt($('#f-qty').value, 10) || 1;
    $('#f-qty').value = Math.max(1, q + parseInt(b.getAttribute('data-step'), 10));
    updatePreview();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#f-name').value.trim();
    var w = weightKg();
    var q = parseInt($('#f-qty').value, 10);
    if (!name) { toast('請輸入名稱'); return; }
    if (!isFinite(w)) { toast('請輸入正確的重量'); return; }
    if (!(q >= 1)) { toast('數量至少為 1'); return; }

    var category = $('#f-cat').value;
    var tags = picker.get();
    var clothing = category === '必備品' && Clothing.hasTags(tags) ? JSON.parse(JSON.stringify(tags)) : null;

    // 決定要記在哪一筆常帶物品
    //  - 點選了常帶物品：更新那一筆；但如果它已經有照片又拍了新照片，就當作「另一件」
    //  - 一般物品（沒照片、沒標籤）：用名稱找同一筆
    //  - 其他（有照片或衣服標籤）：每件都是新的一筆
    var sel = selectedId && entryById(selectedId);
    var entry = null;
    if (sel && !(newPhoto && sel.photoId)) entry = sel;
    else if (!sel && !newPhoto && !clothing) entry = findMemory(name);
    var isNewEntry = !entry;
    if (!entry) {
      entry = normalizeEntry({ uses: 0, photoId: sel && !photoRemoved && !newPhoto ? sel.photoId : null });
      state.memory.push(entry);
    }
    entry.name = name;
    entry.weight = w;
    entry.unit = unit;
    entry.category = category;
    entry.bagId = $('#f-bag').value;
    entry.estimated = weightSource === 'ref';
    entry.clothing = clothing;
    entry.uses = (entry.uses || 0) + 1;
    entry.updatedAt = Date.now();

    var oldPhotoId = null;
    if (photoRemoved && !newPhoto && entry.photoId) { oldPhotoId = entry.photoId; entry.photoId = null; }

    var item = {
      id: uid(), name: name, weight: w, qty: q, unit: unit,
      category: category, bagId: entry.bagId, catalogId: entry.id
    };
    if (!packedItem(entry)) markPacked(entry, item.bagId);
    state.items.push(item);

    var photoJob = Promise.resolve();
    if (newPhoto) {
      entry.photoId = entry.id;
      photoJob = Photos.put(entry.photoId, newPhoto).catch(function () {
        entry.photoId = null;
        save();
        toast('照片存不進去，可能是瀏覽器空間不足；物品已照常加入');
      });
    }
    save();
    dropPhotoIfUnused(oldPhotoId);

    var bag = bagById(item.bagId);
    toast('已放進' + (bag ? bag.name : '行李') + '：' + name + ' × ' + q + ' ' + unit +
      (isNewEntry && (newPhoto || clothing) ? '（已加入常帶物品）' : ''));

    // 清空表單，但保留品類與行李方便連續新增
    $('#f-name').value = '';
    $('#f-weight').value = '';
    $('#f-wunit').value = 'kg';
    $('#f-qty').value = 1;
    setUnit('個');
    setWeightSource('');
    selectedId = null;
    autoName = '';
    resetPhoto();
    picker.set(Clothing.empty());
    tagsTouched = false;
    syncHeavy();
    photoJob.then(renderMemory);
    renderMemory();
    $('#f-name').focus();
  });

  // ---------- 畫面切換 ----------
  // 網址：#home、#add、#closet（衣櫃）、#closet/new（新增衣服）、#closet/<id>（編輯衣服）
  function route() {
    // 免洗內褲：旅程中每過一天扣掉一件（行李變輕）
    if (window.Intimates && window.Intimates.consume()) save();
    // 補貨：抵達那個家之後，在路上買的、網路訂好的消耗品補成「滿」
    if (window.Consumables && window.Consumables.applyArrivals()) save();
    // 登入後雲端帶回來的語言設定（換裝置也維持同一個語言）
    if (!sampleMode() && state.prefs && (state.prefs.lang === 'en' || state.prefs.lang === 'zh') && window.I18N && state.prefs.lang !== window.I18N.lang()) {
      window.I18N.set(state.prefs.lang, { quiet: true });
    }
    var parts = location.hash.replace(/^#/, '').split('/');
    // 「放進行李」頁已經整併到打包清單（手動新增）和首頁「我的行李」
    if (parts[0] === 'add') { location.replace('#pack'); return; }
    var VIEWS = ['home', 'add', 'closet', 'trips', 'pack', 'drawer', 'shop', 'bags', 'outfit'];
    var view = VIEWS.indexOf(parts[0]) >= 0 ? parts[0] : 'home';
    VIEWS.forEach(function (v) { $('#view-' + v).hidden = v !== view; });
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      a.classList.toggle('on', (a.getAttribute('data-views') || '').split(' ').indexOf(view) >= 0);
    });
    if (view === 'home') renderHome();
    else if (view === 'add') renderAdd();
    else if (view === 'pack') { if (window.Packing) window.Packing.show(); }
    else if (view === 'drawer') { if (window.Drawer) window.Drawer.show(); }
    else if (view === 'shop') { if (window.Shop) window.Shop.show(parts[1]); }
    else if (view === 'bags') { if (window.Bags) window.Bags.show(); }
    else if (view === 'trips') { if (window.Trips) window.Trips.show(decodeURIComponent(parts.slice(1).join('/'))); }
    else if (view === 'outfit') { if (window.Outfit) window.Outfit.show(decodeURIComponent(parts[1] || ''), decodeURIComponent(parts[2] || '')); }
    else if (window.Closet) window.Closet.show(decodeURIComponent(parts.slice(1).join('/')));
    window.scrollTo(0, 0);
    if (window.Onboard) window.Onboard.afterRoute(view);   // 第一次使用設定、範例提示列、使用提示
  }

  // 給衣櫃（closet.js）使用的共用功能
  // 語言切換後：重新畫目前的畫面（表單頁不重畫，免得打到一半的內容不見）
  function rerender() { refreshView(); if (location.hash === '' || location.hash === '#home') renderHome(); }

  window.App = {
    rerender: rerender,
    reserveText: reserveText, openGoal: openGoal,
    saveQuiet: saveQuiet,
    replaceState: replaceState,
    refreshView: refreshView,
    state: function () { return state; },
    save: save,
    toast: toast,
    renderHome: renderHome,
    remainInfo: remainInfo,
    tripRemain: tripRemain,
    autoBag: autoBag,
    groupOf: groupOf,
    kindName: kindName,
    allowanceOf: allowanceOf,
    removeCustom: removeCustom,
    normalizeBag: normalizeBag,
    moveBagContents: moveBagContents,
    bagLocOf: bagLocOf,
    bagKinds: function () { return BAG_KINDS; },
    pickBags: pickBags,
    isTripBag: isTripBag,
    bagLabel: bagLabel,
    bagOptions: bagOptions,
    GIFT_ICON: GIFT_ICON,
    esc: esc,
    uid: uid,
    fmtWeight: fmtWeight,
    findRef: findRef,
    norm: norm,
    normalizeEntry: normalizeEntry,
    entryById: entryById,
    allBrands: allBrands,
    dropPhotoIfUnused: dropPhotoIfUnused,
    homes: homes,
    addHome: addHome,
    homeCity: homeCity,
    setHomeCity: setHomeCity,
    makeDrawerEntry: makeDrawerEntry,
    tripDataCounts: tripDataCounts,
    deleteTrip: deleteTrip,
    nextTrip: nextTrip,
    mustList: mustList,
    addMust: addMust,
    removeMust: removeMust,
    setMustZone: setMustZone,
    groupRemains: groupRemains,
    renderNextPack: renderNextPack,
    renameHome: renameHome,
    sampleMode: sampleMode,
    signedIn: signedIn,
    checkVersion: checkVersion,
    enterSample: enterSample,
    exitSample: exitSample,
    clearLocalData: clearLocalData,
    dropSample: dropSample,
    removeHome: removeHome,
    homeUsage: homeUsage,
    isEmptyState: isEmptyState,
    customs: customs,
    addCustom: addCustom,
    watches: watches,
    nextLeg: nextLeg,
    normalizeTrip: normalizeTrip,
    normalizeLeg: normalizeLeg,
    isCloth: isCloth,
    packedItem: packedItem,
    packEntry: packEntry,
    unpackEntry: unpackEntry,
    locOf: locOf,
    homeOfEntry: homeOfEntry,
    restoreHome: restoreHome,
    categories: function () { return CATEGORY_LIST; },
    locText: locText,
    movesText: movesText,
    markPacked: markPacked,
    markHome: markHome,
    todayStr: todayStr,
    bagById: bagById
  };

  // 換頁（包括按返回、往回滑）時，把上一頁開著的視窗關掉，不然會蓋住新的頁面、點不到
  // （第一次使用設定除外）
  window.addEventListener('hashchange', function () {
    document.querySelectorAll('.sheet:not([hidden])').forEach(function (el) {
      if (el.id !== 'onboard-sheet') el.hidden = true;
    });
  });
  window.addEventListener('hashchange', route);
  // 其他分頁改了資料時同步
  window.addEventListener('storage', function (e) {
    if (e.key === dataKey()) { state = load(); route(); }
  });

  // 啟動時檢查：照片其實不存在的（例如上一版沒拍照的衣服），改成沒有照片
  function checkPhotos() {
    // 只檢查上一版衣櫃轉過來的衣服（照片 id 沿用舊衣服 id）；其他照片可能還在雲端等下載，不能清掉
    var legacy = (state.legacyWardrobe || []).map(function (w) { return w.id; });
    if (state.legacyPhotosChecked) return;
    var withPhoto = state.memory.filter(function (m) { return m.photoId && legacy.indexOf(m.photoId) >= 0; });
    Promise.all(withPhoto.map(function (m) {
      return Photos.get(m.photoId).then(function (p) { return p ? null : m; }).catch(function () { return null; });
    })).then(function (missing) {
      missing = missing.filter(Boolean);
      missing.forEach(function (m) { m.photoId = null; });
      state.legacyPhotosChecked = true;
      if (missing.length || !state.pristine) save(); else saveQuiet();   // 啟動檢查不算「動過資料」
      if (missing.length) route();
    });
  }

  // 等所有程式（包含 closet.js）都載入後再顯示畫面
  document.addEventListener('DOMContentLoaded', function () {
    route();
    checkPhotos();
    checkGoals(true);   // 記下目前的狀態，打開 app 時不跳提醒
  });

  // ---------- 新版本提示 ----------
  // 每次打開或回到前景時，向網站要 version.json（不用暫存）和目前的版本比對；
  // 有新版就在下方顯示「有新版本・點一下更新」。更新只換程式檔案，localStorage／IndexedDB 裡的資料都不動。
  var APP_VERSION = (document.querySelector('meta[name="app-version"]') || {}).content || '';
  $('#app-version').textContent = '版本 ' + (APP_VERSION || '—');
  var checkingVersion = false;
  function checkVersion() {
    if (checkingVersion || !navigator.onLine || !APP_VERSION) return;
    checkingVersion = true;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (v && v.version && v.version !== APP_VERSION) $('#update-bar').hidden = false;
    }).catch(function () { /* 沒網路就下次再看 */ }).then(function () { checkingVersion = false; });
  }
  function applyUpdate() {
    $('#update-bar').textContent = '更新中…';
    var sw = navigator.serviceWorker;
    // 1. 請 Service Worker 抓新版；2. 清掉舊的程式快取（只有程式檔案，不是你的資料）；3. 重新載入
    Promise.resolve(sw ? sw.getRegistration().then(function (reg) { return reg && reg.update(); }) : null).catch(function () {})
      .then(function () { return window.caches ? caches.keys().then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); }) : null; })
      .catch(function () {})
      .then(function () { location.reload(); });
  }
  $('#update-bar').addEventListener('click', applyUpdate);
  window.addEventListener('load', function () { setTimeout(checkVersion, 1500); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkVersion(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) checkVersion(); });   // Safari 從記憶體還原頁面時
  window.addEventListener('online', checkVersion);

  // 讓 app 沒有網路時也能打開
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      // updateViaCache: 'none'：檢查 app 有沒有新版時，不用瀏覽器暫存的舊檔
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        reg.update().catch(function () {});
      }).catch(function () { /* 不支援就算了 */ });
      // 新版接手後自動重新載入一次，畫面就會是最新版
      var hadController = !!navigator.serviceWorker.controller;
      var reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController || reloaded) return;
        reloaded = true;
        location.reload();
      });
    });
  }
})();
