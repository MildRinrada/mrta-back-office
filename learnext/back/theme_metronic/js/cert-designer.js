/* Certificate designer - จัดวางรายการบนใบประกาศแบบลาก/ย่อขยาย/หมุน
 * พิกัดทั้งหมดเป็น px บนผืน 1123x794 (เท่ากับที่ตัวเรนเดอร์ฝั่งเซิร์ฟเวอร์ใช้) - ผืนถูกย่อ/ขยายด้วย CSS transform
 * ตั้งค่าผ่าน window.CD = { layout, fonts, sample, keyLabels, limits, defaultBg, assetUrl, uploadUrl, csrf, i18n }
 */
(function () {
    'use strict';
    var CFG = window.CD;
    if (!CFG) return;

    var CANVAS_W = 1123, CANVAS_H = 794, SNAP = 6, HISTORY_MAX = 60;
    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    var round1 = function (v) { return Math.round(v * 10) / 10; };
    var uid = function () { return Math.random().toString(36).slice(2, 10); };
    var t = function (k, rep) {
        var s = (CFG.i18n && CFG.i18n[k]) || k;
        if (rep) Object.keys(rep).forEach(function (r) { s = s.replace(':' + r, rep[r]); });
        return s;
    };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

    var state = {
        layout: CFG.layout,
        sel: null,            // id ที่เลือก
        zoom: 1,
        history: [], future: [],
        dirty: false,
        lockRatio: true
    };

    var el = {
        stage: $('#cd-stage'), wrap: $('#cd-canvas-wrap'), canvas: $('#cd-canvas'),
        bg: $('#cd-bg'), items: $('#cd-items'), guides: $('#cd-guides'),
        props: $('#cd-props-body'), layers: $('#cd-layers'),
        file: $('#cd-file'), zoomLabel: $('#cd-zoom-label'),
        form: $('#frm_main'), layoutInput: $('#cd-layout-input'), saveOpt: $('#save_option'),
        previewForm: $('#frm_preview'), previewLayout: $('#cd-preview-layout'), previewPdf: $('#cd-preview-pdf'),
        undo: $('#cd-undo'), redo: $('#cd-redo')
    };

    // ------------------------------------------------------------ helpers
    function item(id) { for (var i = 0; i < state.layout.items.length; i++) if (state.layout.items[i].id === id) return state.layout.items[i]; return null; }
    function indexOf(id) { for (var i = 0; i < state.layout.items.length; i++) if (state.layout.items[i].id === id) return i; return -1; }
    function assetUrl(path) { return CFG.assetUrl.replace('__FILE__', path.split('/').pop()); }
    function fontCss(key) { var f = CFG.fonts[key] || CFG.fonts.sarabun; return "'" + f.css + "'"; }
    function textOf(it) { return it.key === 'free' ? it.text : (CFG.sample[it.key] || ''); }
    function labelOf(it) {
        if (it.type === 'qr') return t('item_qr');
        if (it.type === 'image') return (it.key === 'signature' ? t('item_signature') : t('item_logo')) + ' ' + (it.slot || '');
        if (it.key !== 'free') return CFG.keyLabels[it.key] || it.key;
        var s = (it.text || '').replace(/\s+/g, ' ').trim();
        return s ? (s.length > 22 ? s.slice(0, 22) + '…' : s) : CFG.keyLabels.free;
    }
    function count(type, key) { return state.layout.items.filter(function (i) { return i.type === type && (!key || i.key === key); }).length; }
    function renumber() {
        var n = { logo: 0, signature: 0 };
        state.layout.items.forEach(function (i) { if (i.type === 'image') i.slot = ++n[i.key]; });
    }

    // ------------------------------------------------------------ history
    function snapshot() { return JSON.stringify(state.layout); }
    function commit() {
        var s = snapshot();
        if (state.history.length && state.history[state.history.length - 1] === s) return;
        state.history.push(s);
        if (state.history.length > HISTORY_MAX) state.history.shift();
        state.future = [];
        state.dirty = true;
        updateHistoryButtons();
    }
    function undo() {
        if (state.history.length < 2) return;
        state.future.push(state.history.pop());
        state.layout = JSON.parse(state.history[state.history.length - 1]);
        state.dirty = true; afterRestore();
    }
    function redo() {
        if (!state.future.length) return;
        var s = state.future.pop(); state.history.push(s);
        state.layout = JSON.parse(s); state.dirty = true; afterRestore();
    }
    function afterRestore() { if (state.sel && !item(state.sel)) state.sel = null; renderAll(); updateHistoryButtons(); }
    function updateHistoryButtons() {
        el.undo.disabled = state.history.length < 2;
        el.redo.disabled = !state.future.length;
    }

    // ------------------------------------------------------------ zoom
    function setZoom(z, keepCenter) {
        z = clamp(z, 0.2, 3);
        var sx = el.stage.scrollLeft, sy = el.stage.scrollTop, oz = state.zoom;
        state.zoom = z;
        el.wrap.style.width = Math.round(CANVAS_W * z) + 'px';
        el.wrap.style.height = Math.round(CANVAS_H * z) + 'px';
        el.canvas.style.transform = 'scale(' + z + ')';
        el.zoomLabel.textContent = Math.round(z * 100) + '%';
        if (keepCenter) { el.stage.scrollLeft = sx * z / oz; el.stage.scrollTop = sy * z / oz; }
        renderSelection();
    }
    function zoomFit() {
        var r = el.stage.getBoundingClientRect();
        setZoom(Math.min((r.width - 48) / CANVAS_W, (r.height - 48) / CANVAS_H));
        el.stage.scrollLeft = 0; el.stage.scrollTop = 0;
    }

    // ------------------------------------------------------------ render
    function renderAll() { renderBackground(); renderItems(); renderSelection(); renderLayers(); renderProps(); }

    function renderBackground() {
        var bg = state.layout.background && state.layout.background.path;
        el.bg.src = bg ? assetUrl(bg) : CFG.defaultBg;
        $('#cd-remove-bg').classList.toggle('d-none', !bg);
    }

    function styleItem(node, it) {
        node.style.left = it.x + 'px'; node.style.top = it.y + 'px';
        node.style.width = it.w + 'px'; node.style.height = it.h + 'px';
        node.style.transform = 'rotate(' + (it.r || 0) + 'deg)';
    }

    function buildItem(it) {
        var node = document.createElement('div');
        node.className = 'cd-item cd-' + it.type;
        node.dataset.id = it.id;
        if (it.type === 'text') {
            var inner = document.createElement('div');
            inner.className = 'cd-text-inner';
            node.appendChild(inner);
        } else if (it.type === 'image') {
            var img = document.createElement('img');
            img.draggable = false; img.alt = '';
            node.appendChild(img);
        } else {
            node.innerHTML = '<div class="cd-qr-box"><span>QR</span></div>';
        }
        updateItemNode(node, it);
        return node;
    }

    function updateItemNode(node, it) {
        styleItem(node, it);
        if (it.type === 'text') {
            var inner = node.firstChild;
            inner.textContent = textOf(it);
            inner.style.fontFamily = fontCss(it.font);
            inner.style.fontSize = it.size + 'px';
            inner.style.lineHeight = it.lh;
            inner.style.color = it.color;
            inner.style.fontWeight = it.bold ? '700' : '400';
            inner.style.fontStyle = it.italic ? 'italic' : 'normal';
            inner.style.textAlign = it.align;
            node.classList.toggle('cd-empty', !textOf(it));
        } else if (it.type === 'image') {
            var img = node.firstChild;
            var src = assetUrl(it.path);
            if (img.getAttribute('src') !== src) img.src = src;
            img.style.opacity = it.opacity == null ? 1 : it.opacity;
        }
    }

    function renderItems() {
        var keep = {};
        state.layout.items.forEach(function (it) {
            var node = el.items.querySelector('[data-id="' + it.id + '"]');
            if (!node) node = buildItem(it); else updateItemNode(node, it);
            el.items.appendChild(node);   // ย้ายไปท้าย = เรียงตามลำดับชั้น
            keep[it.id] = true;
        });
        $$('.cd-item', el.items).forEach(function (n) { if (!keep[n.dataset.id]) n.remove(); });
    }

    function renderItem(id) {
        var it = item(id), node = el.items.querySelector('[data-id="' + id + '"]');
        if (it && node) updateItemNode(node, it);
    }

    // กรอบเลือก + จุดจับ อยู่นอกผืนที่ถูก scale เพื่อให้จุดจับคงขนาดบนจอ
    function renderSelection() {
        var box = $('#cd-selbox');
        var it = state.sel && item(state.sel);
        $$('.cd-item.is-sel', el.items).forEach(function (n) { n.classList.remove('is-sel'); });
        if (!it) { box.classList.add('d-none'); return; }
        var node = el.items.querySelector('[data-id="' + it.id + '"]');
        if (node) node.classList.add('is-sel');
        var z = state.zoom;
        box.classList.remove('d-none');
        box.style.left = (it.x * z) + 'px'; box.style.top = (it.y * z) + 'px';
        box.style.width = (it.w * z) + 'px'; box.style.height = (it.h * z) + 'px';
        box.style.transform = 'rotate(' + (it.r || 0) + 'deg)';
        box.classList.toggle('cd-sel-text', it.type === 'text');
        $('#cd-sel-info').textContent = Math.round(it.x) + ', ' + Math.round(it.y) + '  ' + Math.round(it.w) + '×' + Math.round(it.h) + (it.r ? '  ' + round1(it.r) + '°' : '');
    }

    function renderLayers() {
        var html = '';
        state.layout.items.slice().reverse().forEach(function (it) {
            var icon = it.type === 'qr' ? 'fa-qrcode' : it.type === 'image' ? (it.key === 'signature' ? 'fa-signature' : 'fa-image') : (it.key === 'free' ? 'fa-font' : 'fa-wand-magic-sparkles');
            html += '<div class="cd-layer' + (it.id === state.sel ? ' is-active' : '') + '" data-id="' + it.id + '"><i class="fa-solid ' + icon + '"></i><span>' + esc(labelOf(it)) + '</span></div>';
        });
        el.layers.innerHTML = html || '<div class="cd-muted small p-2">-</div>';
    }

    // ------------------------------------------------------------ properties panel
    function renderProps() {
        var it = state.sel && item(state.sel);
        if (!it) { el.props.innerHTML = '<div class="cd-empty-props"><i class="fa-regular fa-hand-pointer"></i><div>' + esc(t('no_selection')) + '</div></div>'; return; }
        var h = '<div class="cd-prop-title"><span>' + esc(labelOf(it)) + '</span></div>';

        if (it.type === 'text') {
            h += '<label class="cd-lbl">' + esc(t('content')) + '</label>';
            if (it.key === 'free') {
                h += '<textarea class="form-control form-control-sm" rows="3" data-prop="text">' + esc(it.text) + '</textarea>';
            } else {
                h += '<div class="cd-auto-note"><i class="fa-solid fa-wand-magic-sparkles me-1"></i>' + esc(t('auto_content')) + '<div class="cd-muted mt-1">' + esc(CFG.sample[it.key] || '') + '</div></div>';
            }
            h += '<div class="row g-2 mt-1"><div class="col-7"><label class="cd-lbl">' + esc(t('font')) + '</label><select class="form-select form-select-sm" data-prop="font">';
            Object.keys(CFG.fonts).forEach(function (k) { h += '<option value="' + k + '"' + (k === it.font ? ' selected' : '') + ' style="font-family:' + fontCss(k) + '">' + esc(CFG.fonts[k].label) + '</option>'; });
            h += '</select></div><div class="col-5"><label class="cd-lbl">' + esc(t('size')) + '</label><input type="number" class="form-control form-control-sm" data-prop="size" min="6" max="300" step="1" value="' + it.size + '"></div></div>';
            h += '<div class="row g-2 mt-1 align-items-end"><div class="col-4"><label class="cd-lbl">' + esc(t('color')) + '</label><input type="color" class="form-control form-control-color form-control-sm w-100" data-prop="color" value="' + it.color + '"></div>';
            h += '<div class="col-8"><div class="btn-group btn-group-sm w-100" role="group">'
                + '<button type="button" class="btn btn-outline-secondary' + (it.bold ? ' active' : '') + '" data-toggle-prop="bold" title="' + esc(t('bold')) + '"><i class="fa-solid fa-bold"></i></button>'
                + '<button type="button" class="btn btn-outline-secondary' + (it.italic ? ' active' : '') + '" data-toggle-prop="italic" title="' + esc(t('italic')) + '"><i class="fa-solid fa-italic"></i></button>'
                + ['left', 'center', 'right'].map(function (a) { return '<button type="button" class="btn btn-outline-secondary' + (it.align === a ? ' active' : '') + '" data-set-prop="align" data-val="' + a + '"><i class="fa-solid fa-align-' + a + '"></i></button>'; }).join('')
                + '</div></div></div>';
            h += '<div class="row g-2 mt-1"><div class="col-6"><label class="cd-lbl">' + esc(t('line_height')) + '</label><input type="number" class="form-control form-control-sm" data-prop="lh" min="0.8" max="3" step="0.05" value="' + it.lh + '"></div></div>';
        }
        if (it.type === 'image') {
            h += '<label class="cd-lbl">' + esc(t('opacity')) + ' <span class="cd-muted" id="cd-op-val">' + Math.round((it.opacity == null ? 1 : it.opacity) * 100) + '%</span></label><input type="range" class="form-range" data-prop="opacity" min="0.05" max="1" step="0.05" value="' + (it.opacity == null ? 1 : it.opacity) + '">';
            h += '<div class="form-check form-switch mt-1"><input class="form-check-input" type="checkbox" id="cd-lock" ' + (state.lockRatio ? 'checked' : '') + '><label class="form-check-label small" for="cd-lock">' + esc(t('lock_ratio')) + '</label></div>';
        }

        h += '<label class="cd-lbl mt-2">' + esc(t('position')) + '</label><div class="row g-2">'
            + ['x', 'y', 'w', 'h'].map(function (k) { return '<div class="col-3"><div class="input-group input-group-sm"><span class="input-group-text">' + k.toUpperCase() + '</span><input type="number" class="form-control" data-prop="' + k + '" value="' + Math.round(it[k]) + '"></div></div>'; }).join('')
            + '</div>';
        h += '<div class="row g-2 mt-1 align-items-end"><div class="col-6"><label class="cd-lbl">' + esc(t('rotation')) + '</label><div class="input-group input-group-sm"><input type="number" class="form-control" data-prop="r" step="1" min="-180" max="180" value="' + round1(it.r || 0) + '"><button class="btn btn-outline-secondary" type="button" data-set-prop="r" data-val="0" title="0°"><i class="fa-solid fa-rotate-left"></i></button></div></div>'
            + '<div class="col-6"><div class="btn-group btn-group-sm w-100"><button type="button" class="btn btn-outline-secondary" data-act="center_h" title="' + esc(t('center_h')) + '"><i class="fa-solid fa-arrows-left-right-to-line"></i></button><button type="button" class="btn btn-outline-secondary" data-act="center_v" title="' + esc(t('center_v')) + '"><i class="fa-solid fa-arrows-up-down"></i></button></div></div></div>';

        h += '<label class="cd-lbl mt-2">' + esc(t('order')) + '</label><div class="btn-group btn-group-sm w-100">'
            + '<button type="button" class="btn btn-outline-secondary" data-act="front" title="' + esc(t('bring_front')) + '"><i class="fa-solid fa-angles-up"></i></button>'
            + '<button type="button" class="btn btn-outline-secondary" data-act="up" title="' + esc(t('up')) + '"><i class="fa-solid fa-angle-up"></i></button>'
            + '<button type="button" class="btn btn-outline-secondary" data-act="down" title="' + esc(t('down')) + '"><i class="fa-solid fa-angle-down"></i></button>'
            + '<button type="button" class="btn btn-outline-secondary" data-act="back" title="' + esc(t('send_back')) + '"><i class="fa-solid fa-angles-down"></i></button></div>';
        h += '<div class="d-flex gap-2 mt-3"><button type="button" class="btn btn-sm btn-outline-primary flex-fill" data-act="dup"><i class="fa-regular fa-copy me-1"></i>' + esc(t('duplicate')) + '</button><button type="button" class="btn btn-sm btn-outline-danger flex-fill" data-act="del"><i class="fa-regular fa-trash-can me-1"></i>' + esc(t('delete')) + '</button></div>';
        el.props.innerHTML = h;
    }

    var propTimer = null;
    el.props.addEventListener('input', function (e) {
        var inp = e.target, prop = inp.dataset.prop, it = state.sel && item(state.sel);
        if (!prop || !it) return;
        var v = inp.value;
        if (['x', 'y', 'w', 'h', 'r', 'size', 'lh', 'opacity'].indexOf(prop) >= 0) {
            v = parseFloat(v); if (isNaN(v)) return;
            if (prop === 'w' || prop === 'h') v = Math.max(4, v);
            if (prop === 'size') v = clamp(v, 6, 300);
            if (prop === 'opacity') { var ov = $('#cd-op-val'); if (ov) ov.textContent = Math.round(v * 100) + '%'; }
        }
        it[prop] = v;
        renderItem(it.id); renderSelection();
        if (prop === 'text') renderLayers();
        clearTimeout(propTimer); propTimer = setTimeout(commit, 400);
    });
    el.props.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var it = state.sel && item(state.sel); if (!it) return;
        if (b.dataset.toggleProp) { it[b.dataset.toggleProp] = !it[b.dataset.toggleProp]; renderItem(it.id); renderProps(); commit(); }
        else if (b.dataset.setProp) { var v = b.dataset.val; it[b.dataset.setProp] = isNaN(parseFloat(v)) ? v : parseFloat(v); renderItem(it.id); renderSelection(); renderProps(); commit(); }
        else if (b.dataset.act) action(b.dataset.act);
    });
    el.props.addEventListener('change', function (e) { if (e.target.id === 'cd-lock') state.lockRatio = e.target.checked; });

    // ------------------------------------------------------------ actions
    function action(act) {
        var it = state.sel && item(state.sel); if (!it) return;
        var i = indexOf(it.id), arr = state.layout.items;
        switch (act) {
            case 'del': arr.splice(i, 1); state.sel = null; renumber(); break;
            case 'dup': var c = JSON.parse(JSON.stringify(it)); c.id = uid(); c.x += 20; c.y += 20;
                if (c.type === 'image' && !canAdd(c.key)) return;
                arr.splice(i + 1, 0, c); state.sel = c.id; renumber(); break;
            case 'front': arr.splice(i, 1); arr.push(it); break;
            case 'back': arr.splice(i, 1); arr.unshift(it); break;
            case 'up': if (i < arr.length - 1) { arr.splice(i, 1); arr.splice(i + 1, 0, it); } break;
            case 'down': if (i > 0) { arr.splice(i, 1); arr.splice(i - 1, 0, it); } break;
            case 'center_h': it.x = Math.round((CANVAS_W - it.w) / 2); break;
            case 'center_v': it.y = Math.round((CANVAS_H - it.h) / 2); break;
        }
        renderAll(); commit();
    }
    function canAdd(key) {
        var max = CFG.limits[key];
        if (count('image', key) >= max) { notify(t('limit_' + key, { max: max })); return false; }
        return true;
    }
    function notify(msg, type) {
        if (window.Swal) Swal.fire({ toast: true, position: 'top-end', icon: type || 'warning', title: msg, showConfirmButton: false, timer: 2600 });
        else alert(msg);
    }
    function select(id) { state.sel = id; renderSelection(); renderLayers(); renderProps(); }
    function addItem(it, selectIt) {
        it.id = it.id || uid();
        state.layout.items.push(it);
        renumber(); renderAll();
        if (selectIt !== false) select(it.id);
        commit();
    }

    // ------------------------------------------------------------ palette
    function newText(key, extra) {
        var base = { type: 'text', key: key, x: 262, y: 360, w: 600, h: 44, r: 0, text: key === 'free' ? t('default_text') : '',
            font: 'sarabun', size: 28, color: '#1e3c54', bold: false, italic: false, align: 'center', lh: 1.25 };
        Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
        base.h = base.h || Math.round(base.size * base.lh * 1.1);
        return base;
    }
    $$('[data-add]').forEach(function (b) {
        b.addEventListener('click', function () {
            var kind = b.dataset.add;
            if (kind === 'text') addItem(newText(b.dataset.key || 'free'));
            else if (kind === 'qr') {
                var ex = state.layout.items.filter(function (i) { return i.type === 'qr'; })[0];
                if (ex) select(ex.id); else addItem({ type: 'qr', x: 1000, y: 680, w: 80, h: 80, r: 0 });
            } else if (kind === 'background' || kind === 'logo' || kind === 'signature') {
                if (kind !== 'background' && !canAdd(kind)) return;
                el.file.dataset.kind = kind; el.file.value = ''; el.file.click();
            }
        });
    });
    $('#cd-remove-bg').addEventListener('click', function () { state.layout.background = null; renderBackground(); commit(); });

    el.file.addEventListener('change', function () {
        var f = el.file.files[0], kind = el.file.dataset.kind; if (!f) return;
        var fd = new FormData(); fd.append('file', f); fd.append('kind', kind); fd.append('_token', CFG.csrf);
        el.stage.classList.add('is-busy');
        fetch(CFG.uploadUrl, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
            .then(function (j) {
                if (kind === 'background') { state.layout.background = { path: j.path }; renderBackground(); commit(); return; }
                var ratio = (j.width && j.height) ? j.width / j.height : 2;
                if (kind === 'logo') {
                    var lw = 120, lh = Math.round(lw / ratio);
                    addItem({ type: 'image', key: 'logo', path: j.path, x: 80, y: 60, w: lw, h: lh, r: 0, opacity: 1 });
                } else {
                    var sw = 180, sh = Math.round(sw / ratio), n = count('image', 'signature');
                    var cx = [562, 300, 824][n] || 562;           // ลายเซ็นที่ 1 กลาง, 2 ซ้าย, 3 ขวา
                    var sig = { type: 'image', key: 'signature', path: j.path, x: cx - sw / 2, y: 590 - sh, w: sw, h: sh, r: 0, opacity: 1 };
                    state.layout.items.push(sig); sig.id = uid();
                    state.layout.items.push(newText('free', { id: uid(), text: t('sign_name'), x: cx - 150, y: 596, w: 300, h: 30, size: 20, bold: true }));
                    state.layout.items.push(newText('free', { id: uid(), text: t('sign_position'), x: cx - 150, y: 626, w: 300, h: 28, size: 18 }));
                    renumber(); renderAll(); select(sig.id); commit();
                }
            })
            .catch(function (err) {
                var msg = (err && err.message) || (err && err.errors && Object.values(err.errors)[0][0]) || t('upload_fail');
                notify(msg, 'error');
            })
            .finally(function () { el.stage.classList.remove('is-busy'); });
    });

    // ------------------------------------------------------------ pointer interactions (move / resize / rotate)
    var drag = null;
    function canvasPoint(e) {
        var r = el.canvas.getBoundingClientRect();     // rect หลัง scale แล้ว
        return { x: (e.clientX - r.left) / state.zoom, y: (e.clientY - r.top) / state.zoom };
    }
    function rot(dx, dy, deg) { var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return { x: dx * c - dy * s, y: dx * s + dy * c }; }

    el.stage.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        var handle = e.target.closest('.cd-handle');
        var node = e.target.closest('.cd-item');
        if (handle) {
            var it = item(state.sel); if (!it) return;
            startDrag(e, handle.dataset.h === 'rot' ? 'rotate' : 'resize', it, handle.dataset.h);
        } else if (node) {
            if (state.sel !== node.dataset.id) select(node.dataset.id);
            startDrag(e, 'move', item(node.dataset.id));
        } else if (e.target.closest('#cd-selbox')) {
            var it2 = item(state.sel); if (it2) startDrag(e, 'move', it2);
        } else {
            select(null);
        }
    });

    function startDrag(e, mode, it, handle) {
        e.preventDefault();
        try { el.stage.setPointerCapture(e.pointerId); } catch (err) { /* pointer สังเคราะห์/ไม่รองรับ - ยังลากได้ปกติ */ }
        var p = canvasPoint(e);
        drag = { mode: mode, it: it, handle: handle, p0: p, o: { x: it.x, y: it.y, w: it.w, h: it.h, r: it.r || 0, size: it.size },
            cx: it.x + it.w / 2, cy: it.y + it.h / 2, moved: false };
        if (mode === 'rotate') drag.a0 = Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180 / Math.PI - drag.o.r;
        el.stage.classList.add('is-dragging');
    }

    el.stage.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var p = canvasPoint(e), it = drag.it, o = drag.o, dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) drag.moved = true;

        if (drag.mode === 'move') {
            var nx = o.x + dx, ny = o.y + dy;
            if (!e.altKey) { var s = snapMove(it, nx, ny); nx = s.x; ny = s.y; } else clearGuides();
            it.x = Math.round(nx); it.y = Math.round(ny);
        } else if (drag.mode === 'rotate') {
            var a = Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180 / Math.PI - drag.a0;
            if (e.shiftKey) a = Math.round(a / 15) * 15;
            a = ((a + 180) % 360 + 360) % 360 - 180;
            if (Math.abs(a) < 2) a = 0; if (Math.abs(Math.abs(a) - 90) < 2) a = a > 0 ? 90 : -90; if (Math.abs(Math.abs(a) - 180) < 2) a = 180;
            it.r = round1(a);
        } else {
            resizeTo(it, o, drag.handle, dx, dy, e);
        }
        renderItem(it.id); renderSelection();
    });

    function endDrag(e) {
        if (!drag) return;
        el.stage.classList.remove('is-dragging'); clearGuides();
        if (drag.moved) { renderProps(); commit(); }
        drag = null;
    }
    el.stage.addEventListener('pointerup', endDrag);
    el.stage.addEventListener('pointercancel', endDrag);

    /* ย่อ/ขยายโดยคิดในแกนของ item (รองรับหมุน) และตรึงมุม/ขอบตรงข้ามไว้กับที่
       h = n,s,e,w,ne,nw,se,sw ; ตัวอักษร: มุมสเกลเท่ากันทั้งกล่องและขนาดฟอนต์, ขอบปรับเฉพาะกล่อง */
    function resizeTo(it, o, h, dx, dy, e) {
        var sx = h.indexOf('e') >= 0 ? 1 : h.indexOf('w') >= 0 ? -1 : 0;
        var sy = h.indexOf('s') >= 0 ? 1 : h.indexOf('n') >= 0 ? -1 : 0;
        var d = rot(dx, dy, -o.r);
        var nw = o.w + sx * d.x, nh = o.h + sy * d.y;
        var corner = sx !== 0 && sy !== 0;
        var lock = corner && (it.type === 'image' ? (state.lockRatio !== e.shiftKey) : true);
        if (it.type === 'qr') lock = true;
        if (lock) {
            var k = Math.max(nw / o.w, nh / o.h);
            if (sx === 0) k = nh / o.h; if (sy === 0) k = nw / o.w;
            k = Math.max(k, 4 / Math.min(o.w, o.h));
            nw = o.w * k; nh = o.h * k;
            if (it.type === 'text' && corner) it.size = clamp(Math.round(o.size * k), 6, 300);
        }
        nw = Math.max(4, nw); nh = Math.max(4, nh);
        // จุดยึด (ตรงข้ามกับด้านที่ลาก) ต้องอยู่ที่เดิมในพิกัดโลก
        var ax = -sx * o.w / 2, ay = -sy * o.h / 2;
        var aw = rot(ax, ay, o.r);
        var axW = drag.cx + aw.x, ayW = drag.cy + aw.y;
        var an = rot(-sx * nw / 2, -sy * nh / 2, o.r);
        var ncx = axW - an.x, ncy = ayW - an.y;
        it.w = Math.round(nw); it.h = Math.round(nh);
        it.x = Math.round(ncx - nw / 2); it.y = Math.round(ncy - nh / 2);
    }

    // snap ขณะย้าย: กึ่งกลาง/ขอบผืน และกึ่งกลาง/ขอบของรายการอื่น (เฉพาะที่ไม่หมุน)
    function snapMove(it, nx, ny) {
        var tol = SNAP / state.zoom, gx = [], gy = [];
        var xs = [{ v: 0, k: 'l' }, { v: CANVAS_W / 2, k: 'c' }, { v: CANVAS_W, k: 'r' }];
        var ys = [{ v: 0, k: 't' }, { v: CANVAS_H / 2, k: 'c' }, { v: CANVAS_H, k: 'b' }];
        state.layout.items.forEach(function (o) {
            if (o.id === it.id || o.r) return;
            xs.push({ v: o.x, k: 'l' }, { v: o.x + o.w / 2, k: 'c' }, { v: o.x + o.w, k: 'r' });
            ys.push({ v: o.y, k: 't' }, { v: o.y + o.h / 2, k: 'c' }, { v: o.y + o.h, k: 'b' });
        });
        var cand = [{ off: 0 }, { off: it.w / 2 }, { off: it.w }], best = null;
        cand.forEach(function (c) { xs.forEach(function (s) { var d = Math.abs(nx + c.off - s.v); if (d < tol && (!best || d < best.d)) best = { d: d, x: s.v - c.off, g: s.v }; }); });
        if (best) { nx = best.x; gx.push(best.g); }
        best = null;
        [{ off: 0 }, { off: it.h / 2 }, { off: it.h }].forEach(function (c) { ys.forEach(function (s) { var d = Math.abs(ny + c.off - s.v); if (d < tol && (!best || d < best.d)) best = { d: d, y: s.v - c.off, g: s.v }; }); });
        if (best) { ny = best.y; gy.push(best.g); }
        drawGuides(gx, gy);
        return { x: nx, y: ny };
    }
    function drawGuides(gx, gy) {
        el.guides.innerHTML = gx.map(function (x) { return '<div class="cd-guide-v" style="left:' + x + 'px"></div>'; }).join('')
            + gy.map(function (y) { return '<div class="cd-guide-h" style="top:' + y + 'px"></div>'; }).join('');
    }
    function clearGuides() { el.guides.innerHTML = ''; }

    // ------------------------------------------------------------ layers panel / keyboard / zoom controls
    el.layers.addEventListener('click', function (e) { var l = e.target.closest('.cd-layer'); if (l) select(l.dataset.id); });

    document.addEventListener('keydown', function (e) {
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
        var it = state.sel && item(state.sel);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save('2'); return; }
        if (!it) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); action('dup'); return; }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); action('del'); return; }
        if (e.key === 'Escape') { select(null); return; }
        var step = e.shiftKey ? 10 : 1, moved = true;
        switch (e.key) {
            case 'ArrowLeft': it.x -= step; break;
            case 'ArrowRight': it.x += step; break;
            case 'ArrowUp': it.y -= step; break;
            case 'ArrowDown': it.y += step; break;
            default: moved = false;
        }
        if (moved) { e.preventDefault(); renderItem(it.id); renderSelection(); renderProps(); clearTimeout(propTimer); propTimer = setTimeout(commit, 300); }
    });

    $('#cd-zoom-in').addEventListener('click', function () { setZoom(state.zoom * 1.2, true); });
    $('#cd-zoom-out').addEventListener('click', function () { setZoom(state.zoom / 1.2, true); });
    $('#cd-zoom-fit').addEventListener('click', zoomFit);
    el.stage.addEventListener('wheel', function (e) { if (e.ctrlKey) { e.preventDefault(); setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), true); } }, { passive: false });
    el.undo.addEventListener('click', undo);
    el.redo.addEventListener('click', redo);
    window.addEventListener('resize', function () { renderSelection(); });

    // ------------------------------------------------------------ save / preview
    function serialize() { renumber(); return JSON.stringify(state.layout); }
    function save(opt) {
        var title = $('#cd-title');
        if (!title.value.trim()) { title.focus(); title.classList.add('is-invalid'); return; }
        el.layoutInput.value = serialize();
        el.saveOpt.value = opt || '1';
        state.dirty = false;
        el.form.submit();
    }
    window.cdSave = save;
    $$('[data-save]').forEach(function (b) { b.addEventListener('click', function () { save(b.dataset.save); }); });
    $$('[data-preview]').forEach(function (b) {
        b.addEventListener('click', function () {
            el.previewLayout.value = serialize();
            el.previewPdf.value = b.dataset.preview === 'pdf' ? '1' : '0';
            el.previewForm.submit();
        });
    });
    $('#cd-title').addEventListener('input', function () { this.classList.remove('is-invalid'); state.dirty = true; });
    window.addEventListener('beforeunload', function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = t('unsaved'); } });

    // ------------------------------------------------------------ init
    renumber();
    state.history.push(snapshot());
    updateHistoryButtons();
    renderAll();
    // รอฟอนต์โหลดก่อนวัดกรอบ ไม่งั้นข้อความกระโดดตอนฟอนต์มา
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(function () { zoomFit(); renderItems(); });
})();
