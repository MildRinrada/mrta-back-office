/*
 * แก้ไขพร้อมกันแบบ real-time ในหลังบ้าน (ไฟล์เดียวกันทุกระบบ - ต้นฉบับ mrta-portal)
 * ค่าตั้งมาจาก includes/collab (window.MRTA_COLLAB) / เซิร์ฟเวอร์ = Laravel Reverb (protocol แบบ Pusher, pusher.min.js)
 *
 * หน้าแก้ไข (mode=edit)
 *   - แถบมุมขวาล่าง: รูปย่อของคนที่เปิดหน้านี้อยู่ + ข้อความ / แจ้งเมื่อมีคนเข้า-ออก
 *   - เคอร์เซอร์เมาส์ของอีกคน (มีชื่อ) / ช่องที่อีกคนกำลังแก้ (กรอบสี + "กำลังแก้" / "กำลังพิมพ์…")
 *     ส่งกันเองระหว่างเบราว์เซอร์ (client event) ไม่ผ่านเซิร์ฟเวอร์ Laravel
 *   - อีกคนบันทึก (event collab-saved จากเซิร์ฟเวอร์) = แจ้งทันที + กดบันทึกจะถามก่อนบันทึกทับ
 *   - ทุกฟอร์ม POST ได้ช่องซ่อน _collab_key / _collab_opened_at ให้ CollabGuard ตรวจบันทึกทับซ้ำฝั่งเซิร์ฟเวอร์
 *     (ฟอร์มที่ส่งด้วย form.submit() ตรง ๆ ไม่ผ่าน event submit - ฝั่งเซิร์ฟเวอร์ยังกันให้)
 * หน้ารายการ (mode=index) - แถวที่มีลิงก์ไปหน้าแก้ไขที่มีคนเปิดอยู่ ได้ป้ายสี "กำลังแก้"
 *
 * เชื่อมต่อไม่ได้ (Reverb ไม่ทำงาน) = ไม่มีแถบ/เคอร์เซอร์ หน้าทำงานปกติ
 */
