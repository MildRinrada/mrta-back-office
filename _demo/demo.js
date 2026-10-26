/*
 * เวอร์ชันทดลองหลังบ้าน MRTA (เว็บ static) - จำลองฝั่งเซิร์ฟเวอร์ในเบราว์เซอร์
 *
 *  - AJAX / fetch ไป path ของระบบ → อ่านไฟล์ข้อมูลที่เก็บไว้ (/_data) / ตาราง DataTables แบ่งหน้า ค้นหา เรียงในเบราว์เซอร์
 *  - บันทึก / แก้ไข / ลบ / เปลี่ยนสถานะ → ตอบว่าสำเร็จ (ไม่บันทึกจริง) แล้วพากลับหน้ารายการ
 *  - ลิงก์ไปหน้าที่ไม่มีในเวอร์ชันทดลอง (หน้าบ้าน ส่งออกไฟล์ ฯลฯ) → แจ้งเตือนแทนการเปิดหน้าเปล่า
 *
 * ต้องโหลดก่อนสคริปต์อื่นของหน้า (build.py ใส่ไว้ต้น <head>) พร้อม pages.js + idx-<ระบบ>.js
 */
(function () {
    'use strict';

    var D = window.__DEMO || {};
    var SYS = D.sys || 'portal';
    var SYSTEMS = ['auth', 'belib', 'booking', 'knowledge', 'learnext', 'news', 'portal'];
    var IDX = window.__DEMO_IDX || {};
    var PAGES = window.__DEMO_PAGES || {};
    var REDIR = window.__DEMO_REDIR || {};
    var HOME = '/portal/admin';

    var MSG_SAVED = 'บันทึกเรียบร้อย (เวอร์ชันทดลอง: ข้อมูลไม่ถูกบันทึกจริง)';
    var MSG_LOGOUT = 'เวอร์ชันทดลองไม่มีการออกจากระบบ';
    var MSG_NA = 'หน้านี้ไม่มีในเวอร์ชันทดลอง';
    var MSG_FRONT = 'เวอร์ชันทดลองนี้มีเฉพาะหลังบ้าน';
    var MSG_FILE = 'การส่งออก/ดาวน์โหลดไฟล์ใช้ได้ในระบบจริง';
    var MSG_FILTER = 'เวอร์ชันทดลองแสดงข้อมูลตัวอย่างชุดเดิม';
    var NA_HTML = '<div class="demo-na">ส่วนนี้ไม่มีข้อมูลในเวอร์ชันทดลอง</div>';

    var FILE_EXT = /\.(pdf|xlsx?|docx?|pptx?|zip|csv|epub|mp4|mp3|rar)$/i;
    var UPLOAD = /(upload|image|img|photo|file|media|attach)/i;

    function sysOf(path) {
        var s = path.split('/')[1];
        return SYSTEMS.indexOf(s) >= 0 ? s : null;
    }

    function hasExt(p) {
        return /\.[a-z0-9]{2,5}$/i.test(p);
    }

    /** URL → path ในเว็บทดลอง (/<ระบบ>/...) | null = เว็บอื่น */
    function toLocal(url) {
        var u;
        try {
            u = new URL(url, location.href);
        } catch (e) {
            return null;
        }
        if (u.origin !== location.origin) return null;
        var p = u.pathname.replace(/\/+$/, '') || '/';
        try {
            p = decodeURI(p);
        } catch (e) { /* ใช้ตามเดิม */ }
        if (/^\/_(demo|data|shared)\//.test(p)) return { path: p, url: u, own: true };
        // path จาก JS ของระบบที่ไม่มีชื่อระบบนำหน้า เช่น fetch('/admin/pii/reveal')
        if (p !== '/' && !sysOf(p)) p = '/' + SYS + p;
        return { path: p, url: u };
    }

    // learnext แก้ไขรายวิชา: /edit/{id}/step/{ขั้น}/{แท็บ} ใช้หน้าเดียวกับ /edit/{id} (rewrite ใน vercel.json)
    var COURSE_STEP = /^(\/learnext\/admin\/course\/edit\/\d+)\/step\/([^/]+)(?:\/([^/]+))?$/;

    function isPage(p) {
        var m = p.match(COURSE_STEP);
        return !!(PAGES[p] || REDIR[p] || (m && PAGES[m[1]]));
    }

    // เปิดส่วนตาม URL (หน้าเปิดรายการแรกเองตอนโหลด แล้วเปลี่ยน URL ไปแล้ว จึงจำค่าไว้ตั้งแต่ตอนนี้)
    var stepFromUrl = location.pathname.match(COURSE_STEP);
    if (stepFromUrl) {
        window.addEventListener('load', function () {
            var el = document.querySelector('.lxc-item[data-step="' + stepFromUrl[2] + '"][data-tab="' + (stepFromUrl[3] || '1') + '"]:not(.is-disabled)');
            if (!el || el.classList.contains('is-active') || typeof window.lxcGo !== 'function') return;
            var go = function () { window.lxcGo(el, true); };
            // รอส่วนแรกที่หน้าเปิดเองโหลดเสร็จก่อน ไม่งั้นผลที่มาทีหลังทับส่วนที่ต้องการ
            var $ = window.jQuery;
            if ($ && $.active > 0) $(document).one('ajaxStop', function () { setTimeout(go, 0); });
            else go();
        });
    }

    // ---- พารามิเตอร์ของคำขอ (query + body)
    function params(u, body) {
        var o = {};
        if (u) u.searchParams.forEach(function (v, k) { o[k] = v; });
        if (!body) return o;
        try {
            if (typeof body === 'string') {
                if (/^\s*[{[]/.test(body)) {
                    flat(JSON.parse(body), '', o);
                } else {
                    new URLSearchParams(body).forEach(function (v, k) { o[k] = v; });
                }
            } else if (body instanceof URLSearchParams || (window.FormData && body instanceof FormData)) {
                body.forEach(function (v, k) { if (typeof v === 'string') o[k] = v; });
            }
        } catch (e) { /* ไม่มีพารามิเตอร์ */ }
        return o;
    }

    function flat(v, prefix, o) {
        if (v && typeof v === 'object') {
            Object.keys(v).forEach(function (k) { flat(v[k], prefix ? prefix + '[' + k + ']' : k, o); });
        } else if (prefix) {
            o[prefix] = v == null ? '' : String(v);
        }
    }

    // ---- หาว่าคำขอนี้ตอบอะไร
    function resolve(method, url, body, accept) {
        var loc = toLocal(url);
        if (!loc || loc.own) return null;
        var p = loc.path;
        var s = sysOf(p);
        if (!s) return null;
        if (method === 'GET' && hasExt(p)) return null; // ไฟล์ static
        var rest = p.slice(s.length + 1) || '/';
        var q = params(loc.url, body);
        if (/\/pii\/reveal$/.test(rest)) return { kind: 'pii', q: q };
        var idx = s === SYS ? IDX : {};
        var e = (method === 'GET' && idx['XHR ' + rest]) || idx[method + ' ' + rest]
            || idx[method + ' ' + rest.replace(/\/\d{10,}$/, '')]; // ตัวกันแคช (timestamp) ท้าย URL
        if (e) return { kind: e.dt ? 'dt' : 'file', file: e.f, ct: e.t, q: q };
        if (method === 'GET' && PAGES[p]) return { kind: 'file', file: p, ct: 'text/html', q: q };
        // คำขอที่ไม่มีข้อมูลเก็บไว้ - check_site.py อ่านไปให้ capture.php เก็บเพิ่ม
        (window.__demoMisses = window.__demoMisses || []).push({ s: s, m: method, p: rest, q: q });
        // ผู้เรียกรอ HTML ($.load / ฟอร์มย่อย / modal / preview) → ข้อความแจ้ง ไม่ใช่ JSON ที่จะโผล่เป็นตัวหนังสือบนหน้า
        var a = String(accept || '');
        if (/^text\/html/i.test(a) || (!/json/i.test(a) && (method === 'GET' ? /\/(load|form|modal|preview|render|partial)(\/|$|-)|load-modal/i : /\/preview(\/|$)/i).test(rest))) {
            return { kind: 'na-html' };
        }
        return { kind: method === 'GET' ? 'empty' : 'ok', path: p, q: q };
    }

    // ---- DataTables: ค้นหา / เรียง / แบ่งหน้า จากข้อมูลทั้งหมดที่เก็บไว้
    function cellText(v) {
        if (v == null) return '';
        if (typeof v === 'object') return Object.keys(v).map(function (k) { return cellText(v[k]); }).join(' ');
        return String(v).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    }

    function getPath(r, key) {
        if (Array.isArray(r)) return r[+key];
        return String(key).split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, r);
    }

    var firstOrder = {}; // การเรียงตอนตารางโหลดครั้งแรก = ลำดับจากเซิร์ฟเวอร์อยู่แล้ว (เรียงข้อความวันที่ไทยเองจะเพี้ยน)

    function dtTransform(text, q, key) {
        var j;
        try {
            j = JSON.parse(text);
        } catch (e) {
            return text;
        }
        if (!q.draw || !j || !Array.isArray(j.data)) return text;
        var rows = j.data;
        var total = rows.length;
        // ช่องค้นหาของ DataTables หรือช่องค้นหาของหน้าเองที่ส่งเป็นพารามิเตอร์แยก (q / keyword ...)
        var term = String(q['search[value]'] || q.q || q.keyword || q.keywords || q.txt_search || q.search_text
            || (typeof q.search === 'string' ? q.search : '') || '').toLowerCase().trim();
        if (term) {
            rows = rows.filter(function (r) { return cellText(r).toLowerCase().indexOf(term) >= 0; });
        }
        var oc = q['order[0][column]'];
        var ord = oc + ':' + q['order[0][dir]'];
        if (!(key in firstOrder)) firstOrder[key] = ord;
        if (ord !== firstOrder[key] && oc != null && oc !== '' && q['columns[' + oc + '][orderable]'] !== 'false') {
            var key = q['columns[' + oc + '][data]'];
            if (key == null || key === '') key = oc;
            if (key !== 'DT_RowIndex') {
                var desc = q['order[0][dir]'] === 'desc';
                var val = function (r) { return cellText(getPath(r, key)).trim(); };
                var num = /^-?[\d,]+(\.\d+)?$/;
                rows = rows.slice().sort(function (a, b) {
                    var x = val(a), y = val(b);
                    var c = num.test(x) && num.test(y)
                        ? parseFloat(x.replace(/,/g, '')) - parseFloat(y.replace(/,/g, ''))
                        : x.localeCompare(y, 'th');
                    return desc ? -c : c;
                });
            }
        }
        var filtered = rows.length;
        var start = parseInt(q.start, 10) || 0;
        var len = parseInt(q.length, 10);
        if (len > 0) rows = rows.slice(start, start + len);
        rows = rows.map(function (r, i) {
            if (r && typeof r === 'object' && !Array.isArray(r) && 'DT_RowIndex' in r) {
                r = Object.assign({}, r, { DT_RowIndex: start + i + 1 });
            }
            return r;
        });
        j.draw = parseInt(q.draw, 10) || 1;
        j.recordsTotal = total;
        j.recordsFiltered = filtered;
        j.data = rows;
        return JSON.stringify(j);
    }

    // ---- ผลการบันทึก: รูปแบบที่สคริปต์ของหน้านั้นเช็ก ('success' หรือ 200)
    var inlineJs = null;

    function okStyle(p) {
        if (inlineJs === null) {
            inlineJs = Array.prototype.map.call(document.scripts, function (s) { return s.src ? '' : s.textContent; }).join('\n');
        }
        var count = function (t) {
            return [
                (t.match(/\.status\s*[!=]==?\s*["']success["']/g) || []).length,
                (t.match(/\.status\s*[!=]==?\s*["']?20[01]\b/g) || []).length,
            ];
        };
        var rest = p.replace(/^\/[^/]+/, '');
        var i = rest.length > 1 ? inlineJs.indexOf(rest) : -1;
        var c = i >= 0 ? count(inlineJs.substr(i, 3000)) : [0, 0];
        if (c[0] === c[1]) c = count(inlineJs);
        if (c[0] > c[1]) return 'success';
        if (c[1] > c[0]) return 200;
        return D.okStyle || 200;
    }

    var FORM_SEG = /\/(create|edit|add|new)(\/|$)/;
    var ID_SEG = /\/(\d+|[0-9a-f]{8,}|[0-9a-f-]{36})$/i;

    /** หน้าที่ควรกลับไปหลังบันทึก: หน้าฟอร์ม (create/edit) → หน้ารายการที่อยู่เหนือขึ้นไป / หน้าอื่นอยู่ที่เดิม */
    function backTarget(path) {
        path = path.replace(/\/+$/, '') || '/';
        if (!FORM_SEG.test(path)) return isPage(path) ? path : HOME;
        // มาจากหน้ารายการไหนก็กลับหน้านั้น
        var ref = document.referrer ? toLocal(document.referrer) : null;
        if (ref && !ref.own && ref.path !== path && PAGES[ref.path] && !FORM_SEG.test(ref.path)) return ref.path;
        var segs = path.split('/');
        var any = null;
        while (segs.length > 3) {
            segs.pop();
            var base = segs.join('/');
            var cands = [base, base + '/list', base + 's', base + '/index', base + '/all'];
            for (var i = 0; i < cands.length; i++) {
                var c = cands[i];
                if (!PAGES[c]) continue;
                if (!any) any = c;
                if (!FORM_SEG.test(c) && !ID_SEG.test(c)) return c;
            }
        }
        return any || (isPage('/' + SYS + '/admin') ? '/' + SYS + '/admin' : HOME);
    }

    function okBody(r, method) {
        var back = backTarget(location.pathname);
        var msg = method === 'GET' ? '' : MSG_SAVED;
        var q = r.q || {};
        // ชื่อ key ที่สคริปต์หลังบ้านทั้ง 7 ระบบอ่าน (notify_* มากสุด รองลงมา msg / message)
        var o = {
            success: true, result: true, ok: true, code: 200, demo: true,
            message: msg, msg: msg, text: msg, notify_msg: msg, notify_type: 'success', notify_icon: 'success',
            notify_title: 'สำเร็จ', type: 'success', icon: 'success',
            id: 90000 + Math.floor(Math.random() * 9999), title: q.title || q.name || '',
            data: [], redirect: back, redirect_url: back, url: back,
        };
        o.status = okStyle(r.path || '') === 'success' ? 'success' : 200;
        if (method !== 'GET' && UPLOAD.test(r.path || '')) {
            o.url = o.location = o.path = o.file = o.link = '/_demo/placeholder.svg';
        }
        if (r.q && r.q.draw) {
            o.draw = parseInt(r.q.draw, 10) || 1;
            o.recordsTotal = 0;
            o.recordsFiltered = 0;
        }
        return JSON.stringify(o);
    }

    function b64utf8(s) {
        try {
            return decodeURIComponent(Array.prototype.map.call(atob(s), function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
        } catch (e) {
            return '';
        }
    }

    var realFetch = window.fetch ? window.fetch.bind(window) : null;

    function getText(url) {
        if (realFetch) return realFetch(url, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; });
        return new Promise(function (ok) {
            var x = new XMLHttpRequest();
            x.__demoSkip = true;
            x.open('GET', url, true);
            x.onload = function () { ok(x.status < 400 ? x.responseText : ''); };
            x.onerror = function () { ok(''); };
            x.send();
        });
    }

    var JSON_CT = 'application/json; charset=utf-8';

    /** ผลของคำขอ → Promise<{text, ct}> */
    function produce(r, method) {
        var delay = function (v) { return new Promise(function (ok) { setTimeout(function () { ok(v); }, 120); }); };
        if (r.kind === 'na-html') return delay({ text: NA_HTML, ct: 'text/html; charset=utf-8' });
        if (r.kind === 'pii') {
            var t = String(r.q.token || '');
            return delay({ text: JSON.stringify({ value: t.indexOf('demo:') === 0 ? b64utf8(t.slice(5)) : '-' }), ct: JSON_CT });
        }
        if (r.kind === 'file' || r.kind === 'dt') {
            return getText(r.file).then(function (text) {
                if (r.kind === 'dt') text = dtTransform(text, r.q, r.file);
                return { text: text, ct: r.ct === 'json' ? JSON_CT : (r.ct === 'html' ? 'text/html; charset=utf-8' : (r.ct || JSON_CT)) };
            });
        }
        return delay({ text: okBody(r, method), ct: JSON_CT });
    }

    // ---- fetch
    if (realFetch) {
        window.fetch = function (input, init) {
            var url = typeof input === 'string' ? input : (input && input.url) || String(input);
            var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
            var hd = (init && init.headers) || (input && input.headers) || {};
            var accept = typeof hd.get === 'function' ? hd.get('Accept') : (hd.Accept || hd.accept);
            var r = resolve(method, url, init && init.body, accept);
            if (!r) return realFetch(input, init);
            return produce(r, method).then(function (res) {
                return new Response(res.text, { status: 200, headers: { 'Content-Type': res.ct } });
            });
        };
    }

    // ---- XMLHttpRequest (jQuery / DataTables / axios): ยิงคำขอจริงไปไฟล์เปล่าให้ event ครบตามปกติ แล้วแทนค่าที่อ่านได้
    var XP = XMLHttpRequest.prototype;
    var xOpen = XP.open;
    var xSend = XP.send;
    var xSetHeader = XP.setRequestHeader;
    XP.setRequestHeader = function (name, value) {
        if (this.__demo && /^accept$/i.test(name)) this.__demo.accept = String(value);
        return xSetHeader.apply(this, arguments);
    };
    XP.open = function (method, url, async) {
        this.__demo = this.__demoSkip ? null : { m: String(method || 'GET').toUpperCase(), url: String(url), async: async !== false };
        return xOpen.apply(this, arguments);
    };
    XP.send = function (body) {
        var d = this.__demo;
        var xhr = this;
        var r = d && d.async && resolve(d.m, d.url, body, d.accept);
        if (!r) return xSend.apply(this, arguments);
        produce(r, d.m).then(function (res) {
            var text = res.text;
            Object.defineProperty(xhr, 'responseText', { configurable: true, get: function () { return text; } });
            Object.defineProperty(xhr, 'response', {
                configurable: true,
                get: function () {
                    if (xhr.responseType === 'json') {
                        try { return JSON.parse(text); } catch (e) { return null; }
                    }
                    return text;
                },
            });
            Object.defineProperty(xhr, 'responseURL', { configurable: true, get: function () { return d.url; } });
            xhr.getResponseHeader = function (n) { return /^content-type$/i.test(n) ? res.ct : null; };
            xhr.getAllResponseHeaders = function () { return 'content-type: ' + res.ct + '\r\n'; };
            xOpen.call(xhr, 'GET', '/_demo/blank.txt', true);
            xSend.call(xhr);
        });
    };

    // ---- แจ้งเตือน
    function toast(msg, kind) {
        var box = document.getElementById('demo-toasts');
        if (!box) {
            box = document.createElement('div');
            box.id = 'demo-toasts';
            box.setAttribute('role', 'status');
            box.setAttribute('aria-live', 'polite');
            (document.body || document.documentElement).appendChild(box);
        }
        var el = document.createElement('div');
        el.className = 'demo-toast' + (kind === 'ok' ? ' is-ok' : '');
        el.textContent = msg;
        box.appendChild(el);
        setTimeout(function () { el.classList.add('is-out'); }, 3200);
        setTimeout(function () { el.remove(); }, 3700);
    }

    function flash(msg) {
        try { sessionStorage.setItem('demo_flash', msg); } catch (e) { /* ไม่มี storage */ }
    }

    window.__demoToast = toast;

    // ---- ฟอร์ม: ส่งแบบปกติ (ไม่ใช่ AJAX) → จำลองว่าสำเร็จ
    function formMethod(f) {
        var m = String(f.getAttribute('method') || 'GET').toUpperCase();
        var o = f.querySelector('input[name="_method"]');
        return o ? String(o.value).toUpperCase() : m;
    }

    function simulateSubmit(f) {
        var action = f.getAttribute('action');
        var loc = toLocal(action || location.href);
        if (loc && /\/(logout|signout)(\/|$)/i.test(loc.path)) {
            toast(MSG_LOGOUT); // อยู่หน้าเดิม: เว็บทดลองมีแต่หลังบ้าน ไม่มีหน้าเข้าสู่ระบบ
            return;
        }
        if (formMethod(f) === 'GET') {
            if (loc && loc.path !== location.pathname.replace(/\/+$/, '') && isPage(loc.path)) {
                location.href = loc.path;
            } else {
                toast(MSG_FILTER);
            }
            return;
        }
        if (loc && /\/(export|download|print|pdf|excel)/i.test(loc.path)) {
            toast(MSG_FILE);
            return;
        }
        flash(MSG_SAVED);
        var back = backTarget(location.pathname);
        if (back === location.pathname.replace(/\/+$/, '')) {
            location.reload();
        } else {
            location.href = back;
        }
    }

    window.addEventListener('submit', function (e) {
        if (e.defaultPrevented) return;
        var f = e.target;
        if (!(f instanceof HTMLFormElement)) return;
        var action = f.getAttribute('action');
        if (action && !toLocal(action)) return; // ส่งไปเว็บอื่น
        e.preventDefault();
        simulateSubmit(f);
    });
    HTMLFormElement.prototype.submit = function () { simulateSubmit(this); };

    // ---- ลิงก์ไปหน้าที่ไม่มีในเวอร์ชันทดลอง (ฟังที่ window = หลังสคริปต์ของหน้าแล้ว)
    window.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        var href = a.getAttribute('href') || '';
        if (!href || href.charAt(0) === '#' || /^(javascript|mailto|tel):/i.test(href)) return;
        var loc = toLocal(a.href);
        if (!loc || loc.own) return;
        var p = loc.path;
        if (/\/(logout|signout)(\/|$)/i.test(p)) {
            e.preventDefault();
            toast(MSG_LOGOUT);
            return;
        }
        if (hasExt(p)) {
            if (FILE_EXT.test(p)) {
                e.preventDefault();
                toast(MSG_FILE);
            }
            return;
        }
        if (/\/(export|download)(\/|$)/i.test(p)) {
            e.preventDefault();
            toast(MSG_FILE);
            return;
        }
        if (isPage(p)) return;
        e.preventDefault();
        toast(/^\/[a-z]+\/admin(\/|$)/.test(p) ? MSG_NA : MSG_FRONT);
    });

    var wOpen = window.open;
    window.open = function (url) {
        var loc = url ? toLocal(String(url)) : null;
        if (loc && !loc.own) {
            if (FILE_EXT.test(loc.path) || /\/(export|download)(\/|$)/i.test(loc.path)) {
                toast(MSG_FILE);
                return null;
            }
            if (!hasExt(loc.path) && !isPage(loc.path) && loc.path !== location.pathname) {
                toast(/^\/[a-z]+\/admin(\/|$)/.test(loc.path) ? MSG_NA : MSG_FRONT);
                return null;
            }
        }
        return wOpen.apply(window, arguments);
    };

    // ---- WebSocket แจ้งเตือนสด (Reverb) ของเซิร์ฟเวอร์จริง: ไม่ต่อ ไม่ให้ขึ้น error ซ้ำ ๆ
    var RealWS = window.WebSocket;
    if (RealWS) {
        window.WebSocket = function (url, protocols) {
            if (/\.mrta\.test|\.invalid|:8080\//.test(String(url))) {
                return { url: String(url), readyState: 0, protocol: '', extensions: '', bufferedAmount: 0, binaryType: 'blob',
                    send: function () {}, close: function () { this.readyState = 3; },
                    addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return true; } };
            }
            return protocols === undefined ? new RealWS(url) : new RealWS(url, protocols);
        };
        ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k, i) { window.WebSocket[k] = i; });
        window.WebSocket.prototype = RealWS.prototype;
    }

    // DataTables: ข้อมูลตัวอย่างบางตารางไม่ครบทุกคอลัมน์ → ไม่ต้องเด้งกล่องเตือน
    function quietDataTables() {
        var dt = window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable;
        if (dt && dt.ext) dt.ext.errMode = 'none';
    }

    // ---- แถบบอกว่าเป็นเวอร์ชันทดลอง + ข้อความหลังบันทึก
    document.addEventListener('DOMContentLoaded', function () {
        quietDataTables();
        var bar = document.createElement('div');
        bar.id = 'demo-ribbon';
        bar.innerHTML = '<strong>เวอร์ชันทดลอง</strong><span>ข้อมูลสมมติ · กดบันทึกได้แต่ไม่มีผลจริง</span>'
            + '<button type="button" aria-label="ซ่อนแถบเวอร์ชันทดลอง">&times;</button>';
        bar.querySelector('button').addEventListener('click', function () { bar.remove(); });
        document.body.appendChild(bar);
        var msg = null;
        try {
            msg = sessionStorage.getItem('demo_flash');
            sessionStorage.removeItem('demo_flash');
        } catch (e) { /* ไม่มี storage */ }
        if (msg) toast(msg, 'ok');
    });
    window.addEventListener('load', quietDataTables);
})();
