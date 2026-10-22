
(function () {
    var toggle = document.getElementById('as_toggle');
    var more = document.getElementById('as_more');
    if (toggle && more) {
        toggle.addEventListener('click', function () {
            var open = more.hasAttribute('hidden');
            if (open) { more.removeAttribute('hidden'); } else { more.setAttribute('hidden', ''); }
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            var icon = document.getElementById('as_toggle_icon');
            if (icon) { icon.className = 'fa-solid fa-chevron-' + (open ? 'up' : 'down') + ' ms-1 small'; }
        });
    }
    // flatpickr (Thai) when the back office has it, native date input otherwise
    if (window.flatpickr) {
        var opts = { dateFormat: 'Y-m-d', altInput: true, altFormat: 'j M Y', allowInput: true };
        if (window.flatpickr.l10ns && window.flatpickr.l10ns.th && document.documentElement.lang !== 'en') { opts.locale = 'th'; }
        document.querySelectorAll('.as-page .as-date').forEach(function (el) { window.flatpickr(el, opts); });
    }
    // ---------- instant search ----------
    // พิมพ์คำค้น/แท็ก = ค้นให้เองหลังหยุดพิมพ์ 350ms / เปลี่ยนตัวกรอง = ค้นทันที / กด Enter หรือปุ่มค้นหา = ค้นทันที
    // ดึงหน้านี้ใหม่ (GET เดิม) แล้วแทนที่เฉพาะ #as_results + อัปเดต URL (กดย้อนกลับ/แชร์ลิงก์ได้)
    // คำขอเก่าที่ยังไม่เสร็จถูกยกเลิก ผลจึงไม่สลับลำดับ / โหลดไม่สำเร็จ = ส่งฟอร์มแบบเดิม
    var asForm = document.getElementById('as_form');
    var asResults = document.getElementById('as_results');
    if (asForm && asResults && window.fetch && window.DOMParser) {
        var asSpin = document.getElementById('as_spin');
        var asTimer = null, asCtrl = null, asLast = null, asComposing = false;

        var asUrl = function (page) {
            var params = new URLSearchParams();
            new FormData(asForm).forEach(function (value, key) {
                if (String(value).trim() !== '') { params.append(key, String(value).trim()); }
            });
            if (page) { params.set('page', page); }
            var qs = params.toString();
            return asForm.getAttribute('action') + (qs ? '?' + qs : '');
        };

        var asLoad = function (url, opts) {
            opts = opts || {};
            if (url === asLast && !opts.force) { return; }
            asLast = url;
            if (asCtrl) { asCtrl.abort(); }
            asCtrl = window.AbortController ? new AbortController() : null;
            asResults.classList.add('is-loading');
            asResults.setAttribute('aria-busy', 'true');
            if (asSpin) { asSpin.hidden = false; }
            fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin', signal: asCtrl ? asCtrl.signal : undefined })
                .then(function (r) {
                    if (r.redirected || !r.ok) { throw new Error('bad response'); }
                    return r.text();
                })
                .then(function (html) {
                    var fresh = new DOMParser().parseFromString(html, 'text/html').getElementById('as_results');
                    if (!fresh) { throw new Error('no results block'); }
                    asResults.innerHTML = fresh.innerHTML;
                    if (window.history && history.replaceState) { history.replaceState(null, '', url); }
                    if (opts.scroll) { asResults.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                    asDone();
                })
                .catch(function (e) {
                    if (e && e.name === 'AbortError') { return; }
                    asDone();
                    window.location.href = url;   // โหลดแบบเดิม
                });
        };
        // ตัวโหลดเต็มจอของหลังบ้าน (คลิกลิงก์/ส่งฟอร์มแล้วขึ้นเอง) - ค้นหาแบบนี้ไม่เปลี่ยนหน้า จึงปิดให้
        // portal/news/... = Preloader (const ในสคริปต์หลัก ไม่อยู่บน window) / auth = closepreload()
        var asHidePreload = function () {
            setTimeout(function () {
                if (typeof Preloader !== 'undefined' && Preloader.reset) { Preloader.reset(); }
                else if (typeof closepreload === 'function') { closepreload(); }
            }, 0);
        };
        var asDone = function () {
            asHidePreload();
            asResults.classList.remove('is-loading');
            asResults.setAttribute('aria-busy', 'false');
            if (asSpin) { asSpin.hidden = true; }
        };
        var asSchedule = function (delay) {
            clearTimeout(asTimer);
            asTimer = setTimeout(function () { asLoad(asUrl()); }, delay);
        };

        ['as_q', 'as_tag'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) { return; }
            el.addEventListener('compositionstart', function () { asComposing = true; });
            el.addEventListener('compositionend', function () { asComposing = false; asSchedule(350); });
            el.addEventListener('input', function () { if (!asComposing) { asSchedule(350); } });
        });
        asForm.querySelectorAll('select, input[type=date]').forEach(function (el) {
            el.addEventListener('change', function () { asSchedule(0); });
        });
        asForm.addEventListener('submit', function (e) {
            e.preventDefault();
            clearTimeout(asTimer);
            asHidePreload();
            asLoad(asUrl(), { force: true });
        });
        // เลขหน้าในผลการค้นหา: โหลดเฉพาะผลแล้วเลื่อนขึ้นไปหัวผลการค้นหา
        asResults.addEventListener('click', function (e) {
            var a = e.target.closest('.as-pager a.page-link');
            if (!a || a.closest('.disabled') || a.getAttribute('href') === '#') { return; }
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) { return; }
            e.preventDefault();
            asHidePreload();
            asLoad(a.href, { scroll: true });
        });
        asLast = window.location.href;
    }
    var form = document.getElementById('as_reindex_form');
    if (form) {
        form.addEventListener('submit', function (e) {
            if (form.dataset.ok === '1') { return; }
            e.preventDefault();
            var go = function () {
                form.dataset.ok = '1';
                var btn = document.getElementById('as_reindex_btn');
                if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> อัปเดตดัชนี'; }
                form.submit();
            };
            var msg = "\u0e2d\u0e48\u0e32\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e41\u0e25\u0e30\u0e44\u0e1f\u0e25\u0e4c\u0e41\u0e19\u0e1a\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e43\u0e2b\u0e21\u0e48\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e14\u0e31\u0e0a\u0e19\u0e35\u0e04\u0e49\u0e19\u0e2b\u0e32 \u0e2d\u0e32\u0e08\u0e43\u0e0a\u0e49\u0e40\u0e27\u0e25\u0e32\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48 \u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23\u0e15\u0e48\u0e2d\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?";
            if (window.Swal) {
                Swal.fire({ icon: 'question', text: msg, showCancelButton: true, confirmButtonText: "\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15\u0e14\u0e31\u0e0a\u0e19\u0e35", cancelButtonText: "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01" })
                    .then(function (r) { if (r.isConfirmed) { go(); } });
            } else if (confirm(msg)) { go(); }
        });
    }
})();
