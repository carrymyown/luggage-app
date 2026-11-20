/*
 * 資料安全測試（固定的一組，每次修改登入、登出、同步、範例或資料格式都要先跑過，全部通過才可以發布）
 *
 *   執行：node tests/safety.js
 *   需要：Playwright（Chromium）。不用開伺服器：app 的檔案直接從這個資料夾讀。
 *
 * 用一個「模擬的 Supabase」（存在這支程式的記憶體裡，兩台模擬裝置共用同一份雲端），
 * 也照 supabase/safety.sql 的規則擋下：範例資料、物品／旅程一次少一半以上（沒有確認過的話）、並保留之前的版本。
 * 每個情況結束都檢查：雲端的資料沒有被覆蓋或遺失。
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const ROOT = process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT) : path.resolve(__dirname, '..');   // APP_ROOT：測試別的版本（例如舊版）
const BASE = 'http://localhost:8765/';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const DEVICE = devices['iPad (gen 7)'];

// ---------------- 模擬的雲端 ----------------
const S = { row: null, history: [], hid: 1, writes: 0, blocked: [] };
const UID = 'u-test';
const cp = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const cnt = (d, k) => (d && Array.isArray(d[k]) ? d[k].length : 0);
// SERVER_GUARD=off：關掉雲端這一層，確認 app 自己也能保護資料（還沒執行 safety.sql 的帳號就是這樣）
const SERVER_GUARD = process.env.SERVER_GUARD !== 'off';
function guard(nd, nv, od, force) {
  if (!SERVER_GUARD && !force) return '';
  if (nd && nd.sampleBuilt) return 'CMO_SAMPLE_BLOCKED';
  if (od) {
    const om = cnt(od, 'memory'), nm = cnt(nd, 'memory'), ot = cnt(od, 'trips'), nt = cnt(nd, 'trips');
    if (((om >= 3 && nm * 2 < om) || (ot >= 2 && nt * 2 < ot)) && String((nd || {}).shrinkOk || '') !== String(nv)) return 'CMO_SHRINK_BLOCKED';
  }
  return '';
}
function serve(q, offline, force) {
  if (offline) return { data: null, error: { message: 'Failed to fetch' } };
  if (q.table === 'app_state') {
    if (q.op === 'select') {
      if (!S.row) return { data: null, error: null };
      return { data: q.cols.indexOf('data') >= 0 ? { data: cp(S.row.data), version: S.row.version } : { version: S.row.version }, error: null };
    }
    if (q.op === 'insert') {
      if (S.row) return { error: { code: '23505', message: 'duplicate key' } };
      const g = guard(q.payload.data, q.payload.version, null);
      if (g) { S.blocked.push(g); return { error: { code: 'P0001', message: g } }; }
      S.row = { data: cp(q.payload.data), version: q.payload.version };
      S.writes++;
      return { data: null, error: null };
    }
    if (q.op === 'update') {
      if (!S.row || S.row.version !== q.filters.version) return { data: [], error: null };
      const g = guard(q.payload.data, q.payload.version, S.row.data, force);
      if (g) { S.blocked.push(g); return { data: null, error: { code: 'P0001', message: g } }; }
      if (JSON.stringify(S.row.data) !== JSON.stringify(q.payload.data)) {
        S.history.unshift({ id: S.hid++, user_id: UID, version: S.row.version, data: cp(S.row.data), item_count: cnt(S.row.data, 'memory'), trip_count: cnt(S.row.data, 'trips'), saved_at: new Date(Date.now() - S.history.length * 60000).toISOString() });
        S.history = S.history.slice(0, 50);
      }
      S.row = { data: cp(q.payload.data), version: q.payload.version };
      S.writes++;
      return { data: [{ version: S.row.version }], error: null };
    }
  }
  if (q.table === 'app_state_history') {
    if (q.single) { const h = S.history.find((x) => String(x.id) === String(q.filters.id)); return { data: h ? { data: cp(h.data) } : null, error: null }; }
    return { data: S.history.map((h) => ({ id: h.id, version: h.version, saved_at: h.saved_at, item_count: h.item_count, trip_count: h.trip_count })), error: null };
  }
  return { data: null, error: { message: 'unknown' } };
}

// 瀏覽器裡的 supabase-js 替身：資料表的讀寫都交給上面的模擬雲端
const STUB = `window.supabase = { createClient: function () {
  var KEY = 'sb-luggage-auth', cbs = [];
  function session() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function emit(ev, s) { cbs.forEach(function (cb) { setTimeout(function () { cb(ev, s); }, 0); }); }
  function table(name) {
    var q = { table: name, op: 'select', payload: null, filters: {}, cols: '', single: false };
    function run() { return window.__mock(JSON.parse(JSON.stringify(q))); }
    var o = {
      select: function (c) { if (q.op === 'select') q.cols = c || ''; return o; },
      eq: function (k, v) { q.filters[k] = v; return o; },
      order: function () { return o; }, limit: function () { return o; },
      insert: function (p) { q.op = 'insert'; q.payload = p; return o; },
      update: function (p) { q.op = 'update'; q.payload = p; return o; },
      maybeSingle: function () { q.single = true; return run(); },
      then: function (a, b) { return run().then(a, b); }
    };
    return o;
  }
  return {
    auth: {
      onAuthStateChange: function (cb) { cbs.push(cb); setTimeout(function () { cb('INITIAL_SESSION', session()); }, 10); return { data: { subscription: { unsubscribe: function () {} } } }; },
      signInWithPassword: function () { var s = { access_token: 'x', user: { id: '${UID}', email: 'test@example.com' } }; localStorage.setItem(KEY, JSON.stringify(s)); emit('SIGNED_IN', s); return Promise.resolve({ data: { session: s }, error: null }); },
      signUp: function () { return Promise.resolve({ error: { message: 'stub' } }); },
      signOut: function () { localStorage.removeItem(KEY); emit('SIGNED_OUT', null); return Promise.resolve({ error: null }); },
      resetPasswordForEmail: function () { return Promise.resolve({ error: null }); },
      updateUser: function () { return Promise.resolve({ error: null }); }
    },
    from: table,
    storage: { from: function () { return {
      upload: function () { return Promise.resolve({ error: null }); },
      download: function () { return Promise.resolve({ data: null, error: { message: 'not found' } }); },
      list: function () { return Promise.resolve({ data: [], error: null }); },
      remove: function () { return Promise.resolve({ data: [], error: null }); }
    }; } }
  };
} };`;

// ---------------- 小工具 ----------------
const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? '  (' + detail + ')' : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;

async function newDevice(opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ ...DEVICE, serviceWorkers: 'block', deviceScaleFactor: 1, locale: 'zh-TW' });
  const dev = { ctx, offline: false, answer: 'accept', dialogs: [], errors: [] };
  await ctx.route(/^http:\/\/localhost:8765\//, (r) => {
    let u = new URL(r.request().url()).pathname; if (u.endsWith('/')) u += 'index.html';
    const f = path.join(ROOT, decodeURIComponent(u));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: 'nf' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'text/plain', body: fs.readFileSync(f) });
  });
  await ctx.route('**/vendor/supabase.js', (r) => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await ctx.route(/open-meteo\.com/, (r) => r.abort());
  await ctx.exposeFunction('__mock', (q) => cp(serve(q, dev.offline)));
  await ctx.addInitScript((lang) => {
    try { localStorage.setItem('cmo-intro-seen', '1'); localStorage.setItem('cmo-coach', JSON.stringify({ step: 0, done: true })); if (!localStorage.getItem('cmo-lang')) localStorage.setItem('cmo-lang', lang); } catch (e) { /* */ }
  }, opts.lang || 'zh');
  if (opts.init) await ctx.addInitScript(opts.init.fn, opts.init.arg);
  const page = await ctx.newPage();
  page.on('dialog', (d) => { dev.dialogs.push(d.message().split('\n')[0]); dev.answer === 'accept' ? d.accept() : d.dismiss(); });
  page.on('pageerror', (e) => dev.errors.push(e.message));
  dev.page = page;
  await page.goto(BASE + '#home');
  await wait(1500);
  return dev;
}
async function setOffline(dev, on) { dev.offline = on; await dev.ctx.setOffline(on); }
async function synced(dev, timeout) {
  const end = Date.now() + (timeout || 12000);
  while (Date.now() < end) {
    const st = await dev.page.evaluate(() => (window.Cloud ? window.Cloud.status().state : '')).catch(() => '');
    if (st === 'ok') { await wait(400); return true; }
    await wait(300);
  }
  return false;
}
async function syncNow(dev) { await dev.page.evaluate(() => window.Cloud.sync()).catch(() => {}); await wait(600); }
async function login(dev) {
  await dev.page.click('#account-btn'); await wait(250);
  if (await dev.page.isVisible('#cl-show-login')) { await dev.page.click('#cl-show-login'); await wait(150); }
  await dev.page.fill('#cl-email', 'test@example.com'); await dev.page.fill('#cl-pass', 'secret123');
  await dev.page.click('#cl-login');
  await wait(2500);   // 範例模式中登入：清掉範例後重新載入
  await dev.page.waitForLoadState('load').catch(() => {});
  return synced(dev);
}
async function logout(dev) {
  await dev.page.evaluate(() => document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; }));
  await dev.page.click('#account-btn'); await wait(250);
  await dev.page.click('#cl-logout');
  await wait(3000);
  await dev.page.waitForLoadState('load').catch(() => {});
  await wait(1200);
}
const local = (dev) => dev.page.evaluate(() => ({ sample: App.sampleMode(), memory: App.state().memory.length, trips: App.state().trips.length, ids: App.state().memory.map((m) => m.id), names: App.state().memory.map((m) => m.name) }));
const remote = () => ({ memory: cnt(S.row && S.row.data, 'memory'), trips: cnt(S.row && S.row.data, 'trips'), ids: ((S.row && S.row.data.memory) || []).map((m) => m.id), sample: !!(S.row && S.row.data.sampleBuilt) || JSON.stringify((S.row || {}).data || {}).indexOf('"sample":true') >= 0, version: S.row && S.row.version });
async function addItem(dev, name) {
  return dev.page.evaluate((n) => { const m = window.Drawer.create({ name: n, weight: 0.1, unit: '個', category: '必備品', home: App.homes()[0], count: 1 }); App.save(); return m.id; }, name);
}
async function deleteItems(dev, ids) {
  await dev.page.evaluate((ids) => { const s = App.state(); s.memory = s.memory.filter((m) => ids.indexOf(m.id) < 0); App.save(); }, ids);
}
async function renameItem(dev, id, name) {
  await dev.page.evaluate(([id, name]) => { const m = App.entryById(id); m.name = name; m.updatedAt = Date.now(); App.save(); }, [id, name]);
}

