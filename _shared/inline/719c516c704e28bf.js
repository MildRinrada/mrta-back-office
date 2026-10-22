
    var validateConfig = {
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
    };

    function showValidationAlert() {
        Swal.fire({
            icon: 'warning',
            title: "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a\u0e16\u0e49\u0e27\u0e19",
            text: "\u0e42\u0e1b\u0e23\u0e14\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e41\u0e25\u0e30\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a\u0e16\u0e49\u0e27\u0e19",
            confirmButtonText: "\u0e15\u0e01\u0e25\u0e07"        });
        var firstInvalid = $('#frm_main .is-invalid').first();
        if (firstInvalid.length) {
            $('html, body').animate({ scrollTop: firstInvalid.offset().top - 100 }, 300);
        }
    }

    function saveAndAddNew() {
        $('#save_option').val(2);
        $('#frm_main').validate(validateConfig);
        if ($('#frm_main').valid()) {
            $('#frm_main').submit();
        } else {
            showValidationAlert();
            $('#save_option').val(1);
        }
    }

    $('#frm_main').on('submit', function(e) {
        $(this).validate(validateConfig);
        if (!$(this).valid()) {
            e.preventDefault();
            showValidationAlert();
        }
    });

    $('#logo_input').on('change', function() {
        var file = this.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                $('#logo_preview_wrap').show();
                $('#logo_preview_img').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
