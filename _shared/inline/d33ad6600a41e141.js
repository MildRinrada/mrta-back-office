
    // Tag-style checkbox toggle
    (function() {
        function isTagChecked($label) {
            return $label.find('input[type=checkbox]').is(':checked');
        }
        function setTag($label, checked) {
            $label.find('input[type=checkbox]').prop('checked', checked);
            $label.toggleClass('active', checked);
        }
        function syncAll() {
            var $items = $('.chk_pm_item');
            var allChecked = $items.length > 0 && $items.filter(function() { return isTagChecked($(this)); }).length === $items.length;
            setTag($('#tag_pm_all'), allChecked);
        }

        $('#tag_pm_all').on('click', function() {
            var nowChecked = !isTagChecked($(this));
            setTag($(this), nowChecked);
            $('.chk_pm_item').each(function() { setTag($(this), nowChecked); });
        });

        $(document).on('click', '.chk_pm_item', function() {
            setTag($(this), !isTagChecked($(this)));
            syncAll();
            if ($('.chk_pm_item input:checkbox:checked').length > 0) {
                $('#err_product_main_ids').addClass('d-none');
            }
        });

        syncAll();
    })();

    // Icon preview
    $('#icon_file_input').on('change', function() {
        var file = this.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                $('#icon_preview_wrap').show();
                $('#icon_preview_img').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Form validate
    $('#frm_category').on('submit', function(e) {
        $(this).validate({
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
        var nameValid = $(this).valid();

        var $pmError   = $('#err_product_main_ids');
        var pmRequired = $pmError.length > 0;
        var pmValid    = !pmRequired || $('.chk_pm_item input:checkbox:checked').length > 0;
        $pmError.toggleClass('d-none', pmValid);

        if (!nameValid || !pmValid) {
            e.preventDefault();
            Swal.fire({
                icon: 'warning',
                title: "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a\u0e16\u0e49\u0e27\u0e19",
                text: "\u0e42\u0e1b\u0e23\u0e14\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e41\u0e25\u0e30\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a\u0e16\u0e49\u0e27\u0e19",
                confirmButtonText: "\u0e15\u0e01\u0e25\u0e07"            });
            var firstInvalid = $(this).find('.is-invalid').first();
            if (!firstInvalid.length && !pmValid) {
                firstInvalid = $pmError;
            }
            if (firstInvalid.length) {
                $('html, body').animate({ scrollTop: firstInvalid.offset().top - 100 }, 300);
            }
        }
    });