// 一份「使用者自己的資料」：用範例產生後拿掉範例標記（28 樣物品、1 趟旅程…）
let SEED = null;
async function makeSeed() {
  const dev = await newDevice();
  SEED = await dev.page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(App.state()));
    const strip = (a) => (a || []).forEach((x) => { if (x && typeof x === 'object') delete x.sample; });
    ['memory', 'bags', 'trips', 'gifts', 'items'].forEach((k) => strip(s[k])); strip(s.shopping && s.shopping.purchases);
    delete s.sampleBuilt; delete s.pristine; delete s.sampleHomes;
    const rid = (id) => String(id).replace(/^sample-/, 'real-');
    s.trips.forEach((t) => { t.id = rid(t.id); });
    s.packLists.forEach((l) => { l.id = rid(l.id); });
    if (s.dayPlans) Object.keys(s.dayPlans).forEach((k) => { if (/^sample-/.test(k)) { s.dayPlans[rid(k)] = s.dayPlans[k]; delete s.dayPlans[k]; } });
    (s.shopping.plans || []).forEach((p) => { if (p.tripId) p.tripId = rid(p.tripId); });
    (s.shopping.purchases || []).forEach((p) => { if (p.tripId) p.tripId = rid(p.tripId); });
    (s.gifts || []).forEach((g) => { if (g.tripId) g.tripId = rid(g.tripId); });
    return s;
  });
  await dev.ctx.close();
}
function reset(data, version) { S.row = data ? { data: cp(data), version: version || 5 } : null; S.history = []; S.hid = 1; S.writes = 0; S.blocked = []; }
const seedCount = () => cnt(SEED, 'memory');

