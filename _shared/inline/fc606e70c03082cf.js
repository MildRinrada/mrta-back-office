
    // ═══ Global Preloader Manager ═══
    const Preloader = (function () {
        var _count = 0;
        var _el    = null;

        function _getEl() {
            if (!_el) _el = document.getElementById('page-preloader');
            return _el;
        }

        return {
            show: function () {
                _count++;
                _getEl().classList.add('active');
            },
            hide: function () {
                _count = Math.max(0, _count - 1);
                if (_count === 0) _getEl().classList.remove('active');
            },
            reset: function () {
                _count = 0;
                _getEl().classList.remove('active');
            }
        };
    })();

    // Backward-compat aliases
    function initpreload()  { Preloader.show(); }
    function closepreload() { Preloader.hide(); }

    // ── 1. Page load / bfcache restore ────────────────────
    // `pageshow` ยิงทั้งสองกรณี: fresh load (persisted=false) และ bfcache restore (persisted=true)
    // ใช้แทน `load` เพื่อให้ครอบคลุม back/forward navigation ด้วย
    window.addEventListener('load',     function () { Preloader.reset(); });
    window.addEventListener('pageshow', function () { Preloader.reset(); });

    // ── 2. Page navigation (link / form submit) ────────────
    // หมายเหตุ: ไม่ใช้ beforeunload เพราะ:
    //   1. Firefox: beforeunload listener บล็อก bfcache → กด back ได้ fresh load แต่พัง
    //   2. Chrome/Safari: page เข้า bfcache พร้อม preloader active → ค้างเมื่อ restore
    // click handler ด้านล่างจัดการ link navigation แล้ว, form submit handler จัดการ form แล้ว

    // ── 3. Form submit ─────────────────────────────────────
    document.addEventListener('submit', function (e) {
        // Skip if the form has data-no-preload attribute
        if (e.target && e.target.dataset.noPreload !== undefined) return;
        // Skip export forms (id="frm_export") - these submit to a file-download
        // route, so the page never navigates and load/pageshow never fires to
        // reset the preloader, leaving it stuck forever.
        if (e.target && e.target.id === 'frm_export') return;
        // Defer so individual form handlers (e.g. jQuery Validate) can call
        // e.preventDefault() first - if they did, don't show the preloader.
        var evt = e;
        setTimeout(function () {
            if (!evt.defaultPrevented) Preloader.show();
        }, 0);
    });

    // ── 4. Click triggers ──────────────────────────────────
    document.addEventListener('click', function (e) {
        // ก) ทุก <a href> ที่ navigate ออกไป (ไม่ใช่ #, javascript:, mailto:, _blank, data-no-preload)
        var link = e.target.closest('a[href]');
        if (link && !link.classList.contains('disabled') && link.dataset.noPreload === undefined) {
            var href = link.getAttribute('href') || '';
            var isExternal = link.target === '_blank' || link.target === '_parent' || link.target === '_top';
            var isVoid = href === '#' || href === '' || href.startsWith('javascript') || href.startsWith('mailto') || href.startsWith('tel');
            if (!isExternal && !isVoid) {
                Preloader.show();
                return;
            }
        }

        // ข) element อื่นที่ใส่ class .startpreload หรือ .submit-frm ไว้เอง
        var t = e.target.closest('.startpreload, .submit-frm');
        if (t && !t.classList.contains('disabled') && !t.closest('a[href]')) {
            Preloader.show();
        }
    });

    // ── 5. jQuery AJAX (opt-in: pass showPreload:true in $.ajax options) ─
    // Usage: $.ajax({ url:'...', showPreload: true, ... })
    $(document).on('ajaxSend', function (e, xhr, opts) {
        if (opts.showPreload) Preloader.show();
    });
    $(document).on('ajaxComplete', function (e, xhr, opts) {
        if (opts.showPreload) Preloader.hide();
    });

    // ═══ Custom Radio/Checkbox/Switch Interactivity ═══
    // Radio Cards (horizontal pricing)
    document.querySelectorAll('.radio-card-h input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            document.querySelectorAll('.radio-card-h').forEach(c => c.classList.remove('active'));
            r.closest('.radio-card-h').classList.add('active');
        });
    });
    // Radio Cards (compact)
    document.querySelectorAll('.rc-compact input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.d-flex').querySelectorAll('.rc-compact').forEach(c => c.classList.remove(
                'active'));
            r.closest('.rc-compact').classList.add('active');
        });
    });
    // Radio Cards (vertical tiles)
    document.querySelectorAll('.rc-vertical input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.d-flex').querySelectorAll('.rc-vertical').forEach(c => c.classList.remove(
                'active'));
            r.closest('.rc-vertical').classList.add('active');
        });
    });
    // Radio Cards (icon left)
    document.querySelectorAll('.rc-icon-left input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.d-flex').querySelectorAll('.rc-icon-left').forEach(c => c.classList.remove(
                'active'));
            r.closest('.rc-icon-left').classList.add('active');
        });
    });
    // Radio Cards (icon left small inline)
    document.querySelectorAll('.rc-icon-left-sm input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.row').querySelectorAll('.rc-icon-left-sm').forEach(c => c.classList.remove(
                'active'));
            r.closest('.rc-icon-left-sm').classList.add('active');
        });
    });
    // Radio Pills
    document.querySelectorAll('.radio-pills .pill input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.radio-pills').querySelectorAll('.pill').forEach(p => p.classList.remove(
                'active'));
            r.closest('.pill').classList.add('active');
        });
    });
    // Checkbox Tags
    document.querySelectorAll('.check-tags .tag input[type=checkbox]').forEach(c => {
        c.addEventListener('change', () => c.closest('.tag').classList.toggle('active', c.checked));
    });
    // Checkbox Cards
    document.querySelectorAll('.cc-item input[type=checkbox]').forEach(c => {
        c.addEventListener('change', () => c.closest('.cc-item').classList.toggle('active', c.checked));
    });
