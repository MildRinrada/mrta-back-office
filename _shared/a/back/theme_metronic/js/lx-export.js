/*
 * ส่งออกรายงานหลายรูปแบบ (TOR: Data Export - .xlsx .xls .csv .pdf .docx .doc)
 *
 * กดปุ่มส่งออกเดิมของหน้าไหนก็ได้ (ลิงก์ / ปุ่ม submit ฟอร์ม / ปุ่มที่ JS ประกอบ URL เอง) → ขึ้นกล่องให้เลือกรูปแบบไฟล์
 * → ตั้งคุกกี้ lx_export_format อายุ 2 นาที แล้วกดปุ่มเดิมให้อีกครั้ง → middleware ReportExportFormat แปลงไฟล์ .xlsx ที่ได้
 * ไม่ต้องแก้ปุ่ม/รายงานทีละหน้า
 *
 * ปุ่มที่นับเป็น "ส่งออก": มี data-export หรือ (id / class / href / action ของฟอร์ม / ข้อความ) มีคำว่า export / ส่งออก
 * ยกเว้น นำเข้า / ไฟล์ตัวอย่าง / ปุ่ม PDF อยู่แล้ว / ปุ่มเปิดเมนู (data-bs-toggle) / data-export="off"
 *
 * ต้นฉบับอยู่ที่ mrta-portal - ก๊อปเหมือนกันทุกระบบ (สไตล์อยู่ท้าย css/sidebar-mrta.css)
 */
(function () {
    'use strict';

    var COOKIE = 'lx_export_format';
    var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
    var FORMATS = [
        { f: 'xlsx', name: 'Excel', ext: '.xlsx', icon: 'fa-file-excel', cls: 'is-excel' },
        { f: 'xls', name: 'Excel 97-2003', ext: '.xls', icon: 'fa-file-excel', cls: 'is-excel' },
        { f: 'csv', name: 'CSV', ext: '.csv', icon: 'fa-file-csv', cls: 'is-csv' },
        { f: 'pdf', name: 'PDF', ext: '.pdf', icon: 'fa-file-pdf', cls: 'is-pdf' },
        { f: 'docx', name: 'Word', ext: '.docx', icon: 'fa-file-word', cls: 'is-word' },
        { f: 'doc', name: 'Word 97-2003', ext: '.doc', icon: 'fa-file-word', cls: 'is-word' }
    ];
    var T = EN
        ? { title: 'Export as', hint: 'Choose a file format', cancel: 'Cancel' }
        : { title: 'ส่งออกเป็นไฟล์', hint: 'เลือกรูปแบบไฟล์ที่ต้องการ', cancel: 'ยกเลิก' };

    var passThrough = false;

    function setFormat(f) {
        document.cookie = COOKIE + '=' + (f || '') + '; path=/; max-age=' + (f ? 120 : 0) + '; SameSite=Lax';
    }

    function lastFormat() {
        try { return localStorage.getItem('lx_export_last') || 'xlsx'; } catch (e) { return 'xlsx'; }
    }

    function remember(f) {
        try { localStorage.setItem('lx_export_last', f); } catch (e) { /* ไม่มี storage ก็ไม่เป็นไร */ }
    }

    function isExport(el) {
        if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
        if (el.dataset.export === 'off') return false;
        if (el.hasAttribute('data-export')) return true;
        if (el.hasAttribute('data-bs-toggle') || el.hasAttribute('data-toggle')) return false;

        var form = el.form || null;
        var isSubmit = form && (el.type === 'submit' || (el.tagName === 'BUTTON' && !el.getAttribute('type')));
        var hay = [
            el.id, el.className && el.className.baseVal === undefined ? el.className : '',
            el.getAttribute('href'), el.getAttribute('onclick'), el.getAttribute('data-url'), el.getAttribute('formaction'),
            isSubmit ? form.getAttribute('action') : '', el.textContent
        ].join(' ').toLowerCase();

        if (/import|นำเข้า|template|ตัวอย่าง|sample|pdf/.test(hay)) return false;
        // ไฟล์สำรองข้อมูล / ไฟล์ตั้งค่า / ไฟล์ที่ไม่ใช่รายงาน (.zip .json .sql ...) - ดาวน์โหลดตรงตามเดิม ไม่ถามรูปแบบ
        if (/backup|สำรอง|\.(zip|json|sql|gz|rar)(\?|$)/.test(String(el.getAttribute('href') || '').toLowerCase()) || /backup|สำรอง/.test(hay)) return false;
        return /export|ส่งออก/.test(hay);
    }

    function choose(el) {
        if (typeof Swal === 'undefined') { setFormat(''); return trigger(el); }
        var last = lastFormat();
        var html = '<div class="lx-xp-hint">' + T.hint + '</div><div class="lx-xp-grid">'
            + FORMATS.map(function (x) {
                return '<button type="button" class="lx-xp-opt ' + x.cls + (x.f === last ? ' is-last' : '') + '" data-f="' + x.f + '">'
                    + '<i class="fa-solid ' + x.icon + '"></i><span class="lx-xp-name">' + x.name + '</span><span class="lx-xp-ext">' + x.ext + '</span></button>';
            }).join('') + '</div>';

        Swal.fire({
            title: T.title,
            html: html,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: T.cancel,
            customClass: { popup: 'lx-xp-popup' },
            didOpen: function (popup) {
                popup.querySelectorAll('.lx-xp-opt').forEach(function (b) {
                    b.addEventListener('click', function () {
                        var f = b.getAttribute('data-f');
                        remember(f);
                        setFormat(f === 'xlsx' ? '' : f);
                        Swal.close();
                        trigger(el);
                    });
                });
                var cur = popup.querySelector('.lx-xp-opt.is-last');
                if (cur) cur.focus();
            }
        });
    }

    // กดปุ่มเดิมอีกครั้ง (ข้ามตัวดัก) - ลิงก์ไปตาม href, ปุ่ม submit ส่งฟอร์ม, ปุ่มที่ผูก JS ทำงานตามเดิม
    function trigger(el) {
        passThrough = true;
        try { el.click(); } finally { passThrough = false; }
    }

    // ดักตั้งแต่ capture phase ก่อน handler ของหน้า - กันไม่ให้ส่งออกทันที แล้วถามรูปแบบก่อน
    document.addEventListener('click', function (e) {
        if (passThrough) return;
        var el = e.target.closest ? e.target.closest('a, button, input[type=submit]') : null;
        if (!el || el.closest('.lx-xp-popup') || !isExport(el)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        choose(el);
    }, true);
})();