// ---------------- 測試情況 ----------------
const scenarios = [];
function scenario(name, fn) { scenarios.push({ name, fn }); }

scenario('登出再登入', async () => {
  reset(SEED);
  const a = await newDevice();
  check('沒登入時顯示範例', (await local(a)).sample === true);
  check('登入後讀到雲端的資料', await login(a) && (await local(a)).memory === seedCount(), JSON.stringify(await local(a).then((x) => x.memory)));
  check('登入後雲端沒有變少', remote().memory === seedCount());
  const id = await addItem(a, '新加的物品');
  await synced(a); await syncNow(a);
  check('新加的物品上傳到雲端', remote().ids.indexOf(id) >= 0);
  await logout(a);
  const l1 = await local(a);
  check('登出後畫面是範例', l1.sample === true);
  check('登出後雲端資料完整', remote().memory === seedCount() + 1, 'remote ' + remote().memory);
  await login(a);
  const l2 = await local(a);
  check('再登入後資料全部回來', l2.memory === seedCount() + 1 && l2.ids.indexOf(id) >= 0, 'local ' + l2.memory);
  check('雲端沒有範例資料', !remote().sample);
  await a.ctx.close();
});

scenario('換一台新裝置登入', async () => {
  reset(SEED);
  const b = await newDevice();
  await login(b);
  const l = await local(b);
  check('新裝置載入雲端的資料', l.memory === seedCount() && !l.sample, 'local ' + l.memory);
  check('雲端沒有被新裝置的空資料蓋掉', remote().memory === seedCount() && remote().trips === cnt(SEED, 'trips'));
  await b.ctx.close();
});

