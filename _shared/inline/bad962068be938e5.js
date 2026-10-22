

// ═══ ตัวช่วยกลางของหน้าหลังบ้านเดิม (เคยอยู่ใน scripts ของธีม Metronic - ดู rpph-learnext backend/includes/scripts) ═══
// layout ใหม่ไม่มีตัวพวกนี้ หน้าที่เรียกจึงพังทั้งก้อน เช่น ฟอร์มหลักสูตรโหลดขั้นตอนไม่ขึ้นเพราะ delayLoading ไม่มี
var delayLoading = 200;

// ข้อความจากข้อมูล (ชื่อหลักสูตร/ชื่อผู้ใช้ใน data-title) ต้อง escape ก่อนต่อเข้า html ของ Swal
function escapeHtmlText(text) {
    return $('<div>').text(text == null ? '' : String(text)).html();
}

// ═══ โครงหน้าชุดใหม่ (lx-*): ฟอร์ม / สวิตช์สถานะในตาราง / ตัวอย่างรูป ═══
function lxToast(icon, text, timer) {
    Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: timer || 2500, icon: icon, titleText: String(text || '') });
}
// แจ้งผล ajax ตาม status จริง (เดิมทุกคำตอบขึ้นไอคอนสำเร็จแม้ server ตอบ 500)
function lxToastResponse(resp) {
    resp = resp || {};
    var ok = String(resp.status) === '200';
    var msg = new DOMParser().parseFromString(String(resp.notify_msg || ''), 'text/html').body.textContent || (ok ? '' : "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07");
    lxToast(ok ? 'success' : 'error', msg, ok ? 2000 : 3500);
}
// บันทึกฟอร์ม #frm_main จากปุ่มท้ายฟอร์ม (includes/ui/form_footer) - opt: 1 = กลับหน้ารายการ, 2 = เพิ่มรายการใหม่ต่อ
// ตรวจ jquery.validate (ถ้าหน้าผูกไว้) และ required ของเบราว์เซอร์ก่อน แล้วปิดปุ่มกันกดซ้ำ ถ้าสคริปต์ของหน้า preventDefault ตอน submit จะคืนปุ่มให้
function lxSubmit(opt, btn) {
    var form = document.getElementById('frm_main');
    if (!form) return;
    $('#save_option').val(opt || 1);
    if (typeof tinymce !== 'undefined') { try { tinymce.triggerSave(); } catch (e) {} }
    var $f = $(form);
    if ($f.data('validator') && !$f.valid()) { lxFocusInvalid(form); return; }
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) { lxFocusInvalid(form); return; }
    var btns = $('[data-lx-save]').prop('disabled', true);
    if (btn) btn.classList.add('is-busy');
    $f.one('submit', function (e) {
        setTimeout(function () { if (e.isDefaultPrevented()) { btns.prop('disabled', false); if (btn) btn.classList.remove('is-busy'); } }, 0);
    });
    if (form.requestSubmit) form.requestSubmit(); else $f.trigger('submit');
}
function lxFocusInvalid(form) {
    var el = form.querySelector('.is-invalid, :invalid');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { el.focus({ preventScroll: true }); } catch (e) {} }
}
// แก้ช่องแล้ว เอากรอบแดง (จาก alert_danger / validate) ออก
$(document).on('input change', '#frm_main .is-invalid', function () { this.classList.remove('is-invalid'); });

// สวิตช์สถานะในตาราง (admin_status_switch) - ส่งสถานะ "ปัจจุบัน" ให้ setStatus เดิมซึ่งสลับค่าให้เอง
$(document).on('change', '.js-row-status', function () {
    var cb = this, $box = $(cb).closest('.lx-switch');
    var old = $(cb).attr('data-status') === '1' ? 1 : 0;
    var url = $(cb).attr('data-url') || $('#page_url_set_status').val();
    function apply(v) {
        cb.checked = !!v;
        $(cb).attr('data-status', v);
        $box.toggleClass('is-on', !!v);
        var t = $box.find('.lx-switch-text'); t.text(v ? t.data('on') : t.data('off'));
    }
    if (!url) { apply(old); return; }
    $box.addClass('is-busy');
    $.ajax({
        url: url, method: 'POST', dataType: 'json',
        headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
        data: { id: $(cb).attr('data-id'), status: old },
    }).done(function (r) {
        if (r && String(r.status) === '200') { apply(old ? 0 : 1); lxToast('success', "\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e41\u0e25\u0e49\u0e27", 1800); }
        else { apply(old); lxToastResponse(r); }
    }).fail(function () {
        apply(old); lxToast('error', "\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07", 3500);
    }).always(function () { $box.removeClass('is-busy'); });
});

