/*
 * 我的行李箱（在「打包」裡）
 * 每個行李箱：{ id, name, kind(pouch 隨身小包／personal 背包／carry 手提／checked 托運), size, style, material, tare(空箱 kg),
 *              limit(沒填航班額度時的上限), home(放在哪個家), photoId, photoPath }
 * 位置：箱子裡有東西＝跟著旅程出門；空的＝在它的家（見 app.js bagLocOf）
 */
(function () {
  'use strict';

  var App = window.App;
  var $ = function (sel) { return document.querySelector(sel); };
  var esc = App.esc;

  // 尺寸、款式、材質：固定選項＋自己新增的（存在 customOptions，長按可刪除）。
  // 以前存過的 24 吋、26 吋、胖胖箱、其他…照樣保留並顯示
  var OPTS = {
    size: { base: ['20 吋', '28 吋', '31 吋'], ctx: 'bag-size', add: '新增尺寸', label: '尺寸' },
    style: { base: ['三七開', '五五開'], ctx: 'bag-style', add: '新增款式', label: '款式' },
    material: { base: ['硬箱', '布箱'], ctx: 'bag-material', add: '新增材質', label: '材質' }
  };

  function st() { return App.state(); }
  function kindName(k) { return (App.bagKinds().find(function (x) { return x[0] === k; }) || [, ''])[1]; }
  function fmt(n) { return (Math.round((Number(n) || 0) * 10) / 10).toFixed(1); }

  function locText(b) {
    var loc = App.bagLocOf(b);
    if (loc.state === 'out') return '🧳 跟著旅程出門' + (loc.fromHome ? '（從' + loc.fromHome + '）' : '') + '・裡面 ' + loc.count + ' 件';
    if (loc.state === 'home') return '📍 ' + loc.home;
    return '📍 未設定家';
  }

  // ---------- 列表 ----------
  function render() {
    var bags = st().bags.filter(function (b) { return !b.auto; });   // 「尚未選擇行李箱」的占位不列出
    var order = App.homes().concat(['']);
    var html = order.map(function (h) {
      var list = bags.filter(function (b) {
        return h ? (b.home === h) : (!b.home || App.homes().indexOf(b.home) < 0);
      });
      if (!list.length && !h) return '';   // 每個家都列出來（可以在那個家新增）；「未設定家」有箱子才列
      return '<div class="bg-group"><div class="bp-cat">' + (h ? esc(h) : '未設定家') + '</div>' + list.map(function (b) {
        var spec = [kindName(b.kind), b.size, b.style, b.material].filter(Boolean).join('・');
        return '<button type="button" class="bg-row" data-bag-edit="' + esc(b.id) + '">' +
          (b.photoId ? '<img class="bg-thumb" data-photo="' + esc(b.photoId) + '" alt="">' : '<span class="bg-thumb none"></span>') +
          '<span class="bg-info"><b>' + esc(b.name) + (b.sample ? '<span class="sample-tag">範例</span>' : '') + '</b><span class="muted small">' + esc(spec) + '</span>' +
          '<span class="muted small">' + esc(locText(b)) + '</span></span>' +
          '<span class="bg-tare"><span class="muted small">空箱</span>' + fmt(b.tare) + ' kg</span></button>';
      }).join('') +
        (h ? '<button type="button" class="link small bg-add-home" data-bg-add-home="' + esc(h) + '">＋ 在' + esc(h) + '新增行李箱</button>' : '') + '</div>';
    }).join('');
    $('#bg-list').innerHTML = html || '<p class="empty-big">還沒有家。到「我的衣櫃」新增衣服時可以新增家。</p>';
    Photos.fillThumbs($('#bg-list'));
  }

  // ---------- 編輯 ----------
  var cur = null, isNew = false, newPhoto = null, photoRemoved = false;

  function chips(field) {
    var o = OPTS[field], value = cur[field];
    var custom = App.customs(o.ctx);
    var opts = o.base.concat(custom.filter(function (c) { return o.base.indexOf(c) < 0; }));
    if (value && opts.indexOf(value) < 0) opts.push(value);   // 舊資料的選項照樣顯示
    $('#bge-' + field).innerHTML = opts.map(function (v) {
      var mine = custom.indexOf(v) >= 0 && o.base.indexOf(v) < 0;
      return '<button type="button" class="chip' + (v === value ? ' on' : '') + '" data-bge-opt="' + field + '" data-v="' + esc(v) + '"' +
        (mine ? ' data-custom="1" title="長按可以刪除"' : '') + '>' + esc(v) + '</button>';
    }).join('') + '<button type="button" class="chip add-chip" data-bge-add="' + field + '">＋ ' + o.add + '</button>';
  }

  function renderForm() {
    $('#bge-title').textContent = isNew ? (cur.home ? '在' + cur.home + '新增行李箱' : '新增行李箱') : '編輯行李箱';
    $('#bge-kind').innerHTML = App.bagKinds().map(function (k) {
      return '<button type="button" class="' + (cur.kind === k[0] ? 'on' : '') + '" data-bge-kind="' + k[0] + '">' + k[1] + '</button>';
    }).join('');
    chips('size'); chips('style'); chips('material');
    $('#bge-home').innerHTML = App.homes().map(function (h) {
      return '<button type="button" class="chip' + (cur.home === h ? ' on' : '') + '" data-bge-home="' + esc(h) + '">' + esc(h) + '</button>';
    }).join('');
    $('#bge-loc').textContent = isNew ? '' : locText(cur);
    $('#bge-delete').hidden = isNew;
  }

  function showPhoto(url) {
    $('#bge-photo-img').hidden = !url;
    if (url) $('#bge-photo-img').src = url;
    $('#bge-photo-label').textContent = url ? '換一張照片' : '加入照片（選填）';
    $('#bge-photo-remove').hidden = !url;
  }

  function open(id, home) {
    var b = id && App.bagById(id);
    isNew = !b;
    cur = b ? JSON.parse(JSON.stringify(b)) : { name: '', kind: 'checked', size: '', style: '', material: '', tare: '', home: home || App.homes()[0] || '' };
    newPhoto = null; photoRemoved = false;
    $('#bge-name').value = cur.name || '';
    $('#bge-tare').value = cur.tare !== '' && cur.tare != null ? cur.tare : '';
    renderForm();
    showPhoto(null);
    if (b && b.photoId) Photos.url(b.photoId).then(function (u) { if (!newPhoto && !photoRemoved) showPhoto(u); });
    $('#bge-sheet').hidden = false;
    $('#bge-sheet .org-panel').scrollTop = 0;
  }

  // 新增選項：輸入後按確認或鍵盤的完成就存好，變成新的選項並選上
  function addOption(field) {
    var o = OPTS[field];
    window.Clothing.askText(o.add, '').then(function (v) {
      v = (v || '').trim().slice(0, 20);
      if (!v) return;
      if (o.base.indexOf(v) < 0) App.addCustom(o.ctx, v);
      cur[field] = v;
      renderForm();
    });
  }

  // 長按自己加的選項：刪除（已經用這個選項的行李箱不受影響）
  var press = null, pressed = false;
  $('#bge-sheet').addEventListener('pointerdown', function (e) {
    var el = e.target.closest('[data-custom]');
    if (!el) return;
    pressed = false;
    clearTimeout(press);
    press = setTimeout(function () {
      pressed = true;
      var field = el.getAttribute('data-bge-opt'), v = el.getAttribute('data-v');
      if (!confirm('要刪除自己加的選項「' + v + '」嗎？\n（已經選了這個的行李箱會保留原本的資料）')) return;
      App.removeCustom(OPTS[field].ctx, v);
      renderForm();
    }, 600);
  });
  ['pointerup', 'pointercancel', 'pointerleave', 'pointermove'].forEach(function (ev) {
    $('#bge-sheet').addEventListener(ev, function (e) {
      if (ev === 'pointermove' && !(Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 6)) return;
      clearTimeout(press);
    });
  });
  $('#bge-sheet').addEventListener('contextmenu', function (e) { if (e.target.closest('[data-custom]')) e.preventDefault(); });

  $('#bge-sheet').addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-bge-kind]'))) { cur.kind = el.getAttribute('data-bge-kind'); renderForm(); return; }
    if ((el = t.closest('[data-bge-add]'))) { addOption(el.getAttribute('data-bge-add')); return; }
    if ((el = t.closest('[data-bge-opt]'))) {
      if (pressed) { pressed = false; return; }   // 剛剛是長按，不要當成點選
      var f = el.getAttribute('data-bge-opt'), v = el.getAttribute('data-v');
      cur[f] = cur[f] === v ? '' : v;
      renderForm();
      return;
    }
    if ((el = t.closest('[data-bge-home]'))) { cur.home = el.getAttribute('data-bge-home'); renderForm(); return; }
    if (t.id === 'bge-photo-remove') { newPhoto = null; photoRemoved = true; showPhoto(null); return; }
    if (t.id === 'bge-save') { save(); return; }
    if (t.id === 'bge-delete') { remove(); return; }
    if (t.id === 'bge-sheet' || t.id === 'bge-cancel') $('#bge-sheet').hidden = true;
  });

  $('#bge-photo').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    Photos.compress(file).then(function (p) {
      newPhoto = p; photoRemoved = false;
      showPhoto(URL.createObjectURL(p.blob));
    }).catch(function () { App.toast('這張照片讀不到，請換一張試試'); });
  });

  function save() {
    var name = $('#bge-name').value.trim();
    if (!name) { App.toast('請輸入名稱'); return; }
    var tare = parseFloat($('#bge-tare').value);
    var b = isNew ? App.normalizeBag({ id: App.uid() }) : App.bagById(cur.id);
    b.name = name;
    b.kind = cur.kind;
    b.size = cur.size; b.style = cur.style; b.material = cur.material;
    b.tare = isFinite(tare) && tare >= 0 ? tare : 0;
    b.home = cur.home || '';
    if (isNew) st().bags.push(b);
    var job = Promise.resolve();
    if (newPhoto) {
      b.photoId = 'bag-' + b.id;
      job = Photos.put(b.photoId, newPhoto).catch(function () { b.photoId = null; App.toast('照片存不進去'); });
    } else if (photoRemoved && b.photoId) {
      var old = b.photoId;
      b.photoId = null; b.photoPath = null;
      Photos.del(old).catch(function () {});
      if (window.Cloud) window.Cloud.queueDelete(old);
    }
    job.then(function () {
      App.save();
      $('#bge-sheet').hidden = true;
      App.toast(isNew ? '已新增行李箱' : '已儲存');
      render();
    });
  }

  function remove() {
    var b = App.bagById(cur.id);
    if (!b) return;
    if (App.bagLocOf(b).state === 'out') { App.toast('箱子裡還有東西，請先拿出來或換到別的箱子'); return; }
    if (!confirm('要刪除行李箱「' + b.name + '」嗎？')) return;
    st().bags = st().bags.filter(function (x) { return x !== b; });
    // 有旅程選了這個箱子：改回「尚未選擇行李箱」
    (st().packLists || []).forEach(function (l) {
      Object.keys(l.zones || {}).forEach(function (z) { if (l.zones[z].bagId === b.id) l.zones[z].bagId = App.autoBag(z).id; });
    });
    if (b.photoId) { Photos.del(b.photoId).catch(function () {}); if (window.Cloud) window.Cloud.queueDelete(b.photoId); }
    App.save();
    $('#bge-sheet').hidden = true;
    App.toast('已刪除');
    render();
  }

  $('#view-bags').addEventListener('click', function (e) {
    var el = e.target.closest('[data-bag-edit]');
    if (el) { open(el.getAttribute('data-bag-edit')); return; }
    var ah = e.target.closest('[data-bg-add-home]');
    if (ah) open(null, ah.getAttribute('data-bg-add-home'));
  });

  window.Bags = { show: render, open: open };
})();