scenario('打開範例、清除範例、再登入', async () => {
  reset(SEED);
  const d = await newDevice();
  await d.page.evaluate(() => { window.Drawer.create({ name: '範例裡加的東西', weight: 0.1, unit: '個', category: '必備品', home: App.homes()[0], count: 1 }); App.save(); });
  await login(d);
  const l = await local(d);
  check('登入後範例不見、換成自己的資料', !l.sample && l.memory === seedCount() && l.names.indexOf('範例裡加的東西') < 0);
  check('範例沒有上傳到雲端', !remote().sample && remote().memory === seedCount());
  // 已登入時看範例
  await d.page.click('#account-btn'); await wait(200);
  await d.page.click('#sample-again'); await wait(2500);
  await d.page.waitForLoadState('load').catch(() => {}); await wait(1500);
  check('再看一次範例：進入範例模式', (await local(d)).sample === true);
  await d.page.evaluate(() => { const s = App.state(); s.memory = s.memory.slice(0, 2); App.save(); });
  await wait(3500);
  check('在範例裡刪東西不會影響雲端', remote().memory === seedCount() && !remote().sample, 'remote ' + remote().memory);
  await d.page.click('#sample-clear'); await wait(2500);
  await d.page.waitForLoadState('load').catch(() => {}); await synced(d);
  const l2 = await local(d);
  check('清除範例後回到自己的資料', !l2.sample && l2.memory === seedCount(), 'local ' + l2.memory);
  check('雲端資料完整、沒有範例', remote().memory === seedCount() && !remote().sample);
  await d.ctx.close();
});

scenario('切換語言', async () => {
  reset(SEED);
  const d = await newDevice();
  await login(d);
  const names0 = remote().ids.length;
  await d.page.click('#account-btn'); await wait(200);
  await d.page.click('[data-lang-pick="en"]'); await wait(1500);
  await d.page.evaluate(() => document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; }));
  for (const h of ['#closet', '#drawer', '#pack', '#trips', '#home']) { await d.page.evaluate((h) => { location.hash = h; }, h); await wait(400); }
  await syncNow(d);
  check('英文模式下雲端資料完整', remote().memory === names0);
  const zhNames = (S.row.data.memory || []).map((m) => m.name).join('');
  check('存進雲端的仍是中文原文（沒有被翻譯）', /[㐀-鿿]/.test(zhNames));
  await d.page.click('#account-btn'); await wait(200);
  await d.page.click('[data-lang-pick="zh"]'); await wait(1200);
  await syncNow(d);
  check('切回中文後雲端資料完整', remote().memory === names0 && (await local(d)).memory === names0);
  await d.ctx.close();
});

