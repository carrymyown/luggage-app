/*
 * 名字與頭像（帳號選單最上方、右上角帳號圖示）
 *
 * - 存在 state.profile = { name, photoId, photoPath, updatedAt }，跟著雲端同步（換裝置登入也一樣）；
 *   照片和其他照片一樣存在這台裝置（IndexedDB），同步時上傳到雲端（cloud.js 的 withPhoto 會算到它）。
 * - 沒有照片：顯示名字第一個字的圓形字母頭像；沒有名字也沒有照片：顯示原本的人像圖示。
 * - 第一次使用設定時也問一次名字（可以跳過）：setName() 設定畫面和這裡共用。
 * - 範例模式（正在看範例）：顯示自己帳號的名字和頭像（打開自己的資料時記在 cmo-profile），不能修改。
 */
(function () {
  'use strict';

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;
  var MIRROR = 'cmo-profile';
  var ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.9-3.6 3.8-5.6 7.2-5.6s6.3 2 7.2 5.6"/></svg>';

  function signedIn() { return !!(App.signedIn && App.signedIn()); }
  function data() {
    var s = App.state();
    if (!App.sampleMode()) {
      if (!s.profile || typeof s.profile !== 'object') s.profile = { name: '', photoId: null };
      return s.profile;
    }
    try { return JSON.parse(localStorage.getItem(MIRROR)) || {}; } catch (e) { return {}; }
  }
  function mirror() {
    if (App.sampleMode()) return;
    var p = data();
    try { localStorage.setItem(MIRROR, JSON.stringify({ name: p.name || '', photoId: p.photoId || null })); } catch (e) { /* 不影響 */ }
  }
  function initial(name) { var c = Array.from(String(name || '').trim())[0] || ''; return c.toUpperCase(); }

  // 頭像：照片 → 名字第一個字 → 人像圖示
  function avatarHTML(p, cls) {
    p = p || data();
    if (p.photoId) return '<span class="avatar ' + (cls || '') + '"><img data-photo="' + esc(p.photoId) + '" alt=""></span>';
    if (initial(p.name)) return '<span class="avatar letter ' + (cls || '') + '" aria-hidden="true">' + esc(initial(p.name)) + '</span>';
    return '<span class="avatar none ' + (cls || '') + '" aria-hidden="true">' + ICON + '</span>';
  }

  // 名字（設定畫面、修改視窗共用）
  function setName(name) {
    if (App.sampleMode()) return;
    var p = data();
    p.name = String(name || '').trim().slice(0, 20);
    p.updatedAt = Date.now();
    mirror();
  }

  // 右上角帳號圖示、帳號選單最上方
  function render() {
    var on = signedIn();
    var p = data();
    var has = on && (p.photoId || initial(p.name));
    var btn = $('#account-btn');
    if (btn) {
      var slot = btn.querySelector('.account-face');
      if (slot) slot.innerHTML = has ? avatarHTML(p, 'sm') : ICON;
      btn.classList.toggle('has-avatar', !!has);
    }
    var row = $('#account-profile');
    if (row) {
      row.hidden = !on;
      if (on) row.innerHTML = avatarHTML(p, 'md') + '<span class="ap-name">' + (p.name ? esc(p.name) : '<span class="muted">設定名字</span>') + '</span><span class="ap-chev" aria-hidden="true">›</span>';
    }
    if (window.Photos) { if (btn) Photos.fillThumbs(btn); if (row) Photos.fillThumbs(row); }
    mirror();
  }

  // ---------- 修改名字與頭像 ----------
  var newPhoto = null, removed = false;
  function open() {
    if (App.sampleMode()) { App.toast('範例模式中不能修改，清除範例後再改'); return; }
    var p = data();
    newPhoto = null; removed = false;
    $('#pf-name').value = p.name || '';
    preview();
    $('#account-sheet').hidden = true;
    renderHomes();
    $('#profile-sheet').hidden = false;
  }
  function preview() {
    var p = data(), name = $('#pf-name').value;
    var box = $('#pf-avatar');
    if (newPhoto) {
      box.innerHTML = '<span class="avatar lg"><img alt=""></span>';
      box.querySelector('img').src = URL.createObjectURL(newPhoto.blob);
    } else if (p.photoId && !removed) {
      box.innerHTML = avatarHTML({ photoId: p.photoId }, 'lg');
      Photos.fillThumbs(box);
    } else box.innerHTML = avatarHTML({ name: name }, 'lg');
    $('#pf-photo-remove').hidden = !(newPhoto || (p.photoId && !removed));
  }
  function save() {
    var p = data();
    setName($('#pf-name').value);
    var job = Promise.resolve();
    var old = p.photoId;
    if (newPhoto) {
      p.photoId = 'avatar-' + App.uid(); p.photoPath = null;
      var id = p.photoId;
      job = Photos.put(id, newPhoto).catch(function () { p.photoId = old; App.toast('照片存不進去'); old = null; });
    } else if (removed) { p.photoId = null; p.photoPath = null; }
    return job.then(function () {
      // 換掉或移除的舊照片：從這台裝置和雲端刪掉
      if (old && old !== p.photoId) { Photos.del(old).catch(function () {}); if (window.Cloud) window.Cloud.queueDelete(old); }
      p.updatedAt = Date.now();
      App.save();
      render();
      $('#profile-sheet').hidden = true;
      App.toast('已儲存');
    });
  }

  $('#account-profile').addEventListener('click', open);
  $('#pf-name').addEventListener('input', function () { if (!newPhoto && (removed || !data().photoId)) preview(); });
  $('#pf-photo').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    Photos.compress(f).then(function (rec) { newPhoto = rec; removed = false; preview(); })
      .catch(function () { App.toast('這張照片讀不進來'); });
  });
  $('#profile-sheet').addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'pf-photo-remove') { newPhoto = null; removed = true; preview(); return; }
    if (t.id === 'pf-save') { save(); return; }
    if (t.id === 'profile-sheet' || t.id === 'pf-cancel') $('#profile-sheet').hidden = true;
  });
  $('#pf-form').addEventListener('submit', function (e) { e.preventDefault(); save(); });

  // ---------- 我的家（新增、改名、改城市、刪除；以前在帳號選單裡） ----------
  function renderHomes() { if (window.Onboard && window.Onboard.renderHomes) window.Onboard.renderHomes(); }

  window.Profile = { render: render, setName: setName, avatarHTML: avatarHTML, data: data, open: open };
  render();
})();
