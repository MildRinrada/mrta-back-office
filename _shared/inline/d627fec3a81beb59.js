
    (function () {
        var api = window.mrtaA11y;
        var panel = document.getElementById('a11y-panel');
        if (!api || !panel || typeof panel.showModal !== 'function') return;
        // ต้องเป็นลูกตรงของ <body> ไม่งั้นโดน zoom ตามขนาดตัวอักษร (บาง layout วาง footer ไว้ใน .super_container)
        if (panel.parentNode !== document.body) document.body.appendChild(panel);

        var saved = api.load();   // ค่าที่บันทึกไว้
        var draft = null;         // ค่าที่กำลังลองในหน้าต่าง

        var LABELS = {
            search: "\u0e04\u0e49\u0e19\u0e2b\u0e32",
            close: "\u0e1b\u0e34\u0e14",
            menu: "\u0e40\u0e21\u0e19\u0e39",
            notification: "\u0e01\u0e32\u0e23\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19",
            next: "\u0e16\u0e31\u0e14\u0e44\u0e1b",
            prev: "\u0e01\u0e48\u0e2d\u0e19\u0e2b\u0e19\u0e49\u0e32"        };

        function copy(s) { return JSON.parse(JSON.stringify(s)); }

        // ใช้ค่ากับหน้า + งานที่ css ทำเองไม่ได้
        function applyAll(s) {
            var fontChanged = document.documentElement.getAttribute('data-a11y-font') !== s.font;
            api.apply(s);
            if (s.sr) fixAccessibleNames();
            // ขนาดตัวอักษรเปลี่ยน = ความกว้างเปลี่ยน ให้ carousel (swiper) คำนวณใหม่
            if (fontChanged) window.dispatchEvent(new Event('resize'));
        }

        function render() {
            panel.querySelectorAll('[data-a11y-font]').forEach(function (b) {
                b.setAttribute('aria-pressed', String(b.dataset.value === draft.font));
            });
            panel.querySelectorAll('[data-a11y-contrast]').forEach(function (b) {
                b.setAttribute('aria-pressed', String(b.dataset.value === draft.contrast));
            });
            panel.querySelectorAll('[data-a11y-toggle]').forEach(function (b) {
                b.setAttribute('aria-checked', String(!!draft[b.dataset.a11yToggle]));
            });
        }

        function open() {
            if (panel.open) return;
            saved = api.load(); // อ่านใหม่ทุกครั้ง เผื่อเพิ่งเปลี่ยนจากอีกระบบ/อีกแท็บ
            draft = copy(saved);
            render();
            panel.classList.remove('is-closing');
            panel.showModal();
        }

        // ปิดแบบเลื่อนออกไปทางขวาก่อน แล้วค่อย close() จริง (ถ้าไม่มี animation เช่นลดการเคลื่อนไหว ก็ปิดเลย)
        function closePanel() {
            if (!panel.open || panel.classList.contains('is-closing')) return;
            panel.classList.add('is-closing');
            var anim = getComputedStyle(panel).animationName;
            if (!anim || anim === 'none') {
                panel.classList.remove('is-closing');
                panel.close();
                return;
            }
            panel.addEventListener('animationend', function done(e) {
                if (e.target !== panel) return;
                panel.removeEventListener('animationend', done);
                panel.classList.remove('is-closing');
                panel.close();
            });
        }

        // โหมด Screen Reader: เติมชื่อให้ปุ่ม/ลิงก์ที่มีแต่ไอคอน ซ่อนไอคอนตกแต่ง และใส่ alt ว่างให้รูปที่ไม่มี alt
        function fixAccessibleNames() {
            document.querySelectorAll('i[class*="fa-"], i[class*="bi-"]').forEach(function (i) {
                if (!i.hasAttribute('aria-hidden')) i.setAttribute('aria-hidden', 'true');
            });
            document.querySelectorAll('img:not([alt])').forEach(function (img) { img.setAttribute('alt', ''); });

            document.querySelectorAll('a, button, [role="button"]').forEach(function (el) {
                if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
                if (el.textContent.trim() !== '') return;
                var img = el.querySelector('img[alt]:not([alt=""])');
                if (img) return;
                var cls = (el.className + ' ' + Array.prototype.map.call(el.querySelectorAll('i, span'), function (x) { return x.className; }).join(' ')).toLowerCase();
                var name = el.getAttribute('title')
                    || (/search/.test(cls) && LABELS.search)
                    || (/(fa-times|bi-x|close)/.test(cls) && LABELS.close)
                    || (/(toggler|fa-bars|bi-list)/.test(cls) && LABELS.menu)
                    || (/(bell|noti)/.test(cls) && LABELS.notification)
                    || (/(next|right)/.test(cls) && LABELS.next)
                    || (/(prev|left)/.test(cls) && LABELS.prev);
                if (name) el.setAttribute('aria-label', name);
            });
        }

        // เปิดหน้าต่างอยู่ ไม่ให้หน้าด้านหลังเลื่อนตามล้อเมาส์/นิ้ว - ใช้วิธีนี้แทน overflow:hidden ที่ <html>
        // เพราะ overflow:hidden ทำให้ scrollbar หาย หน้าทั้งหน้ากระตุกขยับไปทางขวา
        // ปล่อยให้เลื่อนได้เฉพาะในเนื้อหาของหน้าต่างเองตอนที่มันยาวเกินจอ (overscroll-behavior ใน css กันไม่ให้ทะลุออกไป)
        function blockPageScroll(e) {
            var body = e.target.closest && e.target.closest('.a11y-body');
            if (body && body.scrollHeight > body.clientHeight) return;
            e.preventDefault();
        }
        panel.addEventListener('wheel', blockPageScroll, { passive: false });
        panel.addEventListener('touchmove', blockPageScroll, { passive: false });

        document.addEventListener('click', function (e) {
            var opener = e.target.closest('[data-a11y-open]');
            if (opener) {
                e.preventDefault();
                open();
                return;
            }
            if (!panel.open) return;

            var btn = e.target.closest('[data-a11y-font], [data-a11y-contrast], [data-a11y-toggle]');
            if (btn && panel.contains(btn)) {
                if (btn.hasAttribute('data-a11y-font')) draft.font = btn.dataset.value;
                else if (btn.hasAttribute('data-a11y-contrast')) draft.contrast = btn.dataset.value;
                else draft[btn.dataset.a11yToggle] = !draft[btn.dataset.a11yToggle];
                render();
                applyAll(draft); // เห็นผลทันที
                return;
            }
            if (e.target.closest('[data-a11y-save]')) {
                saved = copy(draft);
                api.save(saved); // cookie ของโดเมนแม่ = ทุกระบบของ MRTA ใช้ค่านี้ด้วย
                closePanel();
                return;
            }
            if (e.target.closest('[data-a11y-reset]')) {
                saved = copy(api.DEFAULTS);
                draft = copy(saved);
                api.clear();
                render();
                applyAll(saved);
                return;
            }
            // กากบาท หรือคลิกฉากหลัง (นอกกล่อง - event ตกที่ตัว dialog เอง)
            if (e.target.closest('[data-a11y-close]') || e.target === panel) closePanel();
        });

        // Esc: ให้เลื่อนออกเหมือนปิดทางอื่น แทนที่จะหายทันที
        panel.addEventListener('cancel', function (e) {
            e.preventDefault();
            closePanel();
        });

        // ปิดทุกทาง (กากบาท / ฉากหลัง / Esc / บันทึก) - ไม่ได้บันทึกก็กลับเป็นค่าเดิม
        panel.addEventListener('close', function () { applyAll(saved); });

        if (saved.sr) fixAccessibleNames();
    })();