scenario('網路中斷時修改，恢復網路後同步', async () => {
  reset(SEED);
  const d = await newDevice();
  await login(d);
  const writes0 = S.writes;
  await setOffline(d, true);
  const before = await local(d);
  const delId = before.ids[0];
  await deleteItems(d, [delId]);
  const newId = await addItem(d, '離線時加的');
  await wait(3500);
  check('離線時不會上傳', S.writes === writes0);
  await setOffline(d, false);
  await d.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await wait(2500); await syncNow(d);
  const r = remote();
  check('恢復網路後：新加的上傳了', r.ids.indexOf(newId) >= 0);
  check('恢復網路後：刪掉的只刪那一筆', r.ids.indexOf(delId) < 0 && r.memory === seedCount(), 'remote ' + r.memory);
  await d.ctx.close();
});

scenario('兩台裝置同時修改', async () => {
  reset(SEED);
  const a = await newDevice(), b = await newDevice();
  await login(a); await login(b);
  const ids = (await local(a)).ids;
  // A：刪掉一樣、加一樣；B：改一樣的名字、加一樣（兩台都還沒拿到對方的修改）
  await setOffline(a, true); await setOffline(b, true);
  await deleteItems(a, [ids[1]]);
  const ya = await addItem(a, 'A 加的');
  await renameItem(b, ids[2], '在 B 改過名字');
  const wb = await addItem(b, 'B 加的');
  await setOffline(a, false); await syncNow(a); await synced(a);
  await setOffline(b, false); await syncNow(b); await synced(b);
  await syncNow(a);
  const r = remote(), la = await local(a), lb = await local(b);
  check('雲端：A 刪的那一樣不見了', r.ids.indexOf(ids[1]) < 0);
  check('雲端：A 和 B 加的都在', r.ids.indexOf(ya) >= 0 && r.ids.indexOf(wb) >= 0);
  check('雲端：B 改的名字保留', (S.row.data.memory.find((m) => m.id === ids[2]) || {}).name === '在 B 改過名字');
  check('雲端：其他東西都在', r.memory === seedCount() + 1, 'remote ' + r.memory);
  check('兩台最後一樣', JSON.stringify(la.ids.slice().sort()) === JSON.stringify(lb.ids.slice().sort()) && la.memory === r.memory);
  await a.ctx.close(); await b.ctx.close();
});

scenario('舊格式資料升級成新格式', async () => {
  const old = cp(SEED);
  delete old.mustVersion; delete old.profile; delete old.cityAvail; delete old.tombstones;
  old.mustList = [['must-passport', '護照', 'pouch', 0.04], ['must-card', '信用卡／現金', 'pouch', 0.05], ['must-powerbank', '行動電源', 'carry', 0.2], ['must-socks', '襪子', 'checked', 0.1]].map((x) => ({ id: x[0], name: x[1], zone: x[2], weight: x[3] }));
  old.mustList.push({ id: 'u1', name: '隱形眼鏡', zone: 'pouch', weight: 0.05 });
  old.memory.forEach((m) => { if (m.clothing) { delete m.clothing.tone; m.clothing.styles = (m.clothing.styles || []).concat(['度假']); } });
  // a. 這台裝置上有舊版存的資料（也有上次同步的紀錄），雲端也是舊格式
  reset(old, 411);
  const a = await newDevice({ init: { fn: (o) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('luggage-app-v1', JSON.stringify(o)); localStorage.setItem('luggage-cloud-v1', JSON.stringify({ userId: 'u-test', version: 411, base: JSON.stringify(o) })); localStorage.setItem('sb-luggage-auth', JSON.stringify({ access_token: 'x', user: { id: 'u-test', email: 't@e' } })); }, arg: old } });
  await synced(a); await a.page.evaluate(() => App.save()); await syncNow(a);
  const la = await local(a);
  check('打開時舊格式的資料完整讀進來', la.memory === seedCount() && !la.sample, 'local ' + la.memory);
  check('升級後雲端資料完整', remote().memory === seedCount(), 'remote ' + remote().memory);
  check('自己加的必帶項目保留', await a.page.evaluate(() => App.mustList().some((m) => m.name === '隱形眼鏡')));
  await a.ctx.close();
  // b. 這台是空的，雲端是舊格式
  reset(old, 411);
  const b = await newDevice();
  await login(b);
  check('新裝置讀舊格式的雲端資料', (await local(b)).memory === seedCount() && remote().memory === seedCount());
  await b.ctx.close();
});

