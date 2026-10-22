
// สวิตช์ของ includes/form_switch (ชุดเดียวกับ mrta-portal): กดสวิตช์ → click radio ตัวที่ตรง (ค่าที่ส่ง/สคริปต์เดิมที่อ่าน radio ทำงานเหมือนเดิม)
(function () {
    function sync(box) {
        if (!box) return;
        var on = box.querySelector('.fsw-radio').checked;
        var label = box.querySelector('.fsw-state');
        box.querySelector('.fsw-proxy').checked = on;
        box.classList.toggle('is-on', on);
        if (label) label.textContent = on ? label.dataset.on : label.dataset.off;
    }
    window.fswSync = function (root) { (root || document).querySelectorAll('[data-fsw]').forEach(sync); };
    document.addEventListener('change', function (e) {
        var el = e.target;
        if (!el.classList) return;
        if (el.classList.contains('fsw-proxy')) {
            var box = el.closest('[data-fsw]');
            var target = box.querySelectorAll('.fsw-radio')[el.checked ? 0 : 1];
            if (target && !target.checked) target.click();
            sync(box);
        } else if (el.classList.contains('fsw-radio')) {
            sync(el.closest('[data-fsw]'));
        }
    });
    document.addEventListener('reset', function (e) { setTimeout(function () { window.fswSync(e.target); }, 0); });
})();

// แผงสวิตช์ .sw-item (checkbox ใน label.switch): ใต้ชื่อแสดงป้ายสถานะจริง "เปิดใช้งาน / ปิดใช้งาน" (.sw-state)
// แทนข้อความตายตัว "Active / Inactive" ที่ไม่บอกว่าตอนนี้อยู่สถานะไหน - เปลี่ยนตามทันทีที่กด
// ข้อความเฉพาะของแผงไหน: ใส่ data-on / data-off ที่ .sw-desc / สคริปต์ของหน้าที่เขียนข้อความลง .sw-desc เอง ป้ายจะกลับมาทับหลังกด
(function () {
    var ON = "\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19", OFF = "\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19";
    function render(item) {
        var cb = item.querySelector('.switch input[type=checkbox]');
        var desc = item.querySelector('.sw-desc');
        if (!cb || !desc) return;
        var badge = desc.querySelector('.sw-state');
        if (!badge) {
            desc.textContent = '';
            badge = document.createElement('span');
            desc.appendChild(badge);
        }
        badge.className = 'sw-state ' + (cb.checked ? 'is-on' : 'is-off');
        badge.textContent = cb.checked ? (desc.dataset.on || ON) : (desc.dataset.off || OFF);
    }
    window.swStateSync = function (root) { (root || document).querySelectorAll('.sw-item').forEach(render); };
    document.addEventListener('change', function (e) {
        var item = e.target.closest && e.target.closest('.sw-item');
        if (item) setTimeout(function () { render(item); }, 0);   // หลังสคริปต์ของหน้าที่อาจเขียน .sw-desc ไปแล้ว
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { window.swStateSync(); });
    else window.swStateSync();
})();
