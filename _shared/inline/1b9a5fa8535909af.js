
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

    window.addEventListener('load',     function () { Preloader.reset(); });
    window.addEventListener('pageshow', function () { Preloader.reset(); });

    document.addEventListener('submit', function (e) {
        if (e.target && e.target.dataset.noPreload !== undefined) return;
        if (e.target && e.target.id === 'frm_export') return;
        var evt = e;
        setTimeout(function () {
            if (!evt.defaultPrevented) Preloader.show();
        }, 0);
    });

    document.addEventListener('click', function (e) {
        // เปิดแท็บใหม่ (Ctrl/Cmd/Shift/คลิกกลาง) ไม่เปลี่ยนหน้านี้ - ไม่ต้องแสดงตัวโหลด
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        var link = e.target.closest('a[href]');
        if (link && !link.classList.contains('disabled') && link.dataset.noPreload === undefined) {
            var href = link.getAttribute('href') || '';
            var isExternal = link.target === '_blank' || link.target === '_parent' || link.target === '_top';
            var isVoid = href === '#' || href === '' || href.startsWith('javascript') || href.startsWith('mailto') || href.startsWith('tel');
            // ลิงก์ดาวน์โหลดไฟล์ (export / template) ไม่เปลี่ยนหน้า → ตัวโหลดจะค้าง
            var isFile = link.hasAttribute('download')
                || /\.(xlsx?|csv|pdf|zip|rar|docx?|pptx?|png|jpe?g|gif|mp4|mp3)(\?|#|$)/i.test(href)
                || /\/(export|download)(-|_|\/|\?|$)/i.test(href);
            if (!isExternal && !isVoid && !isFile) {
                Preloader.show();
                return;
            }
        }

        var t = e.target.closest('.startpreload, .submit-frm');
        if (t && !t.classList.contains('disabled') && !t.closest('a[href]')) {
            Preloader.show();
        }
    });

    $(document).on('ajaxSend', function (e, xhr, opts) {
        if (opts.showPreload) Preloader.show();
    });
    $(document).on('ajaxComplete', function (e, xhr, opts) {
        if (opts.showPreload) Preloader.hide();
    });

    // ═══ Custom Radio/Checkbox/Switch Interactivity ═══
    document.querySelectorAll('.radio-card-h input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            document.querySelectorAll('.radio-card-h').forEach(c => c.classList.remove('active'));
            r.closest('.radio-card-h').classList.add('active');
        });
    });
    document.querySelectorAll('.rc-compact input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.d-flex').querySelectorAll('.rc-compact').forEach(c => c.classList.remove('active'));
            r.closest('.rc-compact').classList.add('active');
        });
    });
    document.querySelectorAll('.rc-vertical input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.d-flex').querySelectorAll('.rc-vertical').forEach(c => c.classList.remove('active'));
            r.closest('.rc-vertical').classList.add('active');
        });
    });
    document.querySelectorAll('.rc-icon-left input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.d-flex').querySelectorAll('.rc-icon-left').forEach(c => c.classList.remove('active'));
            r.closest('.rc-icon-left').classList.add('active');
        });
    });
    document.querySelectorAll('.rc-icon-left-sm input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.row').querySelectorAll('.rc-icon-left-sm').forEach(c => c.classList.remove('active'));
            r.closest('.rc-icon-left-sm').classList.add('active');
        });
    });
    document.querySelectorAll('.radio-pills .pill input[type=radio]').forEach(r => {
        r.addEventListener('change', () => {
            r.closest('.radio-pills').querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            r.closest('.pill').classList.add('active');
        });
    });
    document.querySelectorAll('.check-tags .tag input[type=checkbox]').forEach(c => {
        c.addEventListener('change', () => c.closest('.tag').classList.toggle('active', c.checked));
    });
    document.querySelectorAll('.cc-item input[type=checkbox]').forEach(c => {
        c.addEventListener('change', () => c.closest('.cc-item').classList.toggle('active', c.checked));
    });
