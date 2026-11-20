/*
 * 雲端：Supabase 登入與同步
 *
 * - 資料先存在這台裝置（localStorage／IndexedDB），有網路時再和雲端同步，所以沒網路也能用。
 * - 雲端資料表 app_state：每個帳號一筆 { user_id, data, version }；data 裡只存照片路徑（photoPath），
 *   照片本身放 Storage 的 item-photos／<帳號 id>／<照片 id>.jpg（上一版的 photos 空間會自動搬過來）
 * - 每個人只能讀寫自己的資料，由 Supabase 的 Row Level Security 保護（設定見 supabase/setup.sql）。
 * - 兩台裝置都改過時，以「上次同步的內容」為基準逐筆合併：
 *     只有一邊改 → 用改過的；兩邊都新增 → 都保留；一邊刪掉、另一邊沒動 → 刪除；兩邊改同一筆 → 用較新的。
 *
 * 下面的金鑰是 publishable（公開）金鑰，本來就可以放在網頁裡；絕對不要把 service_role 金鑰放進程式。
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://yzdpaczdtwdtmqurreut.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_k68Sm2jBOEYfi4OCKfmFRQ_MYzs7x_4';
  var META_KEY = 'luggage-cloud-v1';   // { userId, version, base（上次同步的資料，JSON 字串）}
  var BUCKET = 'item-photos';      // 照片放這裡：item-photos／<帳號 id>／<照片 id>.jpg
  var OLD_BUCKET = 'photos';       // 上一版用的空間：照片搬到 item-photos 並確認後就刪掉
  var DEL_KEY = 'luggage-photo-deletes';   // 等有網路時要從雲端刪掉的照片（照片 id）

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;

  var client = null;
  var user = null;
  var syncing = null;      // 進行中的同步（Promise）
  var again = false;       // 同步中又有新變更，結束後再跑一次
  var timer = null;
  var status = { state: 'idle', text: '', at: null };

  // ---------- 小工具 ----------
  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveMeta(m) {
    try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* 空間不足時下次再存 */ }
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function hhmm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function friendly(err) {
    var m = (err && (err.message || err.error_description || err.msg)) || String(err || '');
    var code = err && err.code;
    if (/Invalid login credentials/i.test(m)) return 'Email 或密碼不正確';
    if (/Email not confirmed/i.test(m)) return '這個帳號還沒確認，請先到信箱點確認連結';
    if (/already registered|already been registered/i.test(m)) return '這個 Email 已經註冊過了，請直接登入';
    if (/Password should be at least/i.test(m)) return '密碼至少要 6 個字';
    if (/rate limit|too many/i.test(m)) return '嘗試太多次了，請稍等幾分鐘再試';
    if (/valid email|invalid.*email/i.test(m)) return 'Email 格式不正確';
    if (code === '42P01' || code === 'PGRST205' || /app_state/.test(m) && /not exist|schema cache/i.test(m)) {
      return '雲端資料表還沒建立，請先在 Supabase 執行設定 SQL';
    }
    if (/Bucket not found/i.test(m)) return '照片空間 item-photos 還沒建立，請先在 Supabase 執行照片設定 SQL';
    if (/CMO_SHRINK_BLOCKED/.test(m)) return '雲端擋下了這次同步：資料會一次少一半以上';
    if (/CMO_SAMPLE_BLOCKED/.test(m)) return '範例資料不會上傳到雲端';
    if (/row-level security|violates/i.test(m)) return '雲端權限設定不正確，請重新執行設定 SQL';
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return '連不上雲端，有網路後會自動再試';
    return m || '發生錯誤';
  }

  // ---------- 合併 ----------
  function byIdArray(arr) {
    return arr.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x) && x.id; });
  }
  function primitiveArray(arr) {
    return arr.every(function (x) { return x === null || typeof x !== 'object'; });
  }

  // 只刪那一筆：一邊沒有、另一邊有的東西，只有在「刪除紀錄」（tombstones）裡、而且刪除時間比這筆最後修改還晚，才會刪掉；
  // 其他情況（例如這台的資料讀取出錯、整份被換掉而少了東西）一律保留，不會被當成刪除
  function stampOf(x) { return Number(x && (x.updatedAt || x.createdAt)) || 0; }
  function mergeById(b, l, r, hasBase, tombs) {
    tombs = tombs || {};
    function gone(x) { var t = tombs[String(x.id)]; return !!t && t >= stampOf(x); }
    var B = {}, L = {}, R = {};
    b.forEach(function (x) { B[x.id] = x; });
    l.forEach(function (x) { L[x.id] = x; });
    r.forEach(function (x) { R[x.id] = x; });
    function decide(id) {
      var inB = hasBase && id in B, inL = id in L, inR = id in R;
      if (inL && inR) {
        if (eq(L[id], R[id])) return L[id];
        if (inB && eq(L[id], B[id])) return R[id];
        if (inB && eq(R[id], B[id])) return L[id];
        return (R[id].updatedAt || 0) > (L[id].updatedAt || 0) ? R[id] : L[id];
      }
      if (inL) return gone(L[id]) ? null : L[id];   // 雲端那邊刪掉了（有刪除紀錄）才刪
      return gone(R[id]) ? null : R[id];            // 這台刪掉了（有刪除紀錄）才刪
    }
    var out = [], seen = {};
    l.forEach(function (x) { seen[x.id] = 1; var v = decide(x.id); if (v) out.push(v); });
    r.forEach(function (x) { if (seen[x.id]) return; var v = decide(x.id); if (v) out.push(v); });
    return out;
  }

  function mergeSet(b, l, r, hasBase) {
    var out = [];
    if (!l.length || !r.length) return (l.length ? l : r).slice();   // 一邊整個變空的：不當成刪除，保留另一邊
    l.forEach(function (x) {
      if (r.indexOf(x) >= 0 || !(hasBase && b.indexOf(x) >= 0)) { if (out.indexOf(x) < 0) out.push(x); }
    });
    r.forEach(function (x) {
      if (l.indexOf(x) < 0 && !(hasBase && b.indexOf(x) >= 0) && out.indexOf(x) < 0) out.push(x);
    });
    return out;
  }

  function plainObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  // 三方合併：base＝上次同步的內容（第一次同步時是 null，兩邊全部保留）
  // 裡面是物件的欄位（例如回程購物 shopping：plans、purchases、ratio）也逐項合併，兩台都改過時不會整包蓋掉
  function merge3(base, local, remote, tombs) {
    var hasBase = !!base;
    base = base || {};
    // 兩邊的刪除紀錄合在一起（同一筆取比較晚的時間）
    if (!tombs) {
      tombs = {};
      [local && local.tombstones, remote && remote.tombstones].forEach(function (t) {
        if (plainObj(t)) Object.keys(t).forEach(function (id) { if (!(tombs[id] >= t[id])) tombs[id] = Number(t[id]) || 0; });
      });
    }
    var out = {};
    var keys = Object.keys(local).concat(Object.keys(remote).filter(function (k) { return !(k in local); }));
    keys.forEach(function (k) {
      var b = base[k], l = local[k], r = remote[k];
      if (l === undefined) { out[k] = r; return; }
      if (r === undefined) { out[k] = l; return; }
      if (Array.isArray(l) && Array.isArray(r)) {
        var both = l.concat(r);
        var bArr = Array.isArray(b) ? b : [];
        if (byIdArray(both)) { out[k] = mergeById(bArr, l, r, hasBase && Array.isArray(b), tombs); return; }
        if (primitiveArray(both)) { out[k] = mergeSet(bArr, l, r, hasBase && Array.isArray(b)); return; }
      }
      if (k === 'tombstones' && plainObj(l) && plainObj(r)) { out[k] = Object.assign({}, l, r); Object.keys(out[k]).forEach(function (id) { out[k][id] = Math.max(Number(l[id]) || 0, Number(r[id]) || 0); }); return; }
      if (plainObj(l) && plainObj(r)) { out[k] = merge3(hasBase && plainObj(b) ? b : null, l, r, tombs); return; }
      out[k] = hasBase && eq(l, b) ? r : l;
    });
    return out;
  }

  // ---------- 照片 ----------
  // app_state 裡每件物品只存照片的路徑（photoPath）；照片本身在 Storage，
  // iPad 上另外在 IndexedDB 留一份暫存（打開快、沒網路也看得到）。
  function pathFor(uid, id) { return uid + '/' + id + '.jpg'; }
  function tagFor(path) { return BUCKET + '/' + path; }   // 暫存裡記下「已在新空間」
  // 有照片的資料：衣櫃／抽屜物品，加上行李箱
  // 有照片的：衣櫃／抽屜物品、行李箱、購物紀錄（自己會帶出門的）
  // 另外還有帳號的頭像（state.profile）
  function withPhoto() { var s = App.state(); return s.memory.concat(s.bags || [], (s.shopping || {}).purchases || [], s.profile ? [s.profile] : []).filter(function (m) { return m && m.photoId; }); }

  // 確認照片真的在雲端、而且大小正確
  function verify(path, size) {
    var folder = path.split('/')[0], name = path.split('/').slice(1).join('/');
    return client.storage.from(BUCKET).list(folder, { search: name, limit: 100 }).then(function (res) {
      if (res.error) throw res.error;
      var f = (res.data || []).find(function (x) { return x.name === name; });
      if (!f) throw new Error('照片上傳後在雲端找不到，下次再試');
      var sz = f.metadata && (f.metadata.size != null ? f.metadata.size : f.metadata.contentLength);
      if (sz != null && size != null && Number(sz) !== Number(size)) throw new Error('照片大小不符，下次再試');
    });
  }

  function removeOld(paths) {
    return client.storage.from(OLD_BUCKET).remove(paths).then(function () {}, function () {});
  }

  // 上傳新照片，並把舊空間（photos）的照片搬到 item-photos：上傳 → 確認 → 才刪舊的
  function uploadPhotos(uid) {
    var changed = false, n = 0;
    App.state().memory.forEach(function (m) {
      if (!m.photoId && m.photoPath) { m.photoPath = null; changed = true; }
    });
    return withPhoto().reduce(function (chain, m) {
      return chain.then(function () {
        var id = m.photoId, path = pathFor(uid, id);
        return Photos.get(id).then(function (p) {
          if (p && p.blob && p.cloudUrl === tagFor(path)) {
            if (m.photoPath !== path) { m.photoPath = path; changed = true; }
            return;
          }
          // 本機沒有照片：看看舊空間有沒有（例如這台還沒下載過）
          var source = p && p.blob ? Promise.resolve(p) :
            client.storage.from(OLD_BUCKET).download(path).then(function (r) {
              return r.error || !r.data ? null : { blob: r.data, size: r.data.size, createdAt: Date.now() };
            }, function () { return null; });
          return source.then(function (rec) {
            if (!rec) return;   // 兩邊都沒有：可能已經在新空間，等一下的下載會處理
            n++;
            setStatus('syncing', '照片 ' + n);
            return client.storage.from(BUCKET).upload(path, rec.blob, {
              upsert: true, contentType: rec.blob.type || 'image/jpeg', cacheControl: '31536000'
            }).then(function (res) {
              if (res.error) throw res.error;
              return verify(path, rec.blob.size);
            }).then(function () {
              rec.cloudUrl = tagFor(path);
              return Photos.put(id, rec);
            }).then(function () {
              if (m.photoPath !== path) { m.photoPath = path; changed = true; }
              return removeOld([path]);
            });
          });
        });
      });
    }, Promise.resolve()).then(function () {
      if (changed) App.saveQuiet();
      return changed;
    });
  }

  // 這台沒有的照片：從雲端下載並存一份在本機
  function downloadPhotos(uid) {
    var got = 0;
    return withPhoto().reduce(function (chain, m) {
      return chain.then(function () {
        var id = m.photoId;
        return Photos.get(id).then(function (p) {
          if (p && p.blob) return;
          var path = m.photoPath || pathFor(uid, id);
          return client.storage.from(BUCKET).download(path).then(function (res) {
            if (!res.error && res.data) return { blob: res.data, tag: tagFor(path) };
            return client.storage.from(OLD_BUCKET).download(path).then(function (r2) {
              return !r2.error && r2.data ? { blob: r2.data, tag: path } : null;
            }, function () { return null; });
          }).then(function (r) {
            if (!r) return;   // 雲端也沒有（例如另一台還沒上傳），下次再試
            got++;
            return Photos.put(id, { blob: r.blob, size: r.blob.size, createdAt: Date.now(), cloudUrl: r.tag });
          });
        });
      });
    }, Promise.resolve()).then(function () { return got; });
  }

  // 刪除物品或移除照片：記下來，同步時從雲端刪掉（沒網路時等有網路再刪）
  function loadDel() { try { return JSON.parse(localStorage.getItem(DEL_KEY)) || []; } catch (e) { return []; } }
  function saveDel(list) { try { localStorage.setItem(DEL_KEY, JSON.stringify(list)); } catch (e) { /* 下次再存 */ } }

  function queueDelete(photoId) {
    if (!photoId) return;
    var list = loadDel();
    if (list.indexOf(photoId) < 0) { list.push(photoId); saveDel(list); }
    schedule();
  }

  function processDeletes(uid) {
    var list = loadDel();
    if (!list.length) return Promise.resolve();
    var inUse = withPhoto().map(function (m) { return m.photoId; });
    var todo = list.filter(function (id) { return inUse.indexOf(id) < 0; });   // 又被用回來的不刪
    if (!todo.length) { saveDel([]); return Promise.resolve(); }
    var paths = todo.map(function (id) { return pathFor(uid, id); });
    return client.storage.from(BUCKET).remove(paths).then(function (res) {
      if (res.error) throw res.error;
      return removeOld(paths);
    }).then(function () {
      saveDel(loadDel().filter(function (id) { return todo.indexOf(id) < 0; }));
    });
  }

  // ---------- 同步 ----------
  function setStatus(state, text) {
    status = { state: state, text: text || '', at: state === 'ok' ? new Date() : status.at };
    renderStatus();
  }

  function sync() {
    if (!client || !user) return Promise.resolve();
    if (App.sampleMode()) return Promise.resolve();   // 範例模式：不同步，範例不會進雲端
    if (!navigator.onLine) { setStatus('offline'); markFirst(); return Promise.resolve(); }
    if (syncing) { again = true; return syncing; }
    setStatus('syncing');
    syncing = run(user.id).then(function () {
      setStatus('ok');
    }).catch(function (err) {
      setStatus(navigator.onLine ? 'error' : 'offline', friendly(err));
    }).then(function () {
      syncing = null;
      markFirst();
      if (again) { again = false; schedule(500); }
    });
    return syncing;
  }

  // ---------- 保護雲端資料 ----------
  // 資料筆數（物品、旅程、行李裡的東西、禮物、購物、自己的行李箱；範例不算）：用來判斷這次上傳會不會讓雲端少很多
  function countOf(d) {
    if (!d || typeof d !== 'object') return 0;
    function n(arr) { return Array.isArray(arr) ? arr.filter(function (x) { return x && !x.sample; }).length : 0; }
    return n(d.memory) + n(d.trips) + n(d.items) + n(d.gifts) + n((d.shopping || {}).purchases) +
      (Array.isArray(d.bags) ? d.bags.filter(function (b) { return b && !b.auto && !b.sample; }).length : 0);
  }
  // 少了一半以上的話，回傳說明（例如「物品從 28 樣變成 6 樣」）；沒有就回傳空字串
  function shrinkOf(remote, next) {
    function n(d, k) { return Array.isArray(d && d[k]) ? d[k].filter(function (x) { return x && !x.sample; }).length : 0; }
    var rm = n(remote, 'memory'), mm = n(next, 'memory'), rt = n(remote, 'trips'), mt = n(next, 'trips');
    var rc = countOf(remote), mc = countOf(next);
    if (rm >= 3 && mm * 2 < rm) return '物品從 ' + rm + ' 樣變成 ' + mm + ' 樣';
    if (rt >= 2 && mt * 2 < rt) return '旅程從 ' + rt + ' 趟變成 ' + mt + ' 趟';
    if (rc >= 3 && mc * 2 < rc) return '資料從 ' + rc + ' 筆變成 ' + mc + ' 筆';
    return '';
  }
  // 範例資料：永遠不上傳
  function isSampleData(d) { return !!(d && d.sampleBuilt); }
  // 這台裝置目前的資料另外留一份（不要用雲端的、或改用雲端的之前）：localStorage 的 cmo-rescue-local-<時間>
  function backupLocal(d, why) {
    try { localStorage.setItem('cmo-rescue-local-' + Date.now(), JSON.stringify({ why: why || '', savedAt: new Date().toISOString(), data: d })); } catch (e) { /* 空間不夠就算了 */ }
  }
  var allowShrink = {};   // 這次已經確認過「要用這台覆蓋雲端」的雲端版本
  var keepLocal = {};     // 這次已經確認過「雲端少很多時，用這台的資料還原雲端」的雲端版本

  // 同步一次：一定先讀雲端，讀成功之後才可能上傳
  //  - 這台沒有資料（剛登入、資料讀不懂、被清掉）→ 一律用雲端的，絕不上傳
  //  - 範例資料 → 不上傳
  //  - 這次上傳會讓雲端的資料少一半以上 → 先停下來問
  //  - 雲端每次被更新前，上一版會自動留在 app_state_history（設定見 supabase/safety.sql）
  function run(uid) {
    var meta = loadMeta();
    var attempt = 0;
    function loop() {
      if (attempt++ > 5) throw new Error('同步衝突太多次，請稍後再試');
      return client.from('app_state').select('data, version').eq('user_id', uid).maybeSingle().then(function (res) {
        if (res.error) throw res.error;
        var local = clone(App.state());
        if (App.sampleMode() || isSampleData(local)) throw new Error('範例資料不會上傳到雲端');
        var base = meta.userId === uid && meta.base ? JSON.parse(meta.base) : null;
        var localEmpty = !!local.pristine || (App.loadFailed && App.loadFailed()) || App.isEmptyState(local, true);

        // 雲端還沒有資料
        if (!res.data) {
          if (localEmpty) return;   // 這台也沒有：不用上傳空的資料
          delete local.pristine;
          return client.from('app_state').insert({ user_id: uid, data: local, version: 1 }).then(function (ins) {
            if (ins.error) {
              if (ins.error.code === '23505') return loop();   // 另一台剛好先建立了，改走合併
              throw ins.error;
            }
            meta = { userId: uid, version: 1, base: JSON.stringify(local) };
            saveMeta(meta);
          });
        }

        var remote = res.data.data || {};
        if ('shrinkOk' in remote) { remote = clone(remote); delete remote.shrinkOk; }   // 只給雲端的安全檢查看，不放進這台的資料
        var rv = res.data.version;
        // 這台沒有資料：直接用雲端的（不管上次同步過沒有），不上傳
        if (localEmpty) {
          if (!eq(App.state(), local)) return loop();
          App.replaceState(clone(remote));   // 轉換失敗會丟出錯誤：什麼都不上傳
          meta = { userId: uid, version: rv, base: JSON.stringify(App.state()) };
          saveMeta(meta);
          return;
        }
        // 一律逐筆合併（就算雲端沒變也一樣）：這台少掉、但沒有刪除紀錄的東西，會從雲端補回來
        var merged = merge3(base, local, remote);
        delete merged.pristine;
        // 雲端的資料比這台少很多（可能被別的裝置蓋掉了）：先問，不要自動把這台的資料也刪掉
        var lost = shrinkOf(local, merged);
        if (lost && !keepLocal[rv]) {
          var useLocal = confirm('雲端的資料比這台裝置少很多：' + lost + '。可能是被別的裝置蓋掉了。\n\n' +
            '按「確定」：用這台裝置的資料還原雲端。\n按「取消」：改成和雲端一樣（這台裝置目前的資料會另外留一份）。');
          if (useLocal) { keepLocal[rv] = true; allowShrink[rv] = true; merged = clone(local); delete merged.pristine; }
          else backupLocal(local, 'cloud-shrink-accepted');
        }

        // 合併期間你剛好又改了資料：重來一次，避免蓋掉
        if (!eq(App.state(), local)) return loop();
        if (!eq(merged, local)) App.replaceState(merged);
        merged = clone(App.state());

        if (eq(merged, remote)) {
          meta = { userId: uid, version: rv, base: JSON.stringify(merged) };
          saveMeta(meta);
          return;
        }
        // 這次上傳會讓雲端的資料少一半以上：先停下來問，不自動覆蓋
        var drop = shrinkOf(remote, merged);
        if (drop && !allowShrink[rv]) {
          var go = confirm('這次同步會讓雲端的' + drop + '（少了一半以上）。\n\n' +
            '按「確定」：用這台裝置的資料更新雲端。\n按「取消」：不要覆蓋，改用雲端的資料（這台裝置目前的資料會另外留一份）。');
          if (!go) {
            backupLocal(merged, 'shrink-declined');
            App.replaceState(clone(remote));
            meta = { userId: uid, version: rv, base: JSON.stringify(App.state()) };
            saveMeta(meta);
            return;
          }
          allowShrink[rv] = true;
        }
        // 使用者確認過這次會少很多：帶上這次的版本號，雲端的安全檢查才會放行（見 supabase/safety.sql）
        var payload = allowShrink[rv] ? Object.assign({}, merged, { shrinkOk: String(rv + 1) }) : merged;
        return client.from('app_state')
          .update({ data: payload, version: rv + 1, updated_at: new Date().toISOString() })
          .eq('user_id', uid).eq('version', rv).select('version')
          .then(function (up) {
            if (up.error) throw up.error;
            if (!up.data || !up.data.length) {          // 另一台剛好也更新了：用最新的再合併一次
              // 基準維持「上次真正同步的內容」，不能換成這次合併的結果，否則這台新增的東西會被當成在別台刪掉
              meta = { userId: uid, version: -1, base: base ? JSON.stringify(base) : null };
              return loop();
            }
            meta = { userId: uid, version: rv + 1, base: JSON.stringify(merged) };
            saveMeta(meta);
          });
      });
    }
    // 先讀雲端、合併、存好資料；之後才上傳照片、刪照片、下載照片
    return loop().then(function () {
      return uploadPhotos(uid);
    }).then(function (changed) {
      if (changed) { attempt = 0; return loop(); }   // 照片路徑有更新：再同步一次（一樣先讀雲端）
    }).then(function () {
      return processDeletes(uid);
    }).then(function () {
      return downloadPhotos(uid);
    }).then(function (got) {
      if (got) App.refreshView();
    });
  }

  // ---------- 之前的版本（雲端每次更新前自動留下的，最多 50 版） ----------
  function listHistory() {
    if (!client || !user) return Promise.reject(new Error('請先登入'));
    return client.from('app_state_history').select('id, version, saved_at, item_count, trip_count')
      .eq('user_id', user.id).order('saved_at', { ascending: false }).limit(50).then(function (res) {
        if (res.error) throw res.error;
        return res.data || [];
      });
  }
  // 還原到某一版：雲端改成那一版（目前的會自動留成一個新的歷史版本），這台裝置也換成那一版
  function restoreHistory(id) {
    if (!client || !user || App.sampleMode()) return Promise.reject(new Error('請先登入'));
    var uid = user.id;
    clearTimeout(timer);
    return Promise.resolve(syncing).then(function () {
      return client.from('app_state_history').select('data').eq('id', id).eq('user_id', uid).maybeSingle();
    }).then(function (res) {
      if (res.error) throw res.error;
      if (!res.data || !res.data.data) throw new Error('找不到這個版本');
      var data = clone(res.data.data);
      delete data.shrinkOk;
      return client.from('app_state').select('version').eq('user_id', uid).maybeSingle().then(function (cur) {
        if (cur.error) throw cur.error;
        var rv = cur.data ? cur.data.version : 0;
        var payload = Object.assign({}, data, { shrinkOk: String(rv + 1) });   // 自己選的還原：雲端的安全檢查放行
        var q = cur.data ?
          client.from('app_state').update({ data: payload, version: rv + 1, updated_at: new Date().toISOString() }).eq('user_id', uid).eq('version', rv).select('version') :
          client.from('app_state').insert({ user_id: uid, data: data, version: 1 });
        return q.then(function (up) {
          if (up.error) throw up.error;
          if (cur.data && (!up.data || !up.data.length)) throw new Error('剛好有別的裝置在更新，請再試一次');
          backupLocal(App.state(), 'before-restore');
          App.replaceState(clone(data));
          saveMeta({ userId: uid, version: cur.data ? rv + 1 : 1, base: JSON.stringify(data) });
        });
      });
    });
  }

  // 資料有變更時呼叫：稍等一下再同步，避免一直上傳
  function schedule(ms) {
    if (!client || !user || App.sampleMode()) return;
    clearTimeout(timer);
    timer = setTimeout(sync, ms == null ? 2500 : ms);
  }

  // ---------- 畫面 ----------
  function renderStatus() {
    var el = $('#cloud-status');
    var acc = $('#account-btn');
    var text = '', cls = status.state;
    if (!client) { text = '雲端暫時無法使用'; cls = 'off'; }
    else if (!user) { text = '未登入雲端'; cls = 'off'; }
    else if (status.state === 'syncing') text = '同步中…';
    else if (status.state === 'offline') text = '離線中，有網路後會自動同步';
    else if (status.state === 'error') text = '同步失敗：' + status.text;
    else if (status.state === 'ok') text = '已同步 ' + hhmm(status.at);
    else text = '準備同步…';
    if (el) { el.textContent = text; el.className = 'cloud-status ' + cls; }
    // 右上角帳號圖示：還沒登入時旁邊一個小點；同步失敗時小點變紅
    if (acc) {
      acc.classList.toggle('signed-out', !user);
      acc.classList.toggle('sync-error', !!user && cls === 'error');
      acc.title = user ? (cls === 'ok' ? '已同步' : text) : '未登入雲端';
    }
  }

  function render() {
    var box = $('#cloud-box');
    if (!box) return;
    // 帳號選單只放必要的東西：沒登入時是登入表單；登入後最上方是名字與頭像（profile.js），登出在選單最下面
    if (!client) {
      box.innerHTML = '<p class="muted small">雲端暫時無法使用</p>';
    } else if (!user) {
      // 沒登入：最上方一個「登入」按鈕，按了才展開 Email／密碼
      box.innerHTML =
        '<button type="button" id="cl-show-login" class="btn primary account-login"' + (loginOpen ? ' hidden' : '') + '>登入</button>' +
        '<div id="cl-form"' + (loginOpen ? '' : ' hidden') + '>' +
        '<label>Email<input id="cl-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="you@example.com"></label>' +
        '<label>密碼<input id="cl-pass" type="password" autocomplete="current-password" placeholder="至少 6 個字"></label>' +
        '<div class="cloud-btns"><button type="button" id="cl-login" class="btn primary">登入</button>' +
        '<button type="button" id="cl-signup" class="btn ghost">註冊新帳號</button></div>' +
        '<button type="button" id="cl-forgot" class="link small">忘記密碼</button></div>';
    } else {
      box.innerHTML = '';
    }
    box.hidden = !box.innerHTML;
    var out = $('#cl-logout');
    if (out) { out.hidden = !user; out.disabled = false; out.textContent = '登出'; }
    var hb = $('#history-open'); if (hb) hb.hidden = !user || App.sampleMode();
    renderStatus();
    if (window.Profile) window.Profile.render();
  }

  // ---------- 畫面：還原到之前的版本 ----------
  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return (window.Trips && window.Trips.fmtDate ? window.Trips.fmtDate(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')) : (d.getMonth() + 1) + '/' + d.getDate()) + ' ' + hhmm(d);
  }
  // 這台裝置留下的備份（cmo-rescue-…）：讀不懂時留下的原始資料、或被換掉的那一份
  function rescues() {
    var out = [];
    try {
      Object.keys(localStorage).forEach(function (k) {
        var m = k.match(/^cmo-rescue-(unreadable|local)-(\d+)$/);
        if (!m) return;
        try {
          var v = JSON.parse(localStorage.getItem(k));
          var data = m[1] === 'local' ? v && v.data : v;
          if (!data || typeof data !== 'object' || !countOf(data)) return;
          out.push({ key: k, at: +m[2], data: data });
        } catch (e) { /* 讀不懂的就不列 */ }
      });
    } catch (e) { /* 不影響 */ }
    return out.sort(function (a, b) { return b.at - a.at; });
  }
  function rescueHTML() {
    var list = rescues();
    if (!list.length) return '';
    return '<div class="field-title hist-sec">這台裝置留下的備份</div>' + list.map(function (r) {
      var n = function (k) { return Array.isArray(r.data[k]) ? r.data[k].length : 0; };
      return '<div class="hist-row"><span class="hist-main"><b>' + esc(fmtTime(new Date(r.at).toISOString())) + '</b>' +
        '<span class="muted small">物品 ' + n('memory') + '・旅程 ' + n('trips') + '</span></span>' +
        '<button type="button" class="btn ghost small-btn" data-rescue-restore="' + esc(r.key) + '" data-hist-time="' + esc(fmtTime(new Date(r.at).toISOString())) + '">還原</button></div>';
    }).join('') + '<div class="field-title hist-sec">雲端之前的版本</div>';
  }
  function openHistory() {
    $('#account-sheet').hidden = true;
    var local = rescueHTML();
    $('#history-list').innerHTML = local + '<p class="muted small">讀取中…</p>';
    $('#history-sheet').hidden = false;
    listHistory().then(function (rows) {
      $('#history-list').innerHTML = local + (rows.length ? rows.map(function (r) {
        return '<div class="hist-row"><span class="hist-main"><b>' + esc(fmtTime(r.saved_at)) + '</b>' +
          '<span class="muted small">物品 ' + (r.item_count || 0) + '・旅程 ' + (r.trip_count || 0) + '</span></span>' +
          '<button type="button" class="btn ghost small-btn" data-hist-restore="' + esc(String(r.id)) + '" data-hist-time="' + esc(fmtTime(r.saved_at)) + '">還原</button></div>';
      }).join('') : '<p class="muted small">還沒有之前的版本。之後每次存到雲端，上一版都會自動留下來。</p>');
    }).catch(function (err) {
      var m = (err && (err.message || '')) + ' ' + (err && err.code || '');
      $('#history-list').innerHTML = local + '<p class="muted small">' + (/app_state_history|42P01|PGRST205|schema cache/.test(m) ?
        '雲端還沒有開啟「之前的版本」。請先在 Supabase 執行 supabase/safety.sql。' : esc(friendly(err))) + '</p>';
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('#history-open')) { openHistory(); return; }
    if (t.id === 'history-close' || t.id === 'history-sheet') { $('#history-sheet').hidden = true; return; }
    var rb = t.closest('[data-rescue-restore]');
    if (rb) {
      if (!confirm('要還原到 ' + rb.getAttribute('data-hist-time') + ' 的版本嗎？\n目前的資料會先自動留成一個版本，之後還可以再換回來。')) return;
      try {
        var raw = JSON.parse(localStorage.getItem(rb.getAttribute('data-rescue-restore')));
        var data = /-local-/.test(rb.getAttribute('data-rescue-restore')) ? raw.data : raw;
        backupLocal(App.state(), 'before-rescue-restore');
        App.replaceState(data);
        $('#history-sheet').hidden = true;
        App.toast('已還原');
        allowShrink = {}; keepLocal = {};
        schedule(300);   // 同步到雲端（一樣先讀雲端；雲端比較多時會先問）
      } catch (err) { alert('還原失敗：' + friendly(err)); }
      return;
    }
    var b = t.closest('[data-hist-restore]');
    if (!b) return;
    if (!confirm('要還原到 ' + b.getAttribute('data-hist-time') + ' 的版本嗎？\n目前的資料會先自動留成一個版本，之後還可以再換回來。')) return;
    b.disabled = true; b.textContent = '還原中…';
    restoreHistory(b.getAttribute('data-hist-restore')).then(function () {
      $('#history-sheet').hidden = true;
      App.toast('已還原');
      App.refreshView();
    }).catch(function (err) {
      b.disabled = false; b.textContent = '還原';
      alert('還原失敗：' + friendly(err));
    });
  });

  // 「登入」：展開登入表單（範例提示列、介紹最後一頁、第一次使用的「登入」也用這裡）
  var loginOpen = false;
  function openLogin() {
    loginOpen = true;
    render();
    $('#account-sheet').hidden = false;
    setTimeout(function () { var em = $('#cl-email'); if (em) em.focus(); }, 300);
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#account-btn')) { if (loginOpen) { loginOpen = false; render(); } }
  }, true);

  function busy(btn, on, label) {
    if (!btn) return;
    btn.disabled = on;
    if (label) btn.textContent = label;
  }

  function creds() {
    var email = ($('#cl-email') || {}).value || '';
    var pass = ($('#cl-pass') || {}).value || '';
    email = email.trim();
    if (!email) { App.toast('請輸入 Email'); return null; }
    if (pass.length < 6) { App.toast('密碼至少要 6 個字'); return null; }
    return { email: email, password: pass };
  }

  function redirectURL() { return location.origin + location.pathname; }

  document.addEventListener('click', function (e) {
    var id = e.target && e.target.id;
    if (!id || id.indexOf('cl-') !== 0) return;
    if (!client) return;
    if (id === 'cl-login') {
      var c = creds(); if (!c) return;
      busy(e.target, true, '登入中…');
      justLoggedIn = true;
      client.auth.signInWithPassword(c).then(function (res) {
        if (res.error) throw res.error;
        App.toast('登入成功，開始同步');
      }).catch(function (err) {
        App.toast(friendly(err));
        busy(e.target, false, '登入');
      });
    }
    if (id === 'cl-signup') {
      var c2 = creds(); if (!c2) return;
      busy(e.target, true, '註冊中…');
      justLoggedIn = true;
      client.auth.signUp({ email: c2.email, password: c2.password, options: { emailRedirectTo: redirectURL() } }).then(function (res) {
        if (res.error) throw res.error;
        if (res.data && res.data.session) App.toast('註冊成功，已登入');
        else alert('已寄出確認信到 ' + c2.email + '。\n請到信箱點信裡的連結確認帳號，再回到這裡用 Email 和密碼登入。');
      }).catch(function (err) {
        App.toast(friendly(err));
      }).then(function () { busy(e.target, false, '註冊新帳號'); });
    }
    if (id === 'cl-forgot') {
      var email = (($('#cl-email') || {}).value || '').trim();
      if (!email) { App.toast('請先在上面輸入 Email'); return; }
      client.auth.resetPasswordForEmail(email, { redirectTo: redirectURL() }).then(function (res) {
        if (res.error) throw res.error;
        alert('已寄出重設密碼的信到 ' + email + '。\n點信裡的連結後，會請你輸入新密碼。');
      }).catch(function (err) { App.toast(friendly(err)); });
    }
    if (id === 'cl-show-login') { openLogin(); return; }
    if (id === 'cl-sync') sync();
    if (id === 'cl-logout') logout(e.target);
  });

  // ---------- 登出 ----------
  // 先確認資料、照片都已經在雲端，才清掉這台裝置的資料和照片暫存；沒同步完就不登出，避免資料遺失
  // 還有什麼沒同步到雲端（沒有就回傳空字串）
  function unsynced() {
    var meta = loadMeta();
    if (!user || meta.userId !== user.id || !meta.base) return Promise.resolve('這台裝置還沒有和雲端同步過');
    if (!eq(JSON.parse(meta.base), App.state())) return Promise.resolve('還有修改沒有上傳到雲端');
    if (loadDel().length) return Promise.resolve('還有照片沒從雲端刪除');
    var uid = user.id, missing = 0;
    return withPhoto().reduce(function (chain, m) {
      return chain.then(function () {
        return Photos.get(m.photoId).then(function (p) {
          if (p && p.blob && p.cloudUrl !== tagFor(pathFor(uid, m.photoId))) missing++;
        });
      });
    }, Promise.resolve()).then(function () {
      return missing ? '還有 ' + missing + ' 張照片沒上傳到雲端' : '';
    });
  }

  // 登出：先確認都已同步（沒同步就讓你選「先同步」或「取消登出」），
  // 確認後才清掉這台裝置上的個人資料和照片暫存；雲端資料完全不動
  function logout(btn) {
    if (App.sampleMode()) {
      alert('現在是範例資料。\n請先按最上方的「清除範例，開始使用」回到你的資料，再登出。');
      return;
    }
    if (!confirm('要登出嗎？')) return;
    busy(btn, true, '檢查同步中…');
    clearTimeout(timer);
    Promise.resolve(syncing).then(unsynced).then(function (why) {
      if (!why) return true;
      busy(btn, false, '登出');
      if (!confirm('還有資料沒有同步到雲端：' + why + '\n\n按「確定」先同步，同步完成後再登出；\n按「取消」取消登出。')) return false;
      if (!navigator.onLine) { alert('現在沒有網路，沒辦法同步。\n請連上網路後再登出，避免資料遺失。'); return false; }
      busy(btn, true, '同步中…');
      return sync().then(unsynced).then(function (why2) {
        if (!why2) return true;
        busy(btn, false, '登出');
        // 一直同步不了（例如某張照片傳不上去）：可以選擇仍然登出，沒同步的資料先鎖在這台裝置，不會遺失
        if (confirm('同步沒有完成：' + why2 + (status.text ? '\n（' + status.text + '）' : '') +
          '\n\n按「確定」仍然登出：還沒同步的資料會先保留在這台裝置（畫面不會顯示），下次在這台裝置登入時自動同步，不會遺失。\n按「取消」不登出。')) return 'keep';
        return false;
      });
    }).then(function (ok) {
      if (!ok) return;
      if (ok === 'keep') {
        // 只登出、不清資料（資料鎖在這台裝置；沒登入時畫面一律是範例）
        loggingOut = true;
        return Promise.resolve().then(function () { return client.auth.signOut(); }).catch(function () {})
          .then(function () {
            try { localStorage.removeItem('sb-luggage-auth'); localStorage.removeItem('cmo-sample-state'); localStorage.removeItem('cmo-sample-mode'); } catch (e) { /* 不影響 */ }
            location.hash = '#home';
            location.reload();
          });
      }
      if (!confirm('資料都已經同步到雲端。\n要登出嗎？\n登出後會清掉這台裝置上的資料和照片暫存，畫面改成範例資料；雲端的資料會保留，重新登入就會全部回來。')) {
        busy(btn, false, '登出');
        return;
      }
      busy(btn, true, '登出中…');
      loggingOut = true;
      return Promise.resolve().then(function () { return client.auth.signOut(); }).catch(function () { /* 沒網路也照樣清掉本機的登入 */ })
        .then(function () { return App.clearLocalData(); })
        .then(function () {
          try { localStorage.removeItem('sb-luggage-auth'); } catch (e) { /* 不影響 */ }
          location.hash = '#home';
          location.reload();
        });
    }).catch(function (err) {
      loggingOut = false;
      busy(btn, false, '登出');
      alert('登出失敗：' + friendly(err));
    });
  }
  var loggingOut = false;
  var justLoggedIn = false;   // 這次是自己按了登入／註冊（不是重新整理後自動恢復登入）

  // 登入後第一次同步完成前，畫面先不要顯示歡迎畫面（資料還在從雲端載回來）
  var firstDone = false;
  function markFirst() {
    if (firstDone) return;
    firstDone = true;
    App.refreshView();
  }
  function waitingForData() {
    if (firstDone) return false;
    try { return !!localStorage.getItem('sb-luggage-auth'); } catch (e) { return false; }
  }

  // ---------- 登入狀態 ----------
  var lastUserId = null;
  function onSignedIn() {
    // 範例模式中自己按了「登入」：先清掉範例再載入你的資料（範例不會跟你的資料混在一起，也不會上傳）
    // （已登入的人看「再看一次範例」時，重新整理會自動恢復登入，那不算，範例照常看）
    if (App.sampleMode()) {
      if (justLoggedIn) App.dropSample();
      return;
    }
    var meta = loadMeta();
    if (meta.userId && meta.userId !== user.id) {
      var ok = confirm('這台裝置上的資料，之前是和另一個帳號同步的。\n要把這些資料合併到目前登入的帳號（' + (user.email || '') + '）嗎？\n\n按「取消」會登出。');
      if (!ok) { client.auth.signOut(); return; }
      saveMeta({});
    }
    sync();
  }

  function init() {
    if (!window.supabase || !window.supabase.createClient) { render(); return; }
    try {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'sb-luggage-auth' }
      });
    } catch (e) { client = null; render(); return; }

    client.auth.onAuthStateChange(function (event, session) {
      user = session ? session.user : null;
      // 不要在這個 callback 裡直接呼叫 Supabase，延後一下再處理
      setTimeout(function () {
        if (event === 'PASSWORD_RECOVERY') {
          window.Clothing.askText('設定新密碼', '至少 6 個字').then(function (pw) {
            if (pw && pw.length >= 6) {
              client.auth.updateUser({ password: pw }).then(function (res) {
                App.toast(res.error ? friendly(res.error) : '密碼已更新');
              });
            } else if (pw !== null) App.toast('密碼至少要 6 個字');
          });
        }
        var uid = user ? user.id : null;
        if (uid !== lastUserId) {
          lastUserId = uid;
          render();
          if (user) onSignedIn();
        }
        if (!user && !loggingOut) markFirst();   // 沒有登入：不用等雲端
        // 登入過期或在別處被登出：畫面不能再顯示你的資料 → 重新載入成範例（你的資料留在這台裝置，下次登入會合併回去）
        if (!user && !loggingOut && !App.sampleMode() && !App.signedIn()) { loggingOut = true; location.reload(); }
        // 確認信、重設密碼連結回來時，網址會帶一串登入資訊，清掉
        if (/access_token|refresh_token|type=/.test(location.hash)) history.replaceState(null, '', location.pathname + '#home');
      }, 0);
    });

    window.addEventListener('online', function () { schedule(300); });
    window.addEventListener('offline', function () { if (user) setStatus('offline'); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') schedule(300);
    });
    // 定期看看另一台裝置有沒有更新
    setInterval(function () { if (document.visibilityState === 'visible') sync(); }, 120000);
    render();
  }

  window.Cloud = { listHistory: listHistory, restoreHistory: restoreHistory, countOf: countOf, openLogin: openLogin, waitingForData: waitingForData, schedule: schedule, sync: sync, queueDelete: queueDelete, merge3: merge3, render: render, status: function () { return status; } };
  init();
})();
