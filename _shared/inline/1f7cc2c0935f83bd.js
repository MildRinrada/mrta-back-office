
(function () {
    var form = document.getElementById('frm_facility');
    var grid = document.getElementById('afe_grid');
    var input = document.getElementById('new_images');
    var TXT = {"count":"(:n \u0e20\u0e32\u0e1e)","too_many_upload":"\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e14\u0e49\u0e04\u0e23\u0e31\u0e49\u0e07\u0e25\u0e30\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 :max \u0e44\u0e1f\u0e25\u0e4c - \u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e0a\u0e38\u0e14\u0e19\u0e35\u0e49\u0e01\u0e48\u0e2d\u0e19\u0e41\u0e25\u0e49\u0e27\u0e04\u0e48\u0e2d\u0e22\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e15\u0e48\u0e2d","too_many":"\u0e20\u0e32\u0e1e\u0e1b\u0e23\u0e30\u0e21\u0e27\u0e25\u0e01\u0e34\u0e08\u0e01\u0e23\u0e23\u0e21\u0e43\u0e2a\u0e48\u0e44\u0e14\u0e49\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 :max \u0e20\u0e32\u0e1e\u0e15\u0e48\u0e2d\u0e1e\u0e37\u0e49\u0e19\u0e17\u0e35\u0e48 (\u0e15\u0e2d\u0e19\u0e19\u0e35\u0e49\u0e21\u0e35 :kept \u0e20\u0e32\u0e1e)","new":"\u0e43\u0e2b\u0e21\u0e48","saving":"\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01...","block_formats":"\u0e22\u0e48\u0e2d\u0e2b\u0e19\u0e49\u0e32=p; \u0e2b\u0e31\u0e27\u0e02\u0e49\u0e2d\u0e43\u0e2b\u0e0d\u0e48=h2; \u0e2b\u0e31\u0e27\u0e02\u0e49\u0e2d=h3; \u0e2b\u0e31\u0e27\u0e02\u0e49\u0e2d\u0e22\u0e48\u0e2d\u0e22=h4"};
    var MAX = 60;
    var MAX_UPLOAD = 20;
    var dragging = null;

    // เลขลำดับ + จำนวนภาพ (ไม่นับภาพที่สั่งลบ)
    function refresh() {
        var n = 0;
        grid.querySelectorAll('.afe-item').forEach(function (item) {
            item.querySelector('.afe-no').textContent = item.classList.contains('is-removed') ? '-' : ++n;
        });
        document.getElementById('afe_count').textContent = n ? TXT.count.replace(':n', n) : '';
        document.getElementById('afe_empty').hidden = grid.children.length > 0;
    }

    grid.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (! btn) return;
        var item = btn.closest('.afe-item');
        if (btn.classList.contains('js-move')) {
            var sib = btn.dataset.move === '-1' ? item.previousElementSibling : item.nextElementSibling;
            // ภาพใหม่ (ยังไม่อัปโหลด) อยู่ท้ายเสมอ - ภาพเดิมเลื่อนข้ามไปหลังภาพใหม่ไม่ได้
            if (sib && ! sib.classList.contains('is-new')) {
                grid.insertBefore(btn.dataset.move === '-1' ? item : sib, btn.dataset.move === '-1' ? sib : item);
            }
        } else if (btn.classList.contains('js-remove')) {
            // ไม่ส่ง id กลับ = ลบตอนบันทึก (ปิด input ไว้ กดอีกครั้งคืนได้)
            var removed = item.classList.toggle('is-removed');
            item.querySelector('input[name="images[]"]').disabled = removed;
        }
        refresh();
    });

    // ลากสลับตำแหน่ง (เฉพาะภาพเดิม)
    grid.addEventListener('dragstart', function (e) {
        var item = e.target.closest('.afe-item');
        if (! item || item.classList.contains('is-new')) return;
        dragging = item;
        item.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', ''); } catch (err) {}
    });
    grid.addEventListener('dragover', function (e) {
        if (! dragging) return;
        var over = e.target.closest('.afe-item');
        if (! over || over === dragging || over.classList.contains('is-new')) return;
        e.preventDefault();
        var r = over.getBoundingClientRect();
        grid.insertBefore(dragging, e.clientX - r.left < r.width / 2 ? over : over.nextSibling);
    });
    grid.addEventListener('drop', function (e) { if (dragging) e.preventDefault(); });
    grid.addEventListener('dragend', function () {
        if (dragging) dragging.classList.remove('is-dragging');
        dragging = null;
        refresh();
    });

    // ภาพที่เพิ่งเลือก: แสดงตัวอย่างกรอบประต่อท้าย (เลือกใหม่ = แทนชุดเดิมที่เลือกไว้)
    input.addEventListener('change', function () {
        grid.querySelectorAll('.afe-item.is-new').forEach(function (el) { el.remove(); });
        var files = Array.prototype.slice.call(input.files || []);
        var kept = grid.querySelectorAll('.afe-item:not(.is-new):not(.is-removed)').length;
        var msg = '';
        if (files.length > MAX_UPLOAD) msg = TXT.too_many_upload.replace(':max', MAX_UPLOAD);
        else if (kept + files.length > MAX) msg = TXT.too_many.replace(':max', MAX).replace(':kept', kept);
        if (msg) {
            input.value = '';
            if (window.Swal) Swal.fire({ icon: 'warning', text: msg }); else alert(msg);
            refresh();
            return;
        }
        files.forEach(function (file) {
            var li = document.createElement('li');
            li.className = 'afe-item is-new';
            li.innerHTML = '<span class="afe-no"></span><span class="afe-tag">' + TXT.new + '</span><img alt="">';
            li.querySelector('img').src = URL.createObjectURL(file);
            grid.appendChild(li);
        });
        refresh();
    });

    form.addEventListener('submit', function () {
        if (window.tinymce) { try { tinymce.triggerSave(); } catch (e) {} }
        var btn = document.getElementById('btn_save');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> ' + TXT.saving;
    });

    // ตัวแก้ไขบทความ - แท็กชุดเดียวกับที่ server เก็บ (cleanBody)
    if (window.tinymce) {
        tinymce.init({
            selector: '#body',
            license_key: 'gpl',
            promotion: false,
            branding: false,
            menubar: false,
            height: 420,
            plugins: ['lists', 'link', 'autolink'],
            toolbar: 'blocks | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist | blockquote link | removeformat | undo redo',
            block_formats: TXT.block_formats,
            valid_elements: 'p[style],br,strong/b,em/i,u,s/strike,h2[style],h3[style],h4[style],ul,ol,li,blockquote,a[href|title|target|rel]',
            valid_styles: { '*': 'text-align' },
            link_default_target: '_blank',
            link_target_list: false,
            link_title: false,
            placeholder: document.getElementById('body').getAttribute('placeholder'),
            content_style: 'body { font-family: "IBM Plex Sans Thai", sans-serif; font-size: 15px; line-height: 1.8; } a { color: #2d66cc; }',
        });
    }

    refresh();
})();
