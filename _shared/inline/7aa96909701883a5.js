
$(function () {
    if (window.flatpickr) {
        var th = (flatpickr.l10ns && flatpickr.l10ns.th) ? 'th' : 'default';
        flatpickr('.js-date', { dateFormat: 'Y-m-d', allowInput: true, locale: th });
    }

    // พรีวิวรูปที่จะเพิ่มเข้าอัลบั้ม (ยังไม่อัปโหลดจนกว่าจะกดบันทึก)
    $('#images').on('change', function () {
        var wrap = $('#images_preview').empty();
        Array.prototype.forEach.call(this.files || [], function (file) {
            $('<div class="col-4 col-md-3 col-xl-2">').append(
                $('<img class="w-100 rounded border" style="aspect-ratio:16/9;object-fit:cover;" alt="">').attr('src', URL.createObjectURL(file))
            ).appendTo(wrap);
        });
    });

    // ลบรูปในอัลบั้มทันที (ajax) - ไม่ต้องรอกดบันทึก
    $(document).on('click', '.js-delete-image', function () {
        var btn = $(this);
        var cell = btn.closest('[data-image-id]');
        Swal.fire({
            title: 'ลบรูปนี้ออกจากอัลบั้ม?',
            text: 'กู้คืนไม่ได้',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74a3b',
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก',
            reverseButtons: true,
        }).then(function (r) {
            if (!r.isConfirmed) return;
            $.post(btn.data('url'), { _token: $('meta[name="csrf-token"]').attr('content') })
                .done(function (res) {
                    cell.remove();
                    $('#image_count').text('(' + $('[data-image-id]').length + ' รูป)');
                    Swal.fire({ toast: true, position: 'top-end', icon: res.notify_type, title: res.notify_msg, showConfirmButton: false, timer: 2000 });
                })
                .fail(function () {
                    Swal.fire({ icon: 'error', title: 'ลบรูปไม่สำเร็จ', text: 'กรุณาลองใหม่อีกครั้ง' });
                });
        });
    });
});
