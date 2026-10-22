
(function () {
    var MSG_BAD = "\u0e44\u0e1f\u0e25\u0e4c\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e23\u0e39\u0e1b\u0e20\u0e32\u0e1e\u0e0a\u0e19\u0e34\u0e14\u0e17\u0e35\u0e48\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a";

    function inputOf(box) {
        var sel = box.getAttribute('data-img-pick');
        return sel ? document.querySelector(sel) : box.querySelector('input[type=file]');
    }
    function usable(box) {
        var input = box && inputOf(box);
        return input && !input.disabled && !box.classList.contains('is-pick-off') ? input : null;
    }
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1; }
    // ตรงกับ accept ของ input ไหม (image/png / image/* / .jpg) - ไม่มี accept = รับเฉพาะรูป
    function accepts(input, file) {
        var accept = (input.getAttribute('accept') || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
        if (!accept.length) return /^image\//.test(file.type);
        var type = (file.type || '').toLowerCase(), name = file.name.toLowerCase();
        return accept.some(function (a) {
            if (a.charAt(0) === '.') return name.slice(-a.length) === a;
            if (a.slice(-2) === '/*') return type.indexOf(a.slice(0, -1)) === 0;
            return type === a;
        });
    }
    function toast(text) {
        if (window.Swal) Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: text, showConfirmButton: false, timer: 3000 });
        else alert(text);
    }
    function outsideDrop(e) {
        return !(e.target.closest && e.target.closest('input[type=file], #dropZone'));
    }

    document.addEventListener('click', function (e) {
        var box = e.target.closest('[data-img-pick]');
        if (!box || e.target.closest('input[type=file]')) return;
        // ปุ่ม/ลิงก์อื่นในกล่องทำงานของมันเอง - ยกเว้นปุ่มกล้อง
        if (!e.target.closest('.img-pick-cam') && e.target.closest('button, a, input, select, textarea, label')) return;
        var input = usable(box);
        if (!input) return;
        e.preventDefault();
        input.click();
    });

    // กล่องที่เป็นปุ่มเอง (role=button) - Enter / Space เปิดเลือกไฟล์
    document.addEventListener('keydown', function (e) {
        if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.matches || !e.target.matches('[data-img-pick][role=button]')) return;
        var input = usable(e.target);
        if (!input) return;
        e.preventDefault();
        input.click();
    });

    document.addEventListener('dragover', function (e) {
        if (!hasFiles(e)) return;
        var box = e.target.closest && e.target.closest('[data-img-pick]');
        if (box && !usable(box)) box = null;
        document.querySelectorAll('[data-img-pick].is-drop').forEach(function (b) { if (b !== box) b.classList.remove('is-drop'); });
        if (box) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            box.classList.add('is-drop');
        } else if (outsideDrop(e)) {
            // วางพลาดนอกกล่อง - ไม่ให้เบราว์เซอร์เปิดไฟล์แทนหน้าฟอร์ม (ที่กรอกไว้จะหาย)
            e.preventDefault();
            e.dataTransfer.dropEffect = 'none';
        }
    });
    document.addEventListener('dragleave', function (e) {
        var box = e.target.closest && e.target.closest('[data-img-pick]');
        if (box && !box.contains(e.relatedTarget)) box.classList.remove('is-drop');
    });
    document.addEventListener('drop', function (e) {
        if (!hasFiles(e)) return;
        var box = e.target.closest && e.target.closest('[data-img-pick]');
        var input = box && usable(box);
        if (!input) {
            if (outsideDrop(e)) e.preventDefault();
            return;
        }
        e.preventDefault();
        box.classList.remove('is-drop');

        var dropped = Array.prototype.filter.call(e.dataTransfer.files, function (f) { return accepts(input, f); });
        if (!dropped.length) { toast(MSG_BAD); return; }
        var dt = new DataTransfer();
        if (input.multiple) {
            // หลายไฟล์: ลากมาเพิ่มต่อจากที่เลือกไว้
            Array.prototype.forEach.call(input.files || [], function (f) { dt.items.add(f); });
            dropped.forEach(function (f) { dt.items.add(f); });
        } else {
            dt.items.add(dropped[0]);
        }
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // หลังเลือกไฟล์: กล่องวางไฟล์แสดงชื่อไฟล์ / กรอบที่มี data-img-pick-auto (หน้าที่ไม่มีสคริปต์พรีวิวของตัวเอง) แสดงรูปใหม่
    document.addEventListener('change', function (e) {
        var input = e.target;
        if (!input.matches || !input.matches('input[type=file]')) return;
        var file = input.files && input.files[0];
        document.querySelectorAll('.img-pick-zone, [data-img-pick-auto]').forEach(function (box) {
            if (inputOf(box) !== input) return;
            var out = box.querySelector('.img-pick-file');
            if (out) out.textContent = Array.prototype.map.call(input.files || [], function (f) { return f.name; }).join(', ');
            var img = box.hasAttribute('data-img-pick-auto') && box.querySelector('img');
            if (img && file && /^image\//.test(file.type)) img.src = URL.createObjectURL(file);
        });
    });

    // รูปในกรอบโหลดขึ้น (พรีวิวที่หน้าตั้ง src ให้ / ตัดรูปเสร็จ) = มีรูปแล้ว
    // ยกเว้นภาพเริ่มต้น (/images/placeholder/ - getCoverImage สลับไปเมื่อไฟล์ปก/URL เปิดไม่ได้):
    // ภาพแนวนอนครอปลงกรอบปกแล้วดูเพี้ยน แสดงกรอบว่างแทน (กรอบต้องมี .img-pick-empty)
    document.addEventListener('load', function (e) {
        if (!e.target || e.target.tagName !== 'IMG' || !e.target.getAttribute('src')) return;
        var wrap = e.target.closest('.img-pick-wrap');
        if (!wrap) return;
        var placeholder = /\/images\/placeholder\//.test(e.target.src) && wrap.querySelector('.img-pick-empty');
        wrap.classList.toggle('is-empty', !!placeholder);
    }, true);
})();
