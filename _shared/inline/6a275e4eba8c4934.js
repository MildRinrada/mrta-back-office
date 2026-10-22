
    // วิดีโอ / GIF - ดักไว้ก่อนถึงกล่องตัดรูป แล้วเปิดกล่องครอปวิดีโอ (รูปนิ่งยังผ่านกล่องตัดรูปเดิม)
    BannerMediaCropper.attach({
        input:   '#formFile',
        modal:   '#modal_crop_banner_media',
        preview: '#banner_preview_wrap',
        config:  {"ffmpeg":false,"videoExts":["mp4","webm"],"webExts":["mp4","webm"],"maxVideoKb":102400,"presets":[{"key":"banner","label":"","width":3840,"height":1100}],"presetKey":null},
        current: {"type":"image","image_url":null,"video_url":null,"mime":null,"poster_url":null,"crop":null,"width":null,"height":null,"transcoded":false,"preset":null},
    });

    // เลือกไฟล์แล้วเปิดกล่องตัดรูปก่อน แล้วเขียนไฟล์ที่ตัดแล้วกลับเข้า input เดิม
    ImageCropper.attach({
        input:   '#formFile',
        modal:   '#modal_crop_banner',
        preview: '#banner_preview',
        width:   3840,
        height:  1100,
    });

    // กล่องพรีวิวถูกซ่อนไว้ตอนยังไม่มีรูป ต้องเปิดให้เห็นเมื่อตัดรูปเสร็จ
    $('#modal_crop_banner').on('hidden.bs.modal', function() {
        if ($('#formFile')[0].files.length) $('#banner_preview_wrap').show();
    });

    $('#frm_banner').validate({
        errorElement: 'div',
        errorClass: 'invalid-feedback',
        highlight: function(element) {
            $(element).addClass('is-invalid').removeClass('is-valid');
        },
        unhighlight: function(element) {
            $(element).removeClass('is-invalid').addClass('is-valid');
        },
        errorPlacement: function(error, element) {
            var hintDiv = element.siblings('.mt-1, .my-2, .form-text');
            if (hintDiv.length) {
                error.insertBefore(hintDiv.first());
            } else {
                error.insertAfter(element);
            }
        }
    });

    function showValidationAlert() {
        Swal.fire({
            icon: 'warning',
            title: "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a\u0e16\u0e49\u0e27\u0e19",
            text: "\u0e42\u0e1b\u0e23\u0e14\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e41\u0e25\u0e30\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a\u0e16\u0e49\u0e27\u0e19",
            confirmButtonText: "\u0e15\u0e01\u0e25\u0e07"        });
        var firstInvalid = $('#frm_banner .is-invalid').first();
        if (firstInvalid.length) {
            $('html, body').animate({ scrollTop: firstInvalid.offset().top - 100 }, 300);
        }
    }

    function submitForm() {
        if ($('#frm_banner').valid()) {
            $('#frm_banner').submit();
        } else {
            showValidationAlert();
        }
    }

    $('#frm_banner').on('submit', function(e) {
        if (!$(this).valid()) {
            e.preventDefault();
            showValidationAlert();
        }
    });