(function () {
    'use strict';

    var C = window.MRTA_COLLAB;
    if (!C || !window.Pusher) return;

    var T = C.text || {};
    var me = C.me;
    var csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
    var others = {};          // id → member info (ไม่รวมตัวเอง)
    var savedBy = null;       // {name, at} มีคนบันทึกหลังจากเราเปิดหน้า
    var connected = false;

    function t(key, rep) {
        var s = T[key] || key;
        Object.keys(rep || {}).forEach(function (k) { s = s.split(':' + k).join(rep[k]); });
        return s;
    }
    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }
    function hhmm(ts) {
        var d = new Date(ts * 1000);
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    function toast(text, icon) {
        if (window.Swal) Swal.fire({ toast: true, position: 'top-end', icon: icon || 'info', titleText: text, showConfirmButton: false, timer: 3500 });
    }
    function throttle(fn, ms) {
        var last = 0, timer = null, args = null;
        return function () {
            args = arguments;
            var now = Date.now(), wait = ms - (now - last);
            if (wait <= 0) { last = now; fn.apply(null, args); }
            else if (!timer) timer = setTimeout(function () { timer = null; last = Date.now(); fn.apply(null, args); }, wait);
        };
    }

    /* ------------------------------------------------------------------
     |  เชื่อมต่อ
     | ------------------------------------------------------------------ */
    var pusher = new Pusher(C.ws.key, {
        cluster: 'mt1',
        wsHost: C.ws.host,
        wsPort: C.ws.port,
        wssPort: C.ws.port,
        forceTLS: !!C.ws.tls,
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
        channelAuthorization: {
            customHandler: function (params, callback) {
                var body = new URLSearchParams();
                body.append('socket_id', params.socketId);
                body.append('channel_name', params.channelName);
                if (params.channelName === C.channel) body.append('key', C.key);
                if (params.channelName === C.index) body.append('path', C.mode === 'edit' ? C.path : '');
                fetch(C.authUrl, {
                    method: 'POST', body: body, credentials: 'same-origin',
                    headers: { 'X-CSRF-TOKEN': csrf, 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
                }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
                  .then(function (data) { callback(null, data); })
                  .catch(function (err) { callback(err, null); });
            }
        }
    });
    // ออกจากหน้า = ตัดการเชื่อมต่อเอง (เบราว์เซอร์อาจเก็บหน้าไว้ใน back/forward cache โดยยังไม่ปิด socket - คนอื่นจะเห็นเราค้างอยู่)
    window.addEventListener('pagehide', function () { try { pusher.disconnect(); } catch (e) {} });
    window.addEventListener('pageshow', function (e) { if (e.persisted) { try { pusher.connect(); } catch (err) {} } });

    pusher.connection.bind('state_change', function (s) {
        connected = s.current === 'connected';
        if (bar) bar.classList.toggle('is-offline', !connected && s.current !== 'connecting' && s.current !== 'initialized');
    });

    /* ------------------------------------------------------------------
     |  หน้ารายการ + ช่องรวมของระบบ: ป้าย "กำลังแก้" ที่แถว
     | ------------------------------------------------------------------ */
    var indexMembers = {};
    var index = pusher.subscribe(C.index);

    function markRows() {
        document.querySelectorAll('.collab-row-badge').forEach(function (b) { b.remove(); });
        document.querySelectorAll('.collab-row-busy').forEach(function (r) { r.classList.remove('collab-row-busy'); r.style.removeProperty('--collab-color'); });
        if (C.mode !== 'index') return;
        Object.keys(indexMembers).forEach(function (id) {
            var m = indexMembers[id];
            if (!m.path || String(id) === String(me.id)) return;
            document.querySelectorAll('a[href]').forEach(function (a) {
                var u;
                try { u = new URL(a.href, location.href); } catch (e) { return; }
                if (u.origin !== location.origin || u.pathname !== m.path) return;
                var row = a.closest('tr, li, .card') || a.parentElement;
                if (!row || row.querySelector('.collab-row-badge[data-id="' + id + '"]')) return;
                row.classList.add('collab-row-busy');
                row.style.setProperty('--collab-color', m.color);
                var badge = el('span', 'collab-row-badge');
                badge.dataset.id = id;
                badge.style.setProperty('--collab-color', m.color);
                badge.title = t('row_editing', { name: m.name });
                badge.appendChild(el('span', 'collab-dot', m.initials));
                badge.appendChild(el('span', 'collab-row-text', T.editing));
                (a.closest('td') || a.parentElement).appendChild(badge);
            });
        });
    }
    var markRowsSoon = throttle(markRows, 300);
    index.bind('pusher:subscription_succeeded', function (members) {
        indexMembers = {};
        members.each(function (m) { indexMembers[m.id] = m.info; });
        markRowsSoon();
    });
    index.bind('pusher:member_added', function (m) { indexMembers[m.id] = m.info; markRowsSoon(); });
    index.bind('pusher:member_removed', function (m) { delete indexMembers[m.id]; markRowsSoon(); });
    if (C.mode === 'index') {
        // ตารางที่โหลดทีหลัง (DataTables / ajax) - ติดป้ายใหม่เมื่อเนื้อหาเปลี่ยน
        new MutationObserver(function (list) {
            if (list.some(function (m) { return [].some.call(m.addedNodes, function (n) { return n.nodeType === 1 && !n.classList.contains('collab-row-badge'); }); })) markRowsSoon();
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (C.mode !== 'edit') return;

    /* ------------------------------------------------------------------
     |  หน้าแก้ไข: แถบผู้ใช้ร่วม
     | ------------------------------------------------------------------ */
    var bar = el('div', 'collab-bar');
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    var avatars = el('div', 'collab-avatars');
    var label = el('div', 'collab-label');
    var savedBox = el('div', 'collab-saved');
    bar.appendChild(avatars);
    bar.appendChild(label);
    bar.appendChild(savedBox);
    bar.title = T.offline;
    document.body.appendChild(bar);

    function renderBar() {
        var list = Object.keys(others).map(function (id) { return others[id]; });
        avatars.innerHTML = '';
        list.slice(0, 5).forEach(function (m) {
            var a = el('span', 'collab-dot', m.initials);
            a.style.setProperty('--collab-color', m.color);
            a.title = m.name;
            avatars.appendChild(a);
        });
        label.textContent = !list.length ? T.alone
            : list.length === 1 ? t('here_one', { name: list[0].name })
            : t('here_many', { name: list[0].name, n: list.length - 1 });
        bar.classList.toggle('has-others', list.length > 0);
        bar.classList.add('is-ready');
    }

    function showSaved() {
        savedBox.innerHTML = '';
        if (!savedBy) return;
        savedBox.appendChild(el('span', '', t('saved_banner', { name: savedBy.name, time: hhmm(savedBy.at) }) + ' '));
        var reload = el('button', 'collab-link', T.reload);
        reload.type = 'button';
        reload.addEventListener('click', function () { location.reload(); });
        savedBox.appendChild(reload);
        bar.classList.add('has-saved');
    }

    /* ------------------------------------------------------------------
     |  ช่องของหน้า: สมาชิก / เคอร์เซอร์ / ช่องที่กำลังแก้ / บันทึกแล้ว
     | ------------------------------------------------------------------ */
    var channel = pusher.subscribe(C.channel);
    var ready = false;

    channel.bind('pusher:subscription_succeeded', function (members) {
        others = {};
        members.each(function (m) { if (String(m.id) !== String(me.id)) others[m.id] = m.info; });
        ready = true;
        renderBar();
        // เข้ามาทีหลัง: บอกคนที่อยู่ก่อนว่าเรากำลังอยู่ช่องไหน (ถ้ามี)
        if (document.activeElement) sendFocus(document.activeElement);
    });
    channel.bind('pusher:subscription_error', function () { bar.classList.add('is-offline'); });
    channel.bind('pusher:member_added', function (m) {
        if (String(m.id) === String(me.id)) return;
        others[m.id] = m.info;
        renderBar();
        toast(t('joined', { name: m.info.name }), 'info');
        if (document.activeElement) sendFocus(document.activeElement);
    });
    channel.bind('pusher:member_removed', function (m) {
        if (String(m.id) === String(me.id)) return;
        var name = others[m.id] ? others[m.id].name : '';
        delete others[m.id];
        removeCursor(m.id);
        clearFocus(m.id);
        renderBar();
        if (name) toast(t('left', { name: name }), 'info');
    });
    channel.bind('collab-saved', function (data) {
        if (!data || String(data.user_id) === String(me.id)) return;
        savedBy = data;
        showSaved();
        toast(t('saved_banner', { name: data.name, time: hhmm(data.at) }), 'warning');
    });

    function send(event, data) {
        if (ready && connected && Object.keys(others).length) {
            try { channel.trigger(event, data); } catch (e) { /* ช่องยังไม่พร้อม */ }
        }
    }
    function who(meta) {
        // ชื่อ/สีของผู้ส่งมาจากข้อมูลที่เซิร์ฟเวอร์ลงนาม (members) ไม่ใช่จากข้อความ - ปลอมเป็นคนอื่นไม่ได้
        return meta && others[meta.user_id] ? { id: meta.user_id, info: others[meta.user_id] } : null;
    }

    /* ---- เคอร์เซอร์: ตำแหน่งเทียบกับพื้นที่เนื้อหา (กว้างเป็นสัดส่วน / สูงเป็น px) จอคนละขนาดก็ใกล้เคียง ---- */
    function anchor() {
        return document.querySelector('.main .card') || document.querySelector('.main') || document.querySelector('main') || document.body;
    }
    var cursors = {};

    document.addEventListener('mousemove', throttle(function (e) {
        var r = anchor().getBoundingClientRect();
        send('client-cursor', { x: (e.clientX - r.left) / Math.max(r.width, 1), y: e.clientY - r.top });
    }, 60), { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { send('client-cursor-hide', {}); });
    window.addEventListener('blur', function () { send('client-cursor-hide', {}); });

    channel.bind('client-cursor', function (data, meta) {
        var w = who(meta);
        if (!w || typeof data.x !== 'number' || typeof data.y !== 'number') return;
        var c = cursors[w.id];
        if (!c) {
            c = cursors[w.id] = el('div', 'collab-cursor');
            c.style.setProperty('--collab-color', w.info.color);
            c.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 1l13 7-6 1.5L6.5 16z" fill="currentColor" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>';
            c.appendChild(el('span', 'collab-cursor-name', w.info.name));
            document.body.appendChild(c);
        }
        c._pos = data;
        placeCursor(c);
        c.classList.add('is-on');
        clearTimeout(c._hide);
        c._hide = setTimeout(function () { c.classList.remove('is-on'); }, 6000);
    });
    channel.bind('client-cursor-hide', function (data, meta) {
        var w = who(meta);
        if (w && cursors[w.id]) cursors[w.id].classList.remove('is-on');
    });
    // ตำแหน่งบนจอ (position: fixed) คำนวณจากพื้นที่เนื้อหาตอนนี้ - หน้าเลื่อน (ทั้งหน้าต่างหรือกล่องด้านใน) แล้ววางใหม่ได้
    function placeCursor(c) {
        if (!c._pos) return;
        var r = anchor().getBoundingClientRect();
        c.style.left = (r.left + c._pos.x * r.width) + 'px';
        c.style.top = (r.top + c._pos.y) + 'px';
    }
    function removeCursor(id) {
        if (cursors[id]) { cursors[id].remove(); delete cursors[id]; }
    }

    /* ---- ช่องที่กำลังแก้ ---- */
    function fieldRef(target) {
        if (!target || !target.closest) return null;
        var f = target.closest('input, select, textarea, [contenteditable="true"]');
        if (!f || f.type === 'hidden' || f.type === 'password') return null;
        if (f.id) return { id: f.id };
        if (f.name) return { name: f.name, i: [].indexOf.call(document.getElementsByName(f.name), f) };
        return null;
    }
    function findField(ref) {
        if (!ref) return null;
        var f = ref.id ? document.getElementById(String(ref.id)) : (document.getElementsByName(String(ref.name || ''))[ref.i | 0] || null);
        if (!f) return null;
        // ช่องที่ซ่อนอยู่หลังตัวแก้ไข (TinyMCE / select ที่แปลงแล้ว) - ชี้กล่องที่มองเห็นแทน
        if (!f.offsetParent) {
            var sib = f.nextElementSibling;
            if (sib && sib.offsetParent) return sib;
            return f.closest('.form-group, .mb-3, .col-12, div');
        }
        return f;
    }
    var focusMarks = {};
    function clearFocus(id) {
        var m = focusMarks[id];
        if (!m) return;
        m.field.classList.remove('collab-field');
        m.field.style.removeProperty('--collab-color');
        m.tag.remove();
        delete focusMarks[id];
    }
    function placeTag(m) {
        // ตำแหน่งบนจอ (position: fixed) - หน้าหลังบ้านเลื่อนในกล่องเนื้อหาด้านใน ไม่ใช่หน้าต่าง จึงอิงตำแหน่งช่องบนจอตอนนี้เสมอ
        var r = m.field.getBoundingClientRect();
        m.tag.style.left = r.left + 'px';
        m.tag.style.top = (r.top - 22) + 'px';
        m.tag.style.visibility = r.bottom < 0 || r.top > window.innerHeight ? 'hidden' : '';
    }
    function sendFocus(target) {
        var ref = fieldRef(target);
        if (ref) send('client-focus', { field: ref });
    }

    document.addEventListener('focusin', function (e) { sendFocus(e.target); });
    document.addEventListener('focusout', function (e) { if (fieldRef(e.target)) send('client-blur', {}); });
    document.addEventListener('input', throttle(function (e) {
        var ref = fieldRef(e.target);
        if (ref) send('client-typing', { field: ref });
    }, 800));
    // TinyMCE อยู่ใน iframe - focus/พิมพ์ในตัวแก้ไขไม่ถึง document นี้
    if (window.tinymce && tinymce.on) {
        var hook = function (ed) {
            ed.on('focus', function () { send('client-focus', { field: { id: ed.id } }); });
            ed.on('blur', function () { send('client-blur', {}); });
            ed.on('input', throttle(function () { send('client-typing', { field: { id: ed.id } }); }, 800));
        };
        (tinymce.get ? tinymce.get() : []).forEach(hook);
        tinymce.on('AddEditor', function (e) { hook(e.editor); });
    }

    function markField(meta, ref, typing) {
        var w = who(meta);
        if (!w) return;
        var field = findField(ref);
        var cur = focusMarks[w.id];
        if (cur && cur.field !== field) clearFocus(w.id);
        if (!field) return;
        var m = focusMarks[w.id];
        if (!m) {
            m = focusMarks[w.id] = { field: field, tag: el('div', 'collab-tag') };
            field.classList.add('collab-field');
            field.style.setProperty('--collab-color', w.info.color);
            m.tag.style.setProperty('--collab-color', w.info.color);
            document.body.appendChild(m.tag);
        }
        m.tag.textContent = w.info.name + ' · ' + (typing ? T.typing : T.editing);
        placeTag(m);
        clearTimeout(m.typingTimer);
        if (typing) m.typingTimer = setTimeout(function () { if (focusMarks[w.id]) m.tag.textContent = w.info.name + ' · ' + T.editing; }, 2500);
    }
    channel.bind('client-focus', function (data, meta) { markField(meta, data && data.field, false); });
    channel.bind('client-typing', function (data, meta) { markField(meta, data && data.field, true); });
    channel.bind('client-blur', function (data, meta) { var w = who(meta); if (w) clearFocus(w.id); });
    var relayout = function () {
        Object.keys(focusMarks).forEach(function (id) { placeTag(focusMarks[id]); });
        Object.keys(cursors).forEach(function (id) { placeCursor(cursors[id]); });
    };
    // capture = ได้ทุกการเลื่อน รวมกล่องด้านในที่เลื่อนเอง (event scroll ไม่ bubble)
    document.addEventListener('scroll', function () { requestAnimationFrame(relayout); }, { passive: true, capture: true });
    window.addEventListener('resize', relayout);
    // เลย์เอาต์เปลี่ยนเอง (เปิด/ปิดส่วน, รูปโหลด, แถวเพิ่ม) - วางป้ายใหม่เป็นระยะ
    setInterval(function () { if (Object.keys(focusMarks).length) relayout(); }, 1000);

    /* ------------------------------------------------------------------
     |  กันบันทึกทับ
     | ------------------------------------------------------------------ */
    function stamp(form) {
        if ((form.getAttribute('method') || 'get').toLowerCase() !== 'post') return;
        // ฟอร์มออกจากระบบ ไม่ใช่การบันทึกหน้านี้ - ห้ามติดช่องซ่อน (ไม่งั้นมีคนบันทึกก่อน = ออกจากระบบไม่ได้)
        if (form.id === 'logout_form' || /\/logout(\?|$)/.test(form.getAttribute('action') || '')) return;
        [['_collab_key', C.key], ['_collab_opened_at', C.openedAt]].forEach(function (pair) {
            if (form.querySelector('input[name="' + pair[0] + '"]')) return;
            var i = document.createElement('input');
            i.type = 'hidden';
            i.name = pair[0];
            i.value = pair[1];
            form.appendChild(i);
        });
    }
    function stampAll() { document.querySelectorAll('form').forEach(stamp); }
    stampAll();
    new MutationObserver(throttle(stampAll, 500)).observe(document.body, { childList: true, subtree: true });

    function resubmit(form, submitter, force) {
        if (force) {
            var f = form.querySelector('input[name="_collab_force"]') || form.appendChild(Object.assign(document.createElement('input'), { type: 'hidden', name: '_collab_force' }));
            f.value = '1';
        }
        form._collabOk = true;
        if (form.requestSubmit) form.requestSubmit(submitter && submitter.form === form ? submitter : undefined);
        else form.submit();
    }
    function askOverwrite(form, submitter, by) {
        if (!window.Swal) { if (confirm(t('conflict_text', { name: by.name, time: hhmm(by.at) }))) resubmit(form, submitter, true); return; }
        Swal.fire({
            icon: 'warning',
            titleText: T.conflict_title,
            text: t('conflict_text', { name: by.name, time: hhmm(by.at) }),
            showCancelButton: true, showDenyButton: true,
            confirmButtonText: T.overwrite, denyButtonText: T.reload, cancelButtonText: T.cancel,
            confirmButtonColor: '#d33', denyButtonColor: 'var(--pri, #4e73df)', reverseButtons: true,
        }).then(function (r) {
            if (r.isConfirmed) resubmit(form, submitter, true);
            else if (r.isDenied) location.reload();
        });
    }
    // จับก่อน handler อื่นของหน้า (capture) - ถ้ารู้แล้วว่ามีคนบันทึกก่อน ถามก่อนส่ง / เชื่อมต่อไม่ได้ = ถามเซิร์ฟเวอร์สั้น ๆ
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || form._collabOk || !form.querySelector('input[name="_collab_key"]')) return;
        if (savedBy) {
            e.preventDefault();
            e.stopImmediatePropagation();
            askOverwrite(form, e.submitter, savedBy);
            return;
        }
        if (connected) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        var body = new URLSearchParams({ key: C.key, opened_at: C.openedAt });
        fetch(C.checkUrl, { method: 'POST', body: body, credentials: 'same-origin', headers: { 'X-CSRF-TOKEN': csrf, 'Accept': 'application/json' } })
            .then(function (r) { return r.ok ? r.json() : { conflict: false }; })
            .catch(function () { return { conflict: false }; })
            .then(function (res) {
                if (res.conflict) { savedBy = { name: res.by, at: res.at }; askOverwrite(form, e.submitter, savedBy); }
                else resubmit(form, e.submitter, false);
            });
    }, true);
    // ส่งสำเร็จแล้วถูกปฏิเสธจากเซิร์ฟเวอร์ (CollabGuard) - แจ้งตอนหน้าโหลดกลับมา
    if (C.conflict && window.Swal) {
        Swal.fire({ icon: 'warning', titleText: T.conflict_title, text: C.conflict.message || '', confirmButtonText: 'OK' });
    }
})();
