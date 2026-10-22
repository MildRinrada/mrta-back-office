
$(function () {
    flatpickr('#event_date',        { dateFormat: 'd/m/Y', allowInput: false });
    flatpickr('#register_deadline', { dateFormat: 'd/m/Y', allowInput: false });
    if ($('#register_start').length) flatpickr('#register_start', { dateFormat: 'd/m/Y', allowInput: false });

    tinymceinit();

    $('#frm_event').validate({
        ignore: ':hidden:not(.tinymceinit)',
        errorElement: 'div',
        errorClass: 'invalid-feedback',
        highlight:   function (el) { $(el).addClass('is-invalid').removeClass('is-valid'); },
        unhighlight: function (el) { $(el).removeClass('is-invalid').addClass('is-valid'); },
        errorPlacement: function (error, el) {
            var hint = el.siblings('.form-text');
            hint.length ? error.insertBefore(hint.first()) : error.insertAfter(el);
        },
    });

    $('.btn-submit').on('click', function () {
        // TinyMCE เก็บข้อความไว้ใน iframe ต้องเขียนกลับลง textarea ก่อน ไม่งั้นบันทึกได้ค่าว่าง
        if (window.tinymce) tinymce.triggerSave();

        if ($('#frm_event').valid()) {
            $('#frm_event').submit();
        } else {
            Swal.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบถ้วน', confirmButtonText: 'ตกลง' });
        }
    });

    $('input[name="cover_type"]').on('change', function () {
        var isUrl = $(this).val() === 'url';
        $('#panel_cover_url').toggleClass('d-none', !isUrl);
        $('#panel_cover_upload').toggleClass('d-none', isUrl);
        // แบบ URL = กล่องรูปเป็นแค่พรีวิว คลิก/ลากวางไม่ได้
        $('#cover_preview_wrap').toggleClass('is-pick-off', isUrl);
    });

    // รูปโหลดขึ้นแล้ว img_pick_script ถอด is-empty ของกรอบให้เอง
    $('#cover_file_input').on('change', function () {
        var file = this.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (e) {
            $('#cover_preview').attr('src', e.target.result);
        };
        reader.readAsDataURL(file);
    });
});
