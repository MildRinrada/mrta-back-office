/* Certificate designer - จัดวางรายการบนใบประกาศแบบลาก/ย่อขยาย/หมุน (Bootstrap 5 / Font Awesome 6)
 * พิกัดทั้งหมดเป็น px บนผืน 1123x794 (เท่ากับที่ตัวเรนเดอร์ฝั่งเซิร์ฟเวอร์ใช้) - ผืนถูกย่อ/ขยายด้วย CSS transform
 * ตั้งค่าผ่าน window.CD = { layout, fonts, sample, keyLabels, limits, defaultBg, assetUrl, uploadUrl, fontUploadUrl, csrf, i18n }
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
    var nextDay = function (ymd) {   // 'Y-m-d' + 1 วัน (คิดแบบ UTC ไม่ให้ timezone เลื่อนวัน)
        var p = ymd.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + 1));
        return d.toISOString().slice(0, 10);
    };
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
        file: $('#cd-file'), fontFile: $('#cd-font-file'), zoomLabel: $('#cd-zoom-label'),
        form: $('#frm_main'), layoutInput: $('#cd-layout-input'), saveOpt: $('#save_option'),
        previewForm: $('#frm_preview'), previewLayout: $('#cd-preview-layout'), previewPdf: $('#cd-preview-pdf'),
        previewDate: $('#cd-preview-date'), previewDateInput: $('#cd-preview-date-input'),
        undo: $('#cd-undo'), redo: $('#cd-redo')
    };

    // ------------------------------------------------------------ helpers
    function item(id) { for (var i = 0; i < state.layout.items.length; i++) if (state.layout.items[i].id === id) return state.layout.items[i]; return null; }
    function indexOf(id) { for (var i = 0; i < state.layout.items.length; i++) if (state.layout.items[i].id === id) return i; return -1; }
    function assetUrl(path) { return CFG.assetUrl.replace('__FILE__', path.split('/').pop()); }
    function fontCss(key) { var f = CFG.fonts[key] || CFG.fonts.sarabun; return "'" + f.css + "'"; }
    function textOf(it) {
        if (it.role) {   // ชื่อ/ตำแหน่งของช่องลายเซ็น = ของผู้ลงนามที่ใช้อยู่ ณ วันที่ตัวอย่าง
            var set = signerSet(it), s = set && activeSigner(set.sig);
            if (set) return s ? (it.role === 'sign_name' ? s.name : s.position) || '' : '';
        }
        return it.key === 'free' ? it.text : (CFG.sample[it.key] || '');
    }
    // ป้ายในกรอบ (สั้น ใช้ฟอนต์/ขนาดของกรอบ) และคำอธิบายเต็มในแผงคุณสมบัติ ของข้อมูลอัตโนมัติที่ว่างในตัวอย่างนี้
    function dateHidden(it) { return (it.key === 'issue_date' || it.key === 'issue_date_en') && CFG.sample.show_date === false; }
    function placeholderOf(it) {
        // ชุดที่ไม่แสดงวันที่: แสดงข้อความวันที่จริงของชุดแบบจาง (ใบจริงเว้นว่าง - เหตุผลอยู่ในแผงคุณสมบัติ)
        if (dateHidden(it) && CFG.sample[it.key + '_hidden']) return CFG.sample[it.key + '_hidden'];
        var label = CFG.keyLabels[it.key] || it.key;
        return '[' + label + (dateHidden(it) ? ' - ' + t('date_hidden_short') : '') + ']';
    }
    function emptyReason(it) { return dateHidden(it) ? t('date_hidden') : t('auto_empty'); }
    function labelOf(it) {
        if (it.type === 'qr') return t('item_qr');
        if (it.type === 'image' && it.key === 'signature') {
            var a = activeSigner(it), n = slotSigners(it).length, nm = a ? (a.name || '').replace(/^\(|\)$/g, '').trim() : '';
            return t('item_signature') + (nm ? ': ' + nm : ' ' + (it.slot || '')) + (n > 1 ? ' (' + t('signer_count', { n: n }) + ')' : '');
        }
        if (it.type === 'image') return t('item_logo') + ' ' + (it.slot || '');
        if (it.key !== 'free') return CFG.keyLabels[it.key] || it.key;
        var s = (it.text || '').replace(/\s+/g, ' ').trim();
        return s ? (s.length > 22 ? s.slice(0, 22) + '…' : s) : CFG.keyLabels.free;
    }
    // ช่วงวันที่แสดง (ใบรายวิชา: from/to = Y-m-d) เทียบกับ "วันที่เรียนจบ (ตัวอย่าง)" - เทียบสตริงได้เพราะรูปแบบเดียวกัน
    function inRange(it) {
        var d = CFG.dateRanges && el.previewDate ? el.previewDate.value : '';
        if (!d) return true;
        return !(it.from && d < it.from) && !(it.to && d > it.to);
    }
    function groupOf(it) { return it.group ? state.layout.items.filter(function (i) { return i.group === it.group; }) : [it]; }
    // ชุดผู้ลงนาม = รูปลายเซ็น + ข้อความชื่อ (role sign_name) + ตำแหน่ง (role sign_position) ที่ group เดียวกัน
    function signerSet(it) {
        if (!it || !it.group) return null;
        var s = { sig: null, name: null, pos: null };
        groupOf(it).forEach(function (i) {
            if (i.type === 'image' && i.key === 'signature') s.sig = i;
            else if (i.role === 'sign_name') s.name = i;
            else if (i.role === 'sign_position') s.pos = i;
        });
        return s.sig ? s : null;
    }
    // ช่องลายเซ็น: รายชื่อผู้ลงนามเรียงลำดับ - ใช้คนแรกที่ยังไม่หมดอายุ ณ วันที่ (วันที่ตัวอย่างของรายวิชา / วันที่ในใบของใบนอก)
    function slotSigners(sig) {
        if (!sig.signers || !sig.signers.length) sig.signers = [{ path: sig.path, name: '', position: '', from: null, to: null }];
        return sig.signers;
    }
    function previewDay() { return (el.previewDate && el.previewDate.value) || CFG.sample.issued_on || ''; }
    function activeIndex(sig) {
        var d = previewDay(), list = slotSigners(sig);
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            if (!d || (!(s.from && d < s.from) && !(s.to && d > s.to))) return i;
        }
        return -1;
    }
    function activeSigner(sig) { var i = activeIndex(sig); return i >= 0 ? slotSigners(sig)[i] : null; }
    function firstPath(sig) { var s = slotSigners(sig).filter(function (x) { return x.path; })[0]; return s ? s.path : sig.path; }
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
        node.classList.toggle('cd-off', !inRange(it));
        if (it.type === 'text') {
            var inner = node.firstChild, txt = textOf(it);
            // ข้อมูลอัตโนมัติที่ว่างในตัวอย่างนี้ - แสดงป้ายบอกว่าเป็นช่องอะไร/ทำไมว่าง (เฉพาะหน้าจัดวาง ใบจริงเว้นว่าง)
            var placeholder = !txt && it.key !== 'free' && !it.role;
            inner.textContent = placeholder ? placeholderOf(it) : txt;
            var sample = placeholder && dateHidden(it) && !!CFG.sample[it.key + '_hidden'];
            inner.classList.toggle('cd-placeholder', placeholder && !sample);
            // สี/ฟอนต์จริงเต็ม ๆ ให้ตรวจได้ - บอกว่าใบจริงเว้นว่างด้วยกรอบเส้นประ + ป้ายเล็ก แทนการทำให้จาง
            node.classList.toggle('cd-datehidden', sample);
            node.setAttribute('data-hidden-label', sample ? t('date_hidden_short') : '');
            inner.style.fontFamily = fontCss(it.font);
            inner.style.fontSize = it.size + 'px';
            inner.style.lineHeight = it.lh;
            inner.style.color = it.color;
            inner.style.fontWeight = it.bold ? '700' : '400';
            inner.style.fontStyle = it.italic ? 'italic' : 'normal';
            inner.style.textAlign = it.align;
            node.classList.toggle('cd-empty', !textOf(it));
        } else if (it.type === 'image') {
            var img = node.firstChild, path = it.path;
            if (it.key === 'signature') {
                // ช่องลายเซ็น: แสดงรูปของคนที่ใช้อยู่ / ไม่มีใครใช้ได้หรือคนนั้นไม่มีรูป = แสดงรูปแรกแบบจาง
                var a = activeSigner(it);
                path = a && a.path ? a.path : firstPath(it);
                node.classList.add('cd-sigslot');
                node.classList.toggle('cd-off', !a || !a.path || !inRange(it));
            }
            // ช่องลายเซ็นที่ยังไม่มีรูปสักคน (เช่น ไฟล์ของใบเดิมหาย) = กรอบว่าง ให้กด "เปลี่ยนรูป" ทางขวา
            node.classList.toggle('cd-noimg', !path);
            node.setAttribute('data-noimg', path ? '' : t('no_image'));
            var src = path ? assetUrl(path) : '';
            if ((img.getAttribute('src') || '') !== src) { if (src) img.src = src; else img.removeAttribute('src'); }
            img.style.opacity = it.opacity == null ? 1 : it.opacity;
        }
        if (it.role && signerSet(it) && !activeSigner(signerSet(it).sig)) node.classList.add('cd-off');
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
            var range = (CFG.dateRanges && (it.from || it.to)) ? '<small class="cd-layer-range' + (inRange(it) ? '' : ' is-off') + '"><i class="fa-regular fa-calendar-days"></i>' + esc((it.from || '…') + ' – ' + (it.to || '…')) + '</small>' : '';
            html += '<div class="cd-layer' + (it.id === state.sel ? ' is-active' : '') + '" data-id="' + it.id + '"><i class="fa-solid ' + icon + '"></i><span>' + esc(labelOf(it)) + range + '</span><i class="fa-solid fa-grip-vertical cd-layer-grip"></i></div>';
        });
        el.layers.innerHTML = html || '<div class="cd-muted small p-2">-</div>';
    }

    // ------------------------------------------------------------ properties panel
    function renderProps() {
        var it = state.sel && item(state.sel);
        if (!it) { el.props.innerHTML = '<div class="cd-empty-props"><i class="fa-regular fa-hand-pointer"></i><div>' + esc(t('no_selection')) + '</div></div>'; return; }
        var h = '<div class="cd-prop-title"><span>' + esc(labelOf(it)) + '</span></div>';

        // ช่องลายเซ็น: รายชื่อผู้ลงนามเรียงลำดับ (คนแรกที่ยังไม่หมดอายุ ณ วันที่เรียนจบจะขึ้นบนใบ) - คลิกชิ้นไหนของช่องก็แก้ได้
        var set = signerSet(it);
        if (set) {
            var list = slotSigners(set.sig), act = activeIndex(set.sig), day = previewDay();
            h += '<div class="cd-signer"><div class="cd-signer-title"><i class="fa-solid fa-signature me-1"></i>' + esc(t('slot_title')) + '</div>'
                + '<div class="cd-muted small mb-2">' + esc(t('slot_rule')) + (day ? ' ' + esc(t('slot_status_at', { date: day })) : '') + '</div>';
            list.forEach(function (s, i) {
                // สถานะ ณ วันที่ตัวอย่าง - ลำดับในรายการไม่เปลี่ยน (ลำดับ = ความสำคัญ ใบย้อนหลังยังใช้คนที่หมดอายุแล้วได้)
                var expired = !!(day && s.to && day > s.to), waiting = !!(day && s.from && day < s.from), badge;
                if (i === act) badge = '<span class="badge bg-success ms-1">' + esc(t('signer_active')) + '</span>';
                else if (expired) badge = '<span class="badge bg-secondary ms-1">' + esc(t('signer_expired')) + '</span>';
                else if (waiting) badge = '<span class="badge bg-info ms-1">' + esc(t('signer_waiting', { date: s.from })) + '</span>';
                else badge = '<span class="badge bg-light text-dark ms-1">' + esc(t('signer_backup')) + '</span>';
                h += '<div class="cd-signer-row' + (i === act ? ' is-active' : '') + (expired ? ' is-expired' : '') + '" data-idx="' + i + '">'
                    + '<div class="cd-signer-head"><span class="cd-signer-no">' + (i + 1) + '</span>'
                    + (s.path ? '<img src="' + esc(assetUrl(s.path)) + '" alt="">' : '<span class="cd-muted small">' + esc(t('no_image')) + '</span>')
                    + badge
                    + '<div class="btn-group btn-group-sm ms-auto">'
                    + '<button type="button" class="btn btn-outline-secondary" data-sact="img" title="' + esc(t('replace_image')) + '"><i class="fa-solid fa-image"></i></button>'
                    + '<button type="button" class="btn btn-outline-secondary" data-sact="up" title="' + esc(t('up')) + '"' + (i === 0 ? ' disabled' : '') + '><i class="fa-solid fa-angle-up"></i></button>'
                    + '<button type="button" class="btn btn-outline-secondary" data-sact="down" title="' + esc(t('down')) + '"' + (i === list.length - 1 ? ' disabled' : '') + '><i class="fa-solid fa-angle-down"></i></button>'
                    + '<button type="button" class="btn btn-outline-danger" data-sact="del" title="' + esc(t('delete')) + '"><i class="fa-solid fa-xmark"></i></button>'
                    + '</div></div>'
                    + '<input type="text" class="form-control form-control-sm mb-1" data-sfield="name" value="' + esc(s.name) + '" placeholder="' + esc(t('sign_name')) + ' ' + esc(t('sign_name_ph')) + '">'
                    + '<input type="text" class="form-control form-control-sm mb-1" data-sfield="position" value="' + esc(s.position) + '" placeholder="' + esc(t('sign_position')) + '">'
                    + '<div class="row g-2"><div class="col-6"><label class="cd-lbl">' + esc(t('signer_from')) + '</label><input type="date" class="form-control form-control-sm" data-sfield="from" value="' + esc(s.from || '') + '"></div>'
                    + '<div class="col-6"><label class="cd-lbl">' + esc(t('signer_to')) + '</label><input type="date" class="form-control form-control-sm" data-sfield="to" value="' + esc(s.to || '') + '"></div></div>'
                    + '</div>';
            });
            if (act < 0) h += '<div class="alert alert-warning py-1 px-2 small mb-2">' + esc(t('slot_none_active')) + '</div>';
            h += '<button type="button" class="btn btn-sm btn-outline-primary w-100" data-sact="add"><i class="fa-solid fa-plus me-1"></i>' + esc(t('signer_add')) + '</button>'
                + '<div class="cd-muted small mt-2">' + esc(t('signer_hint')) + '</div></div>';
        }

        if (it.type === 'text') {
            h += '<label class="cd-lbl">' + esc(t('content')) + '</label>';
            if (it.key === 'free') {
                h += '<textarea class="form-control form-control-sm" rows="3" data-prop="text">' + esc(it.text) + '</textarea>';
            } else {
                h += '<div class="cd-auto-note"><i class="fa-solid fa-wand-magic-sparkles me-1"></i>' + esc(t('auto_content'))
                    + (CFG.sample[it.key] ? '<div class="cd-muted mt-1">' + esc(CFG.sample[it.key]) + '</div>' : '<div class="text-warning mt-1">' + esc(emptyReason(it)) + '</div>') + '</div>';
            }
            h += '<div class="row g-2"><div class="col-7"><label class="cd-lbl">' + esc(t('font')) + '</label><select class="form-select form-select-sm" data-prop="font">';
            Object.keys(CFG.fonts).forEach(function (k) { h += '<option value="' + k + '"' + (k === it.font ? ' selected' : '') + ' style="font-family:' + fontCss(k) + '">' + esc(CFG.fonts[k].label) + '</option>'; });
            h += '</select><button type="button" class="btn btn-link btn-sm p-0 mt-1 cd-font-up" data-act="font-upload" title="' + esc(t('font_upload_hint')) + '"><i class="fa-solid fa-upload me-1"></i>' + esc(t('font_upload')) + '</button>'
                + '</div><div class="col-5"><label class="cd-lbl">' + esc(t('size')) + '</label><input type="number" class="form-control form-control-sm" data-prop="size" min="6" max="300" step="1" value="' + it.size + '"></div></div>';
            h += '<div class="row g-2 align-items-end"><div class="col-4"><label class="cd-lbl">' + esc(t('color')) + '</label><input type="color" class="form-control form-control-color form-control-sm w-100" data-prop="color" value="' + it.color + '"></div>';
            h += '<div class="col-8"><div class="btn-group btn-group-sm w-100" role="group">'
                + '<button type="button" class="btn btn-outline-secondary' + (it.bold ? ' active' : '') + '" data-toggle-prop="bold" title="' + esc(t('bold')) + '"><i class="fa-solid fa-bold"></i></button>'
                + '<button type="button" class="btn btn-outline-secondary' + (it.italic ? ' active' : '') + '" data-toggle-prop="italic" title="' + esc(t('italic')) + '"><i class="fa-solid fa-italic"></i></button>'
                + ['left', 'center', 'right'].map(function (a) { return '<button type="button" class="btn btn-outline-secondary' + (it.align === a ? ' active' : '') + '" data-set-prop="align" data-val="' + a + '"><i class="fa-solid fa-align-' + a + '"></i></button>'; }).join('')
                + '</div></div></div>';
            h += '<div class="row g-2"><div class="col-6"><label class="cd-lbl">' + esc(t('line_height')) + '</label><input type="number" class="form-control form-control-sm" data-prop="lh" min="0.8" max="3" step="0.05" value="' + it.lh + '"></div></div>';
        }
        if (it.type === 'image') {
            if (!set) h += '<button type="button" class="btn btn-sm btn-outline-primary w-100 mb-2" data-act="replace" data-target="' + it.id + '"><i class="fa-solid fa-rotate me-1"></i>' + esc(t('replace_image')) + '</button>';
            h += '<label class="cd-lbl">' + esc(t('opacity')) + ' <span class="cd-muted" id="cd-op-val">' + Math.round((it.opacity == null ? 1 : it.opacity) * 100) + '%</span></label><input type="range" class="form-range" data-prop="opacity" min="0.05" max="1" step="0.05" value="' + (it.opacity == null ? 1 : it.opacity) + '">';
            h += '<div class="form-check form-switch mt-1"><input class="form-check-input" type="checkbox" id="cd-lock" ' + (state.lockRatio ? 'checked' : '') + '><label class="form-check-label small" for="cd-lock">' + esc(t('lock_ratio')) + '</label></div>';
        }

        h += '<label class="cd-lbl mt-2">' + esc(t('position')) + '</label><div class="row g-2">'
            + ['x', 'y', 'w', 'h'].map(function (k) { return '<div class="col-6 mb-1"><div class="input-group input-group-sm"><span class="input-group-text">' + k.toUpperCase() + '</span><input type="number" class="form-control" data-prop="' + k + '" value="' + Math.round(it[k]) + '"></div></div>'; }).join('')
            + '</div>';
        h += '<div class="row g-2 align-items-end"><div class="col-6"><label class="cd-lbl">' + esc(t('rotation')) + '</label><div class="input-group input-group-sm"><input type="number" class="form-control" data-prop="r" step="1" min="-180" max="180" value="' + round1(it.r || 0) + '"><button class="btn btn-outline-secondary" type="button" data-set-prop="r" data-val="0" title="0°"><i class="fa-solid fa-rotate-left"></i></button></div></div>'
            + '<div class="col-6"><div class="btn-group btn-group-sm w-100"><button type="button" class="btn btn-outline-secondary" data-act="center_h" title="' + esc(t('center_h')) + '"><i class="fa-solid fa-arrows-left-right-to-line"></i></button><button type="button" class="btn btn-outline-secondary" data-act="center_v" title="' + esc(t('center_v')) + '"><i class="fa-solid fa-arrows-up-down"></i></button></div></div></div>';

        h += '<label class="cd-lbl mt-2">' + esc(t('order')) + '</label><div class="btn-group btn-group-sm w-100">'
            + '<button type="button" class="btn btn-outline-secondary" data-act="front" title="' + esc(t('bring_front')) + '"><i class="fa-solid fa-angles-up"></i></button>'
            + '<button type="button" class="btn btn-outline-secondary" data-act="up" title="' + esc(t('up')) + '"><i class="fa-solid fa-angle-up"></i></button>'
            + '<button type="button" class="btn btn-outline-secondary" data-act="down" title="' + esc(t('down')) + '"><i class="fa-solid fa-angle-down"></i></button>'
            + '<button type="button" class="btn btn-outline-secondary" data-act="back" title="' + esc(t('send_back')) + '"><i class="fa-solid fa-angles-down"></i></button></div>';
        if (CFG.dateRanges && !set) {
            h += '<label class="cd-lbl mt-2">' + esc(t('date_range')) + '</label><div class="row g-2">'
                + '<div class="col-6"><input type="date" class="form-control form-control-sm" data-range="from" title="' + esc(t('date_from')) + '" value="' + esc(it.from || '') + '"></div>'
                + '<div class="col-6"><input type="date" class="form-control form-control-sm" data-range="to" title="' + esc(t('date_to')) + '" value="' + esc(it.to || '') + '"></div></div>'
                + '<div class="cd-muted small mt-1">' + esc(groupOf(it).length > 1 ? t('date_range_group') : t('date_range_hint')) + '</div>';
        }
        h += '<div class="d-flex mt-3"><button type="button" class="btn btn-sm btn-outline-primary flex-fill me-2" data-act="dup"><i class="fa-regular fa-copy me-1"></i>' + esc(t('duplicate')) + '</button><button type="button" class="btn btn-sm btn-outline-danger flex-fill" data-act="del"><i class="fa-regular fa-trash-can me-1"></i>' + esc(t('delete')) + '</button></div>';
        el.props.innerHTML = h;
    }

    var propTimer = null;
    el.props.addEventListener('input', function (e) {
        var inp = e.target, prop = inp.dataset.prop, it = state.sel && item(state.sel);
        if (it && (inp.dataset.sfield === 'name' || inp.dataset.sfield === 'position')) { setSignerField(it, inp, inp.value); return; }
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
    // ------------------------------------------------------------ ช่องลายเซ็น (รายชื่อผู้ลงนาม)
    function slotRefresh(set) { groupOf(set.sig).forEach(function (m) { renderItem(m.id); }); renderLayers(); }
    function rowIndex(el2) { var r = el2.closest('.cd-signer-row'); return r ? parseInt(r.dataset.idx, 10) : -1; }
    // ข้อความชื่อ/ตำแหน่งบนใบของช่อง - ยังไม่มี = สร้างใต้รูปลายเซ็น (ช่องที่เพิ่งสร้างจากรูปอย่างเดียว)
    function ensureRoleText(set, role) {
        var node = role === 'sign_name' ? set.name : set.pos;
        if (node) return;
        var s = set.sig, y = role === 'sign_name' ? s.y + s.h + 2 : s.y + s.h + (set.name ? 32 : 2);
        state.layout.items.push(newText('free', { id: uid(), group: s.group, role: role, text: '',
            x: Math.round(s.x + s.w / 2 - 150), y: Math.round(y), w: 300, h: 30, size: role === 'sign_name' ? 26 : 22, bold: role === 'sign_name' }));
        renderItems();
    }
    function setSignerField(it, inp, value) {
        var set = signerSet(it), idx = rowIndex(inp); if (!set || idx < 0) return;
        var s = slotSigners(set.sig)[idx], field = inp.dataset.sfield;
        s[field] = value;
        ensureRoleText(set, field === 'name' ? 'sign_name' : 'sign_position');
        set = signerSet(it);
        // ข้อความของชิ้นบนใบเก็บค่าของคนแรกไว้ด้วย (เผื่ออ่านผังโดยไม่รู้จักช่องลายเซ็น)
        var first = slotSigners(set.sig)[0];
        if (set.name) set.name.text = first.name || '';
        if (set.pos) set.pos.text = first.position || '';
        slotRefresh(set);
        clearTimeout(propTimer); propTimer = setTimeout(commit, 400);
    }
    function slotAction(it, act, idx) {
        var set = signerSet(it); if (!set) return;
        var list = slotSigners(set.sig), tmp;
        if (act === 'img' || act === 'add') {
            if (act === 'add' && list.length >= (CFG.limits.signers || 10)) { notify(t('signer_limit', { max: CFG.limits.signers || 10 })); return; }
            el.file.dataset.kind = 'signature'; el.file.dataset.replace = ''; el.file.dataset.slot = set.sig.id; el.file.dataset.slotIdx = act === 'add' ? 'new' : String(idx);
            el.file.value = ''; el.file.click();
            return;
        }
        if (act === 'up' && idx > 0) { tmp = list[idx - 1]; list[idx - 1] = list[idx]; list[idx] = tmp; }
        else if (act === 'down' && idx < list.length - 1) { tmp = list[idx + 1]; list[idx + 1] = list[idx]; list[idx] = tmp; }
        else if (act === 'del') {
            if (list.length <= 1) { notify(t('signer_last')); return; }
            // คนที่หมดอายุแล้วยังใช้กับใบที่เรียนจบก่อนวันหมดอายุ (ออกใบใหม่ทุกครั้งที่ดาวน์โหลด) - ถามก่อนลบ
            var day = previewDay(), s0 = list[idx];
            if (day && s0.to && day > s0.to && !window.confirm(t('signer_del_expired', { date: s0.to }))) return;
            list.splice(idx, 1);
        } else return;
        set.sig.path = firstPath(set.sig);
        slotRefresh(set); renderProps(); commit();
    }

    el.props.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var it = state.sel && item(state.sel); if (!it) return;
        if (b.dataset.sact) { slotAction(it, b.dataset.sact, rowIndex(b)); return; }
        if (b.dataset.act === 'replace') {
            var target = item(b.dataset.target); if (!target) return;
            el.file.dataset.kind = target.key; el.file.dataset.replace = target.id; el.file.value = ''; el.file.click();
            return;
        }
        if (b.dataset.toggleProp) { it[b.dataset.toggleProp] = !it[b.dataset.toggleProp]; renderItem(it.id); renderProps(); commit(); }
        else if (b.dataset.setProp) { var v = b.dataset.val; it[b.dataset.setProp] = isNaN(parseFloat(v)) ? v : parseFloat(v); renderItem(it.id); renderSelection(); renderProps(); commit(); }
        else if (b.dataset.act) action(b.dataset.act);
    });
    el.props.addEventListener('change', function (e) {
        if (e.target.id === 'cd-lock') { state.lockRatio = e.target.checked; return; }
        var sf = e.target.dataset.sfield;
        if (sf === 'from' || sf === 'to') {
            // วันที่ของผู้ลงนามในช่อง - คนที่ใช้อยู่อาจเปลี่ยน จึงวาดแผงใหม่
            var cur = state.sel && item(state.sel), set = cur && signerSet(cur), idx = rowIndex(e.target);
            if (!set || idx < 0) return;
            slotSigners(set.sig)[idx][sf] = e.target.value || null;
            slotRefresh(set); renderProps(); commit();
            return;
        }
        var key = e.target.dataset.range, it = state.sel && item(state.sel);
        if (!key || !it) return;
        // ลายเซ็น + ชื่อ + ตำแหน่ง ชุดเดียวกันใช้ช่วงวันที่ร่วมกัน
        groupOf(it).forEach(function (g) { g[key] = e.target.value || null; });
        renderItems(); renderLayers(); commit();
    });

    // ------------------------------------------------------------ actions
    function action(act) {
        var it = state.sel && item(state.sel); if (!it) return;
        var i = indexOf(it.id), arr = state.layout.items;
        // รูปลายเซ็นของชุดผู้ลงนาม: ลบ/ทำซ้ำทั้งชุด (ทำซ้ำ = เพิ่มผู้ลงนามคนถัดไปในตำแหน่งเดียวกัน แล้วแก้รูป/ชื่อ/วันที่)
        var set = it.type === 'image' && it.key === 'signature' ? signerSet(it) : null;
        switch (act) {
            case 'font-upload':
                el.fontFile.value = ''; el.fontFile.click();
                return;
            case 'del':
                if (set) state.layout.items = arr.filter(function (x) { return x.group !== it.group; });
                else arr.splice(i, 1);
                state.sel = null; renumber(); break;
            case 'dup':
                if (set) {
                    if (!canAdd('signature')) return;
                    var g = uid(), copy = null;
                    groupOf(it).forEach(function (m) {
                        var c2 = JSON.parse(JSON.stringify(m)); c2.id = uid(); c2.group = g; c2.x += 20; c2.y += 20;
                        arr.push(c2); if (m === it) copy = c2;
                    });
                    state.sel = copy.id; renumber(); break;
                }
                var c = JSON.parse(JSON.stringify(it)); c.id = uid(); c.group = null; c.x += 20; c.y += 20;
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
                el.file.dataset.kind = kind; el.file.dataset.replace = ''; el.file.dataset.slot = ''; el.file.value = ''; el.file.click();
            }
        });
    });
    $('#cd-remove-bg').addEventListener('click', function () { state.layout.background = null; renderBackground(); commit(); });

    // เลือกรูป → หน้าต่างเตรียมรูป (ครอป / ลบพื้นหลัง / ย่อและบีบอัด) → อัปโหลดไฟล์ที่เตรียมแล้ว
    el.file.addEventListener('change', function () {
        var src = el.file.files[0], kind = el.file.dataset.kind; if (!src) return;
        prepareImage(src, kind).then(function (f) { if (f) uploadAsset(f, kind); });
    });
    function uploadAsset(f, kind) {
        var fd = new FormData(); fd.append('file', f, f.name); fd.append('kind', kind); fd.append('_token', CFG.csrf);
        el.stage.classList.add('is-busy');
        fetch(CFG.uploadUrl, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
            .then(function (j) {
                if (kind === 'background') { state.layout.background = { path: j.path }; renderBackground(); commit(); return; }
                var ratio = (j.width && j.height) ? j.width / j.height : 2;
                // ช่องลายเซ็น: เปลี่ยนรูปของผู้ลงนามคนหนึ่ง / เพิ่มผู้ลงนามที่ขึ้นแทน (เริ่มวันถัดจากวันหมดอายุของคนก่อนหน้า)
                var slotSig = el.file.dataset.slot && item(el.file.dataset.slot), slotIdx = el.file.dataset.slotIdx;
                el.file.dataset.slot = ''; el.file.dataset.slotIdx = '';
                if (slotSig) {
                    var list = slotSigners(slotSig);
                    if (slotIdx === 'new') {
                        var last = list[list.length - 1];
                        list.push({ path: j.path, name: '', position: '', from: last && last.to ? nextDay(last.to) : null, to: null });
                    } else if (list[parseInt(slotIdx, 10)]) {
                        list[parseInt(slotIdx, 10)].path = j.path;
                    }
                    slotSig.path = firstPath(slotSig);
                    slotRefresh(signerSet(slotSig)); renderProps(); commit();
                    return;
                }
                // เปลี่ยนรูปของรายการเดิม: คงความสูง ปรับความกว้างตามสัดส่วนรูปใหม่ โดยยึดกึ่งกลางเดิม
                var rep = el.file.dataset.replace && item(el.file.dataset.replace);
                el.file.dataset.replace = '';
                if (rep) {
                    var nw = Math.max(4, Math.round(rep.h * ratio));
                    rep.x = Math.round(rep.x + (rep.w - nw) / 2); rep.w = nw; rep.path = j.path;
                    renderItem(rep.id); renderSelection(); renderProps(); commit();
                    return;
                }
                if (kind === 'logo') {
                    var lw = 120, lh = Math.round(lw / ratio);
                    addItem({ type: 'image', key: 'logo', path: j.path, x: 80, y: 60, w: lw, h: lh, r: 0, opacity: 1 });
                } else {
                    var sw = 180, sh = Math.round(sw / ratio), n = count('image', 'signature');
                    var cx = [562, 300, 824][n] || 562;           // ลายเซ็นที่ 1 กลาง, 2 ซ้าย, 3 ขวา
                    var grp = uid();   // ชุดผู้ลงนาม: ลายเซ็น + ชื่อ + ตำแหน่ง (แก้จากแผงผู้ลงนาม / ย้ายไปด้วยกัน)
                    var sig = { type: 'image', key: 'signature', path: j.path, x: cx - sw / 2, y: 590 - sh, w: sw, h: sh, r: 0, opacity: 1, group: grp,
                        signers: [{ path: j.path, name: '(' + t('sign_name') + ')', position: t('sign_position'), from: null, to: null }] };
                    state.layout.items.push(sig); sig.id = uid();
                    state.layout.items.push(newText('free', { id: uid(), group: grp, role: 'sign_name', text: '(' + t('sign_name') + ')', x: cx - 150, y: 596, w: 300, h: 30, size: 22, bold: true }));
                    state.layout.items.push(newText('free', { id: uid(), group: grp, role: 'sign_position', text: t('sign_position'), x: cx - 150, y: 626, w: 300, h: 28, size: 20 }));
                    renumber(); renderAll(); select(sig.id); commit();
                }
            })
            .catch(function (err) {
                var msg = (err && err.message) || (err && err.errors && Object.values(err.errors)[0][0]) || t('upload_fail');
                notify(msg, 'error');
            })
            .finally(function () { el.stage.classList.remove('is-busy'); });
    }

    // ------------------------------------------------------------ เตรียมรูปก่อนอัปโหลด: ครอป / ลบพื้นหลัง / ย่อและบีบอัด
    // ทำในเบราว์เซอร์ทั้งหมด (ไม่พึ่งไลบรารีภายนอก) - ส่งขึ้นเฉพาะไฟล์ผลลัพธ์ จึงไม่ติดขนาด 5MB ของไฟล์ต้นฉบับ
    var PREP_MAX = { background: [3369, 2382], logo: [1600, 1600], signature: [1600, 1600] };   // เท่ากับที่เซิร์ฟเวอร์ย่อ (CertificateImage)
    var PREP_BYTES = 4.5 * 1024 * 1024;
    var pe = {
        modal: $('#cd-prep'), title: $('#cd-prep-title'), wrap: $('#cd-prep-wrap'), canvas: $('#cd-prep-canvas'), box: $('#cd-crop-box'),
        tip: $('#cd-prep-tip'), bgTools: $('#cd-prep-bgtools'), remove: $('#cd-prep-remove'), tol: $('#cd-prep-tol'), tolVal: $('#cd-prep-tol-val'),
        trim: $('#cd-prep-trim'), reset: $('#cd-prep-reset'), info: $('#cd-prep-info'), note: $('#cd-prep-note'), ok: $('#cd-prep-ok')
    };
    var prep = null;

    function prepareImage(file, kind) {
        return new Promise(function (resolve) {
            if (!/^image\//.test(file.type)) { notify(t('prep_bad_image'), 'error'); resolve(null); return; }
            var url = URL.createObjectURL(file), img = new Image();
            img.onload = function () {
                prep = { img: img, url: url, kind: kind, resolve: resolve, name: (file.name || 'image').replace(/\.[^.]+$/, ''),
                    W: img.naturalWidth, H: img.naturalHeight, ratio: kind === 'background' ? CANVAS_W / CANVAS_H : 0,
                    removeBg: false, tol: 40, cache: null, crop: null, srcBytes: file.size };
                pe.title.textContent = t('prep_title_' + kind);
                pe.tip.textContent = t(kind === 'background' ? 'prep_tip_background' : 'prep_tip_image');
                pe.bgTools.classList.toggle('d-none', kind === 'background');
                pe.box.classList.toggle('is-ratio', !!prep.ratio);
                pe.ok.disabled = false;
                bootstrap.Modal.getOrCreateInstance(pe.modal).show();
            };
            img.onerror = function () { URL.revokeObjectURL(url); notify(t('prep_bad_image'), 'error'); resolve(null); };
            img.src = url;
        });
    }
    function prepFinish(file) {
        if (!prep) return;
        var p = prep; prep = null;
        URL.revokeObjectURL(p.url);
        p.resolve(file || null);
    }
    // วางรูปหลังหน้าต่างเปิดแล้ว (รู้ขนาดพื้นที่จริง)
    pe.modal.addEventListener('shown.bs.modal', function () {
        if (!prep) return;
        var area = pe.wrap.parentNode, availW = Math.max(240, area.clientWidth - 24), availH = Math.max(240, Math.min(window.innerHeight * 0.62, 560));
        prep.scale = Math.min(availW / prep.W, availH / prep.H, 1);
        var w = Math.max(1, Math.round(prep.W * prep.scale)), h = Math.max(1, Math.round(prep.H * prep.scale));
        var base = document.createElement('canvas'); base.width = w; base.height = h;
        var bx = base.getContext('2d'); bx.imageSmoothingQuality = 'high'; bx.drawImage(prep.img, 0, 0, w, h);
        prep.base = bx.getImageData(0, 0, w, h);
        pe.canvas.width = w; pe.canvas.height = h;
        pe.canvas.style.width = w + 'px'; pe.canvas.style.height = h + 'px';
        // พื้นหลังของรูป: โปร่งใสอยู่แล้ว / สีที่ขอบ (ใช้ลบพื้นหลังลายเซ็นที่สแกนหรือถ่ายบนกระดาษ)
        var edge = prepEdge(prep.base);
        prep.transparent = edge.transparent; prep.bg = edge.color;
        prep.removeBg = prep.kind === 'signature' && !prep.transparent;
        pe.remove.checked = prep.removeBg; pe.remove.disabled = prep.transparent;
        pe.tol.value = prep.tol; pe.tolVal.textContent = prep.tol;
        pe.note.textContent = prep.transparent && prep.kind !== 'background' ? t('prep_already_transparent') : '';
        prepResetCrop();
        if (prep.kind === 'signature') prepTrim();
        prepRender();
    });
    pe.modal.addEventListener('hidden.bs.modal', function () { prepFinish(null); });

    function prepEdge(data) {
        var w = data.width, h = data.height, d = data.data, r = [], g = [], b = [], clear = 0, n = 0;
        var step = Math.max(1, Math.round((w + h) / 400));
        function take(x, y) {
            var i = (y * w + x) * 4; n++;
            if (d[i + 3] < 30) { clear++; return; }
            r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]);
        }
        for (var x = 0; x < w; x += step) { take(x, 0); take(x, h - 1); }
        for (var y = 0; y < h; y += step) { take(0, y); take(w - 1, y); }
        function med(a) { if (!a.length) return 255; a.sort(function (p, q) { return p - q; }); return a[a.length >> 1]; }
        return { transparent: clear > n * 0.5, color: [med(r), med(g), med(b)] };
    }
    // ทำให้พิกเซลที่สีใกล้พื้นหลังโปร่งใส (ขอบนุ่มช่วงต่อ ไม่เป็นหยัก)
    function prepRemove(src, bg, tol) {
        var d = new Uint8ClampedArray(src.data), soft = Math.max(10, tol * 0.6);
        for (var i = 0; i < d.length; i += 4) {
            var dist = Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2]));
            if (dist <= tol) d[i + 3] = 0;
            else if (dist < tol + soft) d[i + 3] = Math.round(d[i + 3] * (dist - tol) / soft);
        }
        return new ImageData(d, src.width, src.height);
    }
    function prepPreviewData() {
        if (!prep.removeBg) return prep.base;
        if (!prep.cache || prep.cache.tol !== prep.tol) prep.cache = { tol: prep.tol, data: prepRemove(prep.base, prep.bg, prep.tol) };
        return prep.cache.data;
    }
    function prepRender() {
        pe.canvas.getContext('2d').putImageData(prepPreviewData(), 0, 0);
        var c = prep.crop, s = prep.scale;
        pe.box.style.left = (c.x * s) + 'px'; pe.box.style.top = (c.y * s) + 'px';
        pe.box.style.width = (c.w * s) + 'px'; pe.box.style.height = (c.h * s) + 'px';
        var out = prepOutSize();
        pe.info.textContent = t('prep_output', { w: out.w, h: out.h }) + ' · ' + (prep.kind === 'background' ? 'JPG' : 'PNG');
    }
    function prepOutSize() {
        var c = prep.crop, max = PREP_MAX[prep.kind], k = Math.min(1, max[0] / c.w, max[1] / c.h);
        return { w: Math.max(1, Math.round(c.w * k)), h: Math.max(1, Math.round(c.h * k)) };
    }
    function prepResetCrop() {
        var W = prep.W, H = prep.H;
        if (prep.ratio) {
            var w = W, h = w / prep.ratio;
            if (h > H) { h = H; w = h * prep.ratio; }
            prep.crop = { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
        } else {
            prep.crop = { x: 0, y: 0, w: W, h: H };
        }
    }
    // ตัดขอบว่างรอบลายเซ็น/โลโก้ (ดูจากภาพตัวอย่าง) แล้วเว้นขอบเล็กน้อย
    function prepTrim() {
        var data = prepPreviewData(), w = data.width, h = data.height, d = data.data, bg = prep.bg, tol = prep.tol;
        var alphaMode = prep.removeBg || prep.transparent, x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
            var i = (y * w + x) * 4;
            var ink = alphaMode ? d[i + 3] > 24 : Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2])) > tol;
            if (ink) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 < 0) return;
        var s = prep.scale, pad = Math.max(x1 - x0, y1 - y0) / s * 0.04;
        var nx = Math.max(0, x0 / s - pad), ny = Math.max(0, y0 / s - pad);
        prep.crop = { x: nx, y: ny, w: Math.min(prep.W, (x1 + 1) / s + pad) - nx, h: Math.min(prep.H, (y1 + 1) / s + pad) - ny };
    }

    // ลาก/ย่อขยายกรอบครอป (พิกัดของรูปจริง) - พื้นหลังล็อกสัดส่วน A4 ย่อขยายได้เฉพาะมุม
    pe.box.addEventListener('pointerdown', function (e) {
        if (!prep) return;
        e.preventDefault();
        try { pe.box.setPointerCapture(e.pointerId); } catch (err) { /* ลากต่อได้ */ }
        var hd = e.target.closest('.cd-crop-h');
        prep.drag = { h: hd ? hd.dataset.h : 'move', x0: e.clientX, y0: e.clientY, c0: { x: prep.crop.x, y: prep.crop.y, w: prep.crop.w, h: prep.crop.h } };
    });
    pe.box.addEventListener('pointermove', function (e) {
        if (!prep || !prep.drag) return;
        var dr = prep.drag, c0 = dr.c0, s = prep.scale, W = prep.W, H = prep.H;
        var dx = (e.clientX - dr.x0) / s, dy = (e.clientY - dr.y0) / s, min = 12 / s;
        if (dr.h === 'move') {
            prep.crop = { x: clamp(c0.x + dx, 0, W - c0.w), y: clamp(c0.y + dy, 0, H - c0.h), w: c0.w, h: c0.h };
        } else {
            var x1 = c0.x, y1 = c0.y, x2 = c0.x + c0.w, y2 = c0.y + c0.h, h = dr.h;
            if (h.indexOf('w') >= 0) x1 = clamp(c0.x + dx, 0, x2 - min);
            if (h.indexOf('e') >= 0) x2 = clamp(x2 + dx, x1 + min, W);
            if (h.indexOf('n') >= 0) y1 = clamp(c0.y + dy, 0, y2 - min);
            if (h.indexOf('s') >= 0) y2 = clamp(y2 + dy, y1 + min, H);
            if (prep.ratio) {
                var w = x2 - x1, hh = y2 - y1;
                if (w / hh > prep.ratio) w = hh * prep.ratio; else hh = w / prep.ratio;
                if (h.indexOf('w') >= 0) x1 = x2 - w; else x2 = x1 + w;
                if (h.indexOf('n') >= 0) y1 = y2 - hh; else y2 = y1 + hh;
            }
            prep.crop = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        }
        prepRender();
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) { pe.box.addEventListener(ev, function () { if (prep) prep.drag = null; }); });

    pe.remove.addEventListener('change', function () { if (!prep) return; prep.removeBg = pe.remove.checked; prepRender(); });
    pe.tol.addEventListener('input', function () { if (!prep) return; prep.tol = parseInt(pe.tol.value, 10) || 40; pe.tolVal.textContent = prep.tol; if (prep.removeBg) prepRender(); });
    pe.trim.addEventListener('click', function () { if (!prep) return; prepTrim(); prepRender(); });
    pe.reset.addEventListener('click', function () { if (!prep) return; prepResetCrop(); prepRender(); });

    // ผลลัพธ์: ครอป → ย่อไม่เกินขนาดที่ใช้จริง → ลบพื้นหลัง → พื้นหลังเป็น JPG / โลโก้-ลายเซ็นเป็น PNG (คงความโปร่งใส) ไม่เกิน 4.5MB
    pe.ok.addEventListener('click', function () {
        if (!prep) return;
        pe.ok.disabled = true;
        var p = prep, c = p.crop, out = prepOutSize();
        function draw(w, h) {
            var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            var ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
            if (p.kind === 'background') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
            ctx.drawImage(p.img, c.x, c.y, c.w, c.h, 0, 0, w, h);
            if (p.removeBg) ctx.putImageData(prepRemove(ctx.getImageData(0, 0, w, h), p.bg, p.tol), 0, 0);
            return cv;
        }
        function blob(cv, type, q) { return new Promise(function (res) { cv.toBlob(res, type, q); }); }
        var job;
        if (p.kind === 'background') {
            var cv = draw(out.w, out.h), qs = [0.88, 0.8, 0.72, 0.62, 0.5];
            job = (function next(i) { return blob(cv, 'image/jpeg', qs[i]).then(function (b) { return (b.size <= PREP_BYTES || i === qs.length - 1) ? b : next(i + 1); }); })(0);
        } else {
            job = (function next(k, n) {
                return blob(draw(Math.max(1, Math.round(out.w * k)), Math.max(1, Math.round(out.h * k))), 'image/png').then(function (b) { return (b.size <= PREP_BYTES || n >= 5) ? b : next(k * 0.8, n + 1); });
            })(1, 0);
        }
        job.then(function (b) {
            var ext = p.kind === 'background' ? '.jpg' : '.png';
            var file = new File([b], p.name + ext, { type: b.type });
            prepFinish(file);
            bootstrap.Modal.getOrCreateInstance(pe.modal).hide();
        }).catch(function () { pe.ok.disabled = false; notify(t('prep_bad_image'), 'error'); });
    });

    // อัปโหลดฟอนต์ (หลายไฟล์ของตระกูลเดียวกันได้) → เพิ่มในรายการฟอนต์ ฝัง @font-face แล้วใช้กับข้อความที่เลือกอยู่
    function addFontFaces(key) {
        var f = CFG.fonts[key]; if (!f) return;
        var css = '';
        [['regular', 'normal', 'normal'], ['bold', 'bold', 'normal'], ['italic', 'normal', 'italic'], ['bolditalic', 'bold', 'italic']].forEach(function (v) {
            var url = f.urls[v[0]];
            css += "@font-face{font-family:'" + f.css + "';font-weight:" + v[1] + ';font-style:' + v[2] + ';src:url("' + url + '") format("' + (/\.otf$/i.test(url) ? 'opentype' : 'truetype') + '");font-display:block;}';
        });
        var tag = document.getElementById('cd-font-' + key) || document.head.appendChild(document.createElement('style'));
        tag.id = 'cd-font-' + key; tag.textContent = css;
    }
    el.fontFile.addEventListener('change', function () {
        var files = Array.prototype.slice.call(el.fontFile.files || []); if (!files.length) return;
        var target = state.sel && item(state.sel);
        var fd = new FormData(); fd.append('_token', CFG.csrf);
        files.slice(0, 4).forEach(function (f) { fd.append('files[]', f); });
        el.stage.classList.add('is-busy'); notify(t('font_uploading'), 'info');
        fetch(CFG.fontUploadUrl, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
            .then(function (j) {
                CFG.fonts = j.fonts;
                Object.keys(j.fonts).forEach(function (k) { if (j.fonts[k].custom) addFontFaces(k); });
                var f = CFG.fonts[j.key];
                var load = document.fonts && document.fonts.load ? Promise.all(['normal 400', 'normal 700', 'italic 400', 'italic 700'].map(function (s) { return document.fonts.load(s + " 20px '" + f.css + "'"); })).catch(function () {}) : Promise.resolve();
                return load.then(function () {
                    if (target && target.type === 'text') target.font = j.key;
                    renderItems(); renderProps(); if (target && target.type === 'text') commit();
                    notify(t('font_upload_done').replace(':name', f.label), 'success');
                });
            })
            .catch(function (err) {
                var msg = (err && err.message) || (err && err.errors && Object.values(err.errors)[0][0]) || t('font_upload_fail');
                notify(msg, 'error');
            })
            .finally(function () { el.stage.classList.remove('is-busy'); el.fontFile.value = ''; });
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
            cx: it.x + it.w / 2, cy: it.y + it.h / 2, moved: false, followers: [] };
        // ลากรูปลายเซ็น = ชื่อและตำแหน่งของชุดเลื่อนตาม (ลากข้อความเองยังขยับแยกได้)
        if (mode === 'move' && it.type === 'image' && signerSet(it)) {
            drag.followers = groupOf(it).filter(function (m) { return m !== it; }).map(function (m) { return { it: m, x: m.x, y: m.y }; });
        }
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
            drag.followers.forEach(function (f) { f.it.x = f.x + it.x - o.x; f.it.y = f.y + it.y - o.y; renderItem(f.it.id); });
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
        // ช่องลายเซ็น: ตรึงแกนกลางแนวนอน (ขยายออกสองข้างเท่ากัน) ให้ตรงกับชื่อ/ตำแหน่งที่จัดกึ่งกลางเสมอ
        var centerX = it.type === 'image' && it.key === 'signature' && !!it.group;
        var nw = o.w + (centerX ? 2 : 1) * sx * d.x, nh = o.h + sy * d.y;
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
        var ax = centerX ? 0 : -sx * o.w / 2, ay = -sy * o.h / 2;
        var aw = rot(ax, ay, o.r);
        var axW = drag.cx + aw.x, ayW = drag.cy + aw.y;
        var an = rot(centerX ? 0 : -sx * nw / 2, -sy * nh / 2, o.r);
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
            if (o.id === it.id || o.r || (it.group && o.group === it.group)) return;   // ชุดเดียวกันเลื่อนไปด้วยกัน ไม่ใช้เป็นเส้นจับ
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
    el.layers.addEventListener('click', function (e) {
        if (layerDrag && layerDrag.done) { layerDrag = null; return; }   // เพิ่งลากสลับเสร็จ - ไม่นับเป็นคลิก
        var l = e.target.closest('.cd-layer'); if (l) select(l.dataset.id);
    });

    // ลากเลเยอร์ขึ้น/ลงเพื่อสลับลำดับ (แบบ Photoshop): บนสุดของรายการ = อยู่หน้าสุดบนใบ
    var layerDrag = null;
    function layerRows() { return Array.prototype.slice.call(el.layers.querySelectorAll('.cd-layer')); }
    function layerDropIndex(clientY) {
        var rows = layerRows(), i;
        for (i = 0; i < rows.length; i++) {
            var r = rows[i].getBoundingClientRect();
            if (clientY < r.top + r.height / 2) return i;
        }
        return rows.length;
    }
    function layerMark(index) {
        var rows = layerRows(), line = el.layers.querySelector('.cd-layer-drop');
        if (!line) { line = document.createElement('div'); line.className = 'cd-layer-drop'; el.layers.appendChild(line); }
        var top = index < rows.length ? rows[index].offsetTop : (rows.length ? rows[rows.length - 1].offsetTop + rows[rows.length - 1].offsetHeight : 0);
        line.style.top = (top - 1) + 'px';
    }
    function layerAutoScroll() {
        if (!layerDrag || !layerDrag.active) return;
        var r = el.layers.getBoundingClientRect(), y = layerDrag.y, edge = 28, step = 0;
        if (y < r.top + edge) step = -Math.ceil((r.top + edge - y) / 3);
        else if (y > r.bottom - edge) step = Math.ceil((y - r.bottom + edge) / 3);
        if (step) { el.layers.scrollTop += step; layerDrag.index = layerDropIndex(y); layerMark(layerDrag.index); }
        layerDrag.raf = requestAnimationFrame(layerAutoScroll);
    }
    el.layers.addEventListener('pointerdown', function (e) {
        var row = e.target.closest('.cd-layer'); if (!row || e.button !== 0) return;
        layerDrag = { id: row.dataset.id, row: row, y0: e.clientY, y: e.clientY, active: false, done: false, pointer: e.pointerId };
    });
    el.layers.addEventListener('pointermove', function (e) {
        if (!layerDrag || layerDrag.done) return;
        layerDrag.y = e.clientY;
        if (!layerDrag.active) {
            if (Math.abs(e.clientY - layerDrag.y0) < 5) return;   // ขยับนิดเดียว = คลิกเลือก
            layerDrag.active = true;
            try { el.layers.setPointerCapture(layerDrag.pointer); } catch (err) { /* ลากต่อได้แม้จับ pointer ไม่ได้ */ }
            layerDrag.row.classList.add('is-dragging'); el.layers.classList.add('is-sorting');
            layerDrag.raf = requestAnimationFrame(layerAutoScroll);
        }
        e.preventDefault();
        layerDrag.index = layerDropIndex(e.clientY);
        layerMark(layerDrag.index);
    });
    function layerDrop() {
        if (!layerDrag) return;
        cancelAnimationFrame(layerDrag.raf);
        if (!layerDrag.active) { layerDrag = null; return; }
        layerDrag.done = true;   // กัน click ที่ตามมาหลังปล่อย
        el.layers.classList.remove('is-sorting');
        // ลำดับในรายการ (บน = หน้าสุด) → ย้ายแถว → กลับเป็นลำดับของผัง (ท้าย array = หน้าสุด)
        var view = state.layout.items.slice().reverse(), from = -1, i;
        for (i = 0; i < view.length; i++) if (view[i].id === layerDrag.id) from = i;
        var to = layerDrag.index > from ? layerDrag.index - 1 : layerDrag.index;
        if (from >= 0 && to !== from) {
            var moved = view.splice(from, 1)[0];
            view.splice(to, 0, moved);
            state.layout.items = view.reverse();
            state.sel = moved.id;
            renumber(); renderAll(); commit();
        } else {
            renderLayers();
        }
        setTimeout(function () { layerDrag = null; }, 0);
    }
    el.layers.addEventListener('pointerup', layerDrop);
    el.layers.addEventListener('pointercancel', layerDrop);

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
        if (moved) {
            e.preventDefault();
            // ขยับรูปลายเซ็นด้วยลูกศร = ชื่อและตำแหน่งของชุดขยับตาม
            if (it.type === 'image' && signerSet(it)) {
                var ddx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, ddy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                groupOf(it).forEach(function (m) { if (m !== it) { m.x += ddx; m.y += ddy; renderItem(m.id); } });
            }
            renderItem(it.id); renderSelection(); renderProps(); clearTimeout(propTimer); propTimer = setTimeout(commit, 300);
        }
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
        if (title && !title.value.trim()) { title.focus(); title.classList.add('is-invalid'); return; }
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
            if (el.previewDateInput) el.previewDateInput.value = el.previewDate ? el.previewDate.value : '';
            el.previewForm.submit();
        });
    });
    if (el.previewDate) el.previewDate.addEventListener('change', function () { renderItems(); renderLayers(); });

    // เริ่มใหม่จากใบเดิมของชุดนี้ → แทนผังบนจอ (ย้อนกลับได้ / มีผลเมื่อบันทึก)
    if ($('#cd-reimport')) $('#cd-reimport').addEventListener('click', function () {
        var btn = this;
        if (!window.confirm(t('reimport_confirm'))) return;
        var fd = new FormData(); fd.append('_token', CFG.csrf);
        btn.disabled = true; el.stage.classList.add('is-busy');
        fetch(CFG.reimportUrl, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
            .then(function (j) {
                state.layout = j.layout; state.sel = null;
                renumber(); renderAll(); commit();
                notify(t('reimport_done'), 'success');
            })
            .catch(function (err) { notify((err && err.message) || t('reimport_fail'), 'error'); })
            .finally(function () { btn.disabled = false; el.stage.classList.remove('is-busy'); });
    });
    if ($('#cd-title')) $('#cd-title').addEventListener('input', function () { this.classList.remove('is-invalid'); state.dirty = true; });
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
