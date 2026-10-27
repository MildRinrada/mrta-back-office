/*
 * ปุ่ม 👁 ดูข้อมูลส่วนบุคคลเต็ม (TOR 4.3 Data Masking) - คู่กับ App\Support\Pii::html() และ PiiController
 * กดครั้งแรก: ส่ง token ไป POST /admin/pii/reveal (ระบบบันทึก PDPA log) แล้วแสดงค่าเต็ม / กดอีกครั้ง: ปิดบังกลับ
 * ใช้ event delegation จึงทำงานกับตาราง DataTables ที่โหลดทีหลังด้วย
 * ต้นฉบับอยู่ที่ mrta-portal - ก๊อปเหมือนกันทุกระบบ (สไตล์ท้าย css/sidebar-mrta.css)
 */
(function () {
    'use strict';

    function csrf() {
        var m = document.querySelector('meta[name="csrf-token"]');
        return m ? m.getAttribute('content') : '';
    }

    function setIcon(btn, open) {
        btn.innerHTML = '<i class="fa-regular ' + (open ? 'fa-eye-slash' : 'fa-eye') + '"></i>';
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.pii-eye') : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        var span = btn.previousElementSibling;
        if (!span || !span.classList.contains('pii')) return;

        // เปิดอยู่ → ปิดบังกลับ (ไม่ต้องถาม server)
        if (btn.dataset.open === '1') {
            span.textContent = btn.dataset.masked;
            btn.dataset.open = '0';
            span.classList.remove('is-open');
            setIcon(btn, false);
            return;
        }
        if (btn.disabled) return;
        btn.disabled = true;

        var body = new URLSearchParams();
        body.append('token', btn.getAttribute('data-pii'));
        fetch('/admin/pii/reveal', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        }).then(function (r) {
            return r.json().then(function (j) { return { ok: r.ok, j: j }; });
        }).then(function (res) {
            btn.disabled = false;
            if (!res.ok || typeof res.j.value === 'undefined') {
                var msg = (res.j && res.j.message) || 'Error';
                if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: msg, showConfirmButton: false, timer: 3000 });
                return;
            }
            btn.dataset.masked = span.textContent;
            span.textContent = res.j.value;
            span.classList.add('is-open');
            btn.dataset.open = '1';
            setIcon(btn, true);
        }).catch(function () { btn.disabled = false; });
    }, true);
})();