scenario('本機資料讀不懂或是空的：不能覆蓋雲端', async () => {
  for (const kind of ['讀不懂', '空的']) {
    reset(SEED, 7);
    const empty = cp(SEED); ['memory', 'trips', 'items', 'gifts', 'bags'].forEach((k) => { empty[k] = []; }); empty.shopping.purchases = [];
    const d = await newDevice({ init: { fn: ([kind, base, empty]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('luggage-app-v1', kind === '讀不懂' ? '{"broken":' : JSON.stringify(empty)); localStorage.setItem('luggage-cloud-v1', JSON.stringify({ userId: 'u-test', version: 7, base: JSON.stringify(base) })); localStorage.setItem('sb-luggage-auth', JSON.stringify({ access_token: 'x', user: { id: 'u-test', email: 't@e' } })); }, arg: [kind, SEED, empty] } });
    await synced(d); await d.page.evaluate(() => App.save()); await syncNow(d);
    check('本機' + kind + '：雲端資料完整', remote().memory === seedCount(), 'remote ' + remote().memory);
    check('本機' + kind + '：改用雲端的資料', (await local(d)).memory === seedCount());
    await d.ctx.close();
  }
});

scenario('一次少一半以上：先問，取消就不覆蓋', async () => {
  reset(SEED);
  const d = await newDevice();
  await login(d);
  const ids = (await local(d)).ids;
  d.answer = 'dismiss'; d.dialogs = [];
  await deleteItems(d, ids.slice(0, 20)); await syncNow(d); await wait(500);
  check('跳出確認視窗', d.dialogs.some((x) => /少了一半以上/.test(x)), d.dialogs.join(' / '));
  check('按取消：雲端沒有被覆蓋', remote().memory === seedCount());
  check('按取消：改用雲端的資料', (await local(d)).memory === seedCount());
  d.answer = 'accept'; d.dialogs = [];
  await deleteItems(d, ids.slice(0, 20)); await syncNow(d); await wait(500);
  check('按確定：雲端照使用者的決定更新', remote().memory === seedCount() - 20, 'remote ' + remote().memory);
  check('上一版自動留在版本紀錄', S.history.length > 0 && S.history[0].item_count === seedCount());
  // 還原到之前的版本
  await d.page.click('#account-btn'); await wait(200);
  await d.page.click('#history-open'); await wait(800);
  const listed = await d.page.$eval('#history-list', (x) => x.innerText);
  check('「還原到之前的版本」列出時間和物品數量', /物品 \d+/.test(listed));
  await d.page.click('[data-hist-restore] >> nth=0'); await wait(1500);
  check('還原後雲端和這台都回到之前的版本', remote().memory === seedCount() && (await local(d)).memory === seedCount(), 'remote ' + remote().memory);
  await d.ctx.close();
});

scenario('雲端也會擋：沒確認過的大量減少、範例資料', async () => {
  reset(SEED);
  const small = cp(SEED); small.memory = small.memory.slice(0, 3);
  const r1 = serve({ table: 'app_state', op: 'update', payload: { data: small, version: 6 }, filters: { user_id: UID, version: 5 } }, false, true);
  check('沒有確認就少一半以上：雲端拒絕', !!(r1.error && /SHRINK/.test(r1.error.message)) && remote().memory === seedCount());
  const sample = cp(SEED); sample.sampleBuilt = 9;
  const r2 = serve({ table: 'app_state', op: 'update', payload: { data: sample, version: 6 }, filters: { user_id: UID, version: 5 } }, false, true);
  check('範例資料：雲端拒絕', !!(r2.error && /SAMPLE/.test(r2.error.message)));
});

// ---------------- 執行 ----------------
(async () => {
  browser = await chromium.launch();
  await makeSeed();
  console.log('資料安全測試（物品 ' + seedCount() + ' 樣、旅程 ' + cnt(SEED, 'trips') + ' 趟；雲端安全檢查' + (SERVER_GUARD ? '開啟' : '關閉，只靠 app 自己保護') + '）');
  for (const s of scenarios) {
    console.log('\n■ ' + s.name);
    try { await s.fn(); } catch (e) { check(s.name + '：執行時出錯', false, String(e.message || e).split('\n')[0]); }
  }
  await browser.close();
  const pass = results.filter((r) => r.ok).length;
  console.log('\n結果：' + pass + ' / ' + results.length + ' 通過' + (failed ? '，有 ' + failed + ' 項沒有通過' : '，全部通過'));
  process.exit(failed ? 1 : 0);
})();
