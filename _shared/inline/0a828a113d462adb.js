
    (function () {
        var KEY = 'mrta_a11y';
        var DEFAULTS = { font: 'md', contrast: 'normal', kbd: true, sr: true };
        var COOKIE_DOMAIN = ".mrta.test";
        var COOKIE_AGE = 60 * 60 * 24 * 365;

        function readCookie() {
            var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + KEY + '=([^;]*)'));
            if (!m) return null;
            try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
        }
        function writeCookie(value, maxAge) {
            var c = KEY + '=' + encodeURIComponent(value) + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
            if (COOKIE_DOMAIN) c += '; domain=' + COOKIE_DOMAIN;
            if (location.protocol === 'https:') c += '; Secure';
            document.cookie = c;
        }

        window.mrtaA11y = {
            KEY: KEY,
            DEFAULTS: DEFAULTS,
            load: function () {
                var saved = readCookie();
                if (!saved) {
                    // ผู้ใช้เดิม: ค่าที่ตั้งไว้ก่อนมีระบบแชร์อยู่ใน localStorage ของระบบนี้ → ย้ายขึ้น cookie ครั้งเดียวแล้วลบทิ้ง
                    // (ถ้าเก็บไว้ ค่าเก่าจะฟื้นกลับมาทับค่าที่เปลี่ยนจากระบบอื่นภายหลัง)
                    try {
                        saved = JSON.parse(localStorage.getItem(KEY) || 'null');
                        if (saved) {
                            writeCookie(JSON.stringify(saved), COOKIE_AGE);
                            if (readCookie()) localStorage.removeItem(KEY); // เบราว์เซอร์ปิด cookie = เก็บไว้ที่เดิม
                        }
                    } catch (e) {}
                }
                saved = saved || {};
                var s = {};
                for (var k in DEFAULTS) s[k] = saved.hasOwnProperty(k) ? saved[k] : DEFAULTS[k];
                return s;
            },
            // บันทึก = cookie ของโดเมนแม่ (ทุกระบบใช้ค่านี้) - เบราว์เซอร์ที่ปิด cookie ใช้ localStorage ของระบบนี้แทน
            save: function (s) {
                var v = JSON.stringify(s);
                writeCookie(v, COOKIE_AGE);
                if (!readCookie()) { try { localStorage.setItem(KEY, v); } catch (e) {} }
            },
            // รีเซ็ต = เขียนค่าเริ่มต้นลง cookie (ไม่ลบ cookie - ถ้าลบ ระบบที่ยังมีค่าเก่าใน localStorage จะดึงกลับขึ้นมา)
            clear: function () {
                writeCookie(JSON.stringify(DEFAULTS), COOKIE_AGE);
                try { localStorage.removeItem(KEY); } catch (e) {}
            },
            apply: function (s) {
                var html = document.documentElement;
                html.setAttribute('data-a11y-font', s.font);
                html.setAttribute('data-a11y-contrast', s.contrast);
                html.classList.toggle('a11y-kbd', !!s.kbd);
                html.classList.toggle('a11y-sr', !!s.sr);
            }
        };
        // จำว่าตอนนี้ใช้เมาส์/นิ้ว หรือคีย์บอร์ด - ให้ accessibility.css ไม่ขึ้นกรอบโฟกัสที่ช่องพิมพ์ตอนคลิกด้วยเมาส์
        // (เปลี่ยนกลับเป็นคีย์บอร์ดเฉพาะตอนกด Tab - พิมพ์ตัวอักษรในช่องไม่นับ ไม่งั้นกรอบจะโผล่ตอนเริ่มพิมพ์)
        document.addEventListener('pointerdown', function () { document.documentElement.classList.add('a11y-pointer'); }, true);
        document.addEventListener('keydown', function (e) { if (e.key === 'Tab') document.documentElement.classList.remove('a11y-pointer'); }, true);
        window.mrtaA11y.apply(window.mrtaA11y.load());
        // กดย้อนกลับแล้วเบราว์เซอร์คืนหน้าเดิมจากหน่วยความจำ (bfcache) สคริปต์นี้ไม่รันใหม่
        // ถ้าระหว่างนั้นไปเปลี่ยนค่าในอีกระบบ หน้าที่คืนมาจะค้างค่าเก่า → อ่าน cookie แล้วใช้ใหม่
        window.addEventListener('pageshow', function (e) {
            if (e.persisted) window.mrtaA11y.apply(window.mrtaA11y.load());
        });
    })();
