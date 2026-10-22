
/*
 * ปุ่มลูกตาเปิด/ปิดรหัสผ่าน - ตัวเดียวใช้ได้ทุกหน้า
 * ผูกที่ document แล้วอ่าน data-eye ว่าคุมช่องไหน จึงไม่ต้องมีสคริปต์ซ้ำ
 * ในแต่ละหน้าเหมือนของเดิม (login/register/reset/confirm เขียนซ้ำกัน 4 ชุด
 * และหน้า register ที่มีสองช่องต้องประกาศตัวแปรซ้ำอีกชุด)
 */
document.addEventListener('click', function (e) {
    var btn = e.target.closest('.auth-eye');
    if (!btn) return;

    var input = document.getElementById(btn.dataset.eye);
    if (!input) return;

    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.querySelector('i').className = show ? 'far fa-eye-slash' : 'far fa-eye';
    btn.setAttribute('aria-label', show ? "\u0e0b\u0e48\u0e2d\u0e19\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19" : "\u0e41\u0e2a\u0e14\u0e07\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19");
});

/*
 * ช่องที่กรอกผิด (is-invalid จากเซิร์ฟเวอร์) - บอก screen reader ว่าช่องนี้ผิด และให้อ่านกล่อง error
 * ด้านบน (#auth-errors ใน includes/alerts) ตอนโฟกัสช่อง (WCAG 3.3.1 / 4.1.2)
 * ทำที่เดียวตรงนี้ หน้าลูกทุกหน้าไม่ต้องเขียน aria-invalid / aria-describedby เอง
 */
(function () {
    var box = document.getElementById('auth-errors');
    document.querySelectorAll('.auth-card .is-invalid').forEach(function (el) {
        el.setAttribute('aria-invalid', 'true');
        if (box) {
            var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
            if (ids.indexOf(box.id) < 0) ids.push(box.id);
            el.setAttribute('aria-describedby', ids.join(' '));
        }
    });
})();