// ตัวอย่างรูปทันทีที่เลือกไฟล์ (includes/ui/image_input)
// input ย้ายเข้าไปอยู่ในกล่องตัวอย่างแล้ว (data-img-pick) - หา .lx-img-body จากกรอบ .lx-img แทน
$(document).on('change', 'input[type=file][data-lx-preview]', function () {
    var wrap = this.closest('.lx-img'), body = wrap && wrap.querySelector('.lx-img-body'), box = document.querySelector(this.dataset.lxPreview), f = this.files && this.files[0];
    if (!box) return;
    if (!f) { if (body) body.classList.remove('is-changed'); return; }
    if (!/^image\//.test(f.type)) return;
    box.querySelector('img').src = URL.createObjectURL(f);
    box.classList.add('has-image');
    box.classList.remove('is-placeholder');
    if (body) body.classList.add('is-changed');
});

// ═══ กล่องรูปแบบคลิก / ปุ่มกล้อง / ลากไฟล์มาวาง แทนปุ่ม "Choose File" (ชุดเดียวกับ portal / belib / auth) ═══
// [data-img-pick] ที่มี input[type=file] อยู่ข้างใน (includes/ui/img_pick) หรือใส่ selector เป็นค่า เช่น data-img-pick="#cover"
// วางไฟล์ = เขียนเข้า input แล้วยิง change ให้สคริปต์พรีวิว/ตัดรูปเดิมของแต่ละหน้าทำงานเหมือนเลือกไฟล์เอง
// .img-pick-wrap.is-empty: รูปในกรอบโหลดขึ้นเมื่อไหร่ ถอด is-empty เอง / .img-pick-zone: แสดงชื่อไฟล์ใน .img-pick-file
// ใช้ event delegation - ส่วนที่โหลดทีหลัง (ขั้นตอนหลักสูตรที่โหลดด้วย ajax, modal) ใช้ได้ทันที
(function () {
    var MSG_BAD = "\u0e44\u0e1f\u0e25\u0e4c\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e0a\u0e19\u0e34\u0e14\u0e17\u0e35\u0e48\u0e0a\u0e48\u0e2d\u0e07\u0e19\u0e35\u0e49\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a";

    function inputOf(box) {
        var sel = box.getAttribute('data-img-pick');
        return sel ? document.querySelector(sel) : box.querySelector('input[type=file]');
    }
    // :disabled รวมกรณีอยู่ใน fieldset ที่ถูกปิด (เช่นการ์ดลายเซ็นที่เกินจำนวนในแม่แบบใบประกาศ)
    function usable(box) {
        var input = box && inputOf(box);
        return input && !input.matches(':disabled') && !box.classList.contains('is-pick-off') ? input : null;
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
    function outsideDrop(e) {
        return !(e.target.closest && e.target.closest('input[type=file]'));
    }

    document.addEventListener('click', function (e) {
        var box = e.target.closest && e.target.closest('[data-img-pick]');
        if (!box || e.target.closest('input[type=file]')) return;
        // ปุ่ม/ลิงก์อื่นในกล่องทำงานของมันเอง - ยกเว้นปุ่มกล้อง
        if (!e.target.closest('.img-pick-cam') && e.target.closest('button, a, input, select, textarea, label')) return;
        var input = usable(box);
        if (!input) return;
        e.preventDefault();
        input.click();
    });

    // กล่องที่เป็นปุ่มเอง (role=button เช่น .img-pick-zone) - Enter / Space เปิดเลือกไฟล์
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
        if (!dropped.length) { lxToast('error', MSG_BAD, 3000); return; }
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
    function syncBoxes(input) {
        var file = input.files && input.files[0];
        document.querySelectorAll('.img-pick-zone, [data-img-pick-auto]').forEach(function (box) {
            if (inputOf(box) !== input) return;
            var out = box.querySelector('.img-pick-file');
            if (out) out.textContent = Array.prototype.map.call(input.files || [], function (f) { return f.name; }).join(', ');
            var img = box.hasAttribute('data-img-pick-auto') && box.querySelector('img');
            if (img && file && /^image\//.test(file.type)) img.src = URL.createObjectURL(file);
        });
    }
    document.addEventListener('change', function (e) {
        if (e.target.matches && e.target.matches('input[type=file]')) syncBoxes(e.target);
    });
    // ฟอร์มถูก reset (เช่น modal ปฏิทินเปิดใหม่) - ไฟล์ใน input หาย แต่ไม่มี change ให้ล้างชื่อไฟล์ที่ค้างอยู่
    document.addEventListener('reset', function (e) {
        var form = e.target;
        setTimeout(function () { form.querySelectorAll('input[type=file]').forEach(syncBoxes); }, 0);
    });

    // รูปในกรอบโหลดขึ้น (พรีวิวตั้ง src ให้) = มีรูปแล้ว
    // ยกเว้นภาพเริ่มต้น (/images/placeholder/ เช่นรูปโปรไฟล์เริ่มต้นของ getAvatar) - แสดงกรอบว่างแทน (กรอบต้องมี .img-pick-empty)
    document.addEventListener('load', function (e) {
        if (!e.target || e.target.tagName !== 'IMG' || !e.target.getAttribute('src')) return;
        var wrap = e.target.closest('.img-pick-wrap');
        if (!wrap) return;
        var placeholder = /\/images\/placeholder\//.test(e.target.src) && wrap.querySelector('.img-pick-empty');
        wrap.classList.toggle('is-empty', !!placeholder);
    }, true);
})();

// บันทึกฟอร์มหลัก (#frm_main) - หน้าที่มีฟังก์ชันชื่อเดียวกันของตัวเองจะใช้ของหน้านั้นแทน
function save(opt) {
    $('#btn_save').prop('disabled', true).text('กำลังบันทึก...');
    $('#save_option').val(opt || 1);
    $('#frm_main').submit();
}
function saveAndContinue() { save(2); }

// แจ้งผลจาก ajax (resp.notify_type / notify_title / notify_msg) เป็น toast มุมขวาบน
function showNotifyOnScreen(resp) {
    resp = resp || {};
    var icon = { success: 'success', danger: 'error', error: 'error', warning: 'warning', info: 'info' }[resp.notify_type] || 'info';
    // แปลง notify_msg (อาจมี <strong> และชื่อที่ผู้ใช้ตั้ง) เป็นข้อความด้วย DOMParser - เอกสารที่ parse แบบนี้ไม่รันสคริปต์/ไม่โหลดรูป
    // (เดิม $('<div>').html(...) สร้าง element ในหน้าจริง <img onerror> จึงทำงานได้)
    var plain = new DOMParser().parseFromString(String(resp.notify_msg || ''), 'text/html').body.textContent || '';
    Swal.fire({
        toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, icon: icon,
        titleText: resp.notify_title || '', text: plain,
    });
}

// คัดลอกรายการ (เมนู ... > Duplicate ในหน้ารายการหลักสูตร) - URL อยู่ที่ #page_url_duplicate
function duplicateItem(e) {
    var id = $(e).data('id');
    var title = $('<div>').text($(e).data('title') || '').html(); // .data() ถอด entity แล้ว - escape ก่อนต่อเป็น HTML ของ Swal
    Swal.fire({
        title: 'ยืนยันการคัดลอก?',
        html: 'ต้องการคัดลอก <strong>' + $('<div>').text(title).html() + '</strong> ใช่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4e73df',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'คัดลอก',
        cancelButtonText: 'ยกเลิก',
    }).then(function (result) {
        if (!result.value) return;
        initpreload();
        $.ajax({
            url: $('#page_url_duplicate').val(),
            method: 'POST',
            headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
            data: { id: id, name: "งานที่มอบหมาย", lang: "th" },
            dataType: 'json',
        }).done(function (response) {
            if (response.status == '200' && typeof initDataTable === 'function') initDataTable();
            showNotifyOnScreen(response);
        }).always(closepreload);
    });
}

// ลบด้วย URL ที่ติดมากับปุ่ม (data-url) แทน #page_url_delete - ใช้ในตารางผู้ได้รับใบประกาศ
function deleteItem_url(e) {
    Swal.fire({
        title: 'ยืนยันการลบ?',
        html: '<small class="text-danger">ข้อมูลจะถูกลบถาวร ไม่สามารถกู้คืนได้</small>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
    }).then(function (result) {
        if (!result.value) return;
        initpreload();
        $.ajax({
            url: $(e).data('url'),
            method: 'POST',
            headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
            data: { id: $(e).data('id'), name: "งานที่มอบหมาย", lang: "th" },
            dataType: 'json',
        }).done(function (response) {
            if (response.status == '200' && typeof initDataTable === 'function') initDataTable();
            showNotifyOnScreen(response);
        }).always(closepreload);
    });
}

function deleteItem(e)
{
    var id = $(e).data('id');
    var id2 = $(e).data('id2');
    var url = $('#page_url_delete').val();
    var isleaf = $(e).attr('data-isleaf');

    var title = $('<div>').text($(e).data('title') || '').html(); // .data() ถอด entity แล้ว - escape ก่อนต่อเป็น HTML ของ Swal
    var extraText = '';
    if (typeof isleaf !== typeof undefined && isleaf !== false) {
        if (isleaf != '1') extraText = 'เมนูนี้และเมนูย่อยทั้งหมดจะถูกลบออก';
    }

    Swal.fire({
        title: 'ยืนยันการลบ?',
        html: 'ต้องการลบ <strong>' + escapeHtmlText(title) + '</strong> ใช่หรือไม่?'
            + (extraText ? '<br><small class="text-danger">' + extraText + '</small>' : '')
            + '<br><small class="text-danger">ข้อมูลจะถูกลบถาวร ไม่สามารถกู้คืนได้</small>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
    }).then((result) => {
        if (result.value) {
            initpreload();
            $.ajaxSetup({
                headers: {
                    'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
                }
            });
            $.ajax({
                url: url,
                method: 'POST',
                data: { id: id, id2: id2, name: "งานที่มอบหมาย", lang: "th" },
                dataType: 'json',
            }).done(function(response) {
                if (response.status == '200' && typeof initDataTable === 'function') initDataTable();
                lxToastResponse(response);
            }).fail(function () {
                lxToast('error', "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07", 3500);
            }).always(closepreload);
        }
    })
}

function tinymceinit() {
    tinymce.init({
        selector: '.tinymceinit',
        license_key: 'gpl',
        promotion: false,
        branding: false,
        menubar: false,
        height: 420,
        plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'visualchars', 'code',
            'fullscreen', 'insertdatetime', 'media', 'table', 'wordcount',
            'emoticons', 'codesample', 'directionality', 'nonbreaking',
            'pagebreak', 'quickbars', 'accordion'
        ],
        toolbar: [
            'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | removeformat',
            'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ltr rtl | blockquote codesample',
            'link image media table insertdatetime charmap emoticons | searchreplace | visualblocks visualchars | fullscreen code preview | accordion'
        ],
        toolbar_mode: 'sliding',
        placeholder: 'เริ่มพิมพ์เนื้อหาที่นี่...',
        font_family_formats:
            'IBM Plex Sans Thai=IBM Plex Sans Thai,sans-serif;' +
            'Sarabun=Sarabun,sans-serif;' +
            'Noto Sans Thai=Noto Sans Thai,sans-serif;' +
            'Prompt=Prompt,sans-serif;' +
            'Kanit=Kanit,sans-serif;' +
            'Mitr=Mitr,sans-serif;' +
            'Anuphan=Anuphan,sans-serif;' +
            'Arial=Arial,Helvetica,sans-serif;' +
            'Georgia=Georgia,serif;' +
            'Tahoma=Tahoma,Geneva,sans-serif;' +
            'Times New Roman=Times New Roman,Times,serif;' +
            'Trebuchet MS=Trebuchet MS,sans-serif;' +
            'Verdana=Verdana,Geneva,sans-serif;' +
            'JetBrains Mono=JetBrains Mono,monospace;' +
            'Courier New=Courier New,Courier,monospace',
        content_css: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Sarabun:wght@300;400;600&family=Noto+Sans+Thai:wght@300;400;600&family=Prompt:wght@300;400;600&family=Kanit:wght@300;400;600&family=Mitr:wght@300;400;600&family=Anuphan:wght@300;400;600&family=JetBrains+Mono:wght@400;500&display=swap',
        image_advtab: true,
        image_caption: true,
        image_uploadtab: true,
        media_live_embeds: true,
        file_picker_types: 'image media',
        file_picker_callback: function (callback, value, meta) {
            const input = document.createElement('input');
            input.type = 'file';
            if (meta.filetype === 'image') {
                input.accept = 'image/*';
                input.onchange = function () {
                    const file = this.files[0];
                    const reader = new FileReader();
                    reader.onload = function () { callback(reader.result, { title: file.name }); };
                    reader.readAsDataURL(file);
                };
            } else if (meta.filetype === 'media') {
                input.accept = 'video/*,audio/*';
                input.onchange = function () {
                    const file = this.files[0];
                    callback(URL.createObjectURL(file), { title: file.name });
                };
            }
            input.click();
        },
        quickbars_selection_toolbar: 'bold italic | quicklink h2 h3 blockquote quickimage quicktable',
        contextmenu: 'link image table configurepermanentpen',
        table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol',
        content_style: 'body{font-family:"IBM Plex Sans Thai",sans-serif;font-size:14px;color:#2d3436;line-height:1.7;background:#ffffff;caret-color:#2d3436;cursor:text;}'
    });
}


function toggleStatus(e)
{
    var id = $(e).data('id');
    var status = $(e).data('status');
    var url = $('#page_url_set_status').val();

    Swal.fire({
        title: status == '1' ? 'ปิดใช้งาน?' : 'เปิดใช้งาน?',
        html: (status == '1' ? 'ต้องการ<strong>ปิดใช้งาน</strong>' : 'ต้องการ<strong>เปิดใช้งาน</strong>') + ' <strong>' + escapeHtmlText($(e).data('title')) + '</strong> ใช่หรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: status == '1' ? '#d33' : '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: status == '1' ? 'ปิดใช้งาน' : 'เปิดใช้งาน',
        cancelButtonText: 'ยกเลิก',
    }).then((result) => {
        if (result.isConfirmed) {
            initpreload();
            $.ajaxSetup({
                headers: {
                    'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
                }
            });
            $.ajax({
                url: url,
                method: 'POST',
                data: { id: id, status: status, name: "งานที่มอบหมาย", lang: "th" },
                dataType: 'json',
            }).done(function(response) {
                if (response.status == '200' && typeof initDataTable === 'function') initDataTable();
                lxToastResponse(response);
            }).fail(function () {
                lxToast('error', "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07", 3500);
            }).always(closepreload);
        }
    })
}


function toggleInCenter(e)
{
    var id = $(e).data('id');
    var status = $(e).data('status');
    var url = $('#page_url_set_in_center').val();

    Swal.fire({
        title: status == '1' ? 'ปิดใช้งาน?' : 'เปิดใช้งาน?',
        html: (status == '1' ? 'ต้องการ<strong>ปิดใช้งาน</strong>' : 'ต้องการ<strong>เปิดใช้งาน</strong>') + ' <strong>' + escapeHtmlText($(e).data('title')) + '</strong> ใช่หรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: status == '1' ? '#d33' : '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: status == '1' ? 'ปิดใช้งาน' : 'เปิดใช้งาน',
        cancelButtonText: 'ยกเลิก',
    }).then((result) => {
        if (result.value) {
            initpreload();
            $.ajaxSetup({
                headers: {
                    'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
                }
            });
            $.ajax({
                url: url,
                method: 'POST',
                data: { id: id, status: status, name: "งานที่มอบหมาย", lang: "th" },
                dataType: 'json',
            }).done(function(response) {
                if (response.status == '200' && typeof initDataTable === 'function') initDataTable();
                lxToastResponse(response);
            }).fail(function () {
                lxToast('error', "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07", 3500);
            }).always(closepreload);
        }
    })
}
