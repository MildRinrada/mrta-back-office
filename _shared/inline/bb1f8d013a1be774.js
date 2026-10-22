
    // Flatpickr date picker
    flatpickr('#published_at', {
        dateFormat: 'd/m/Y',
        allowInput: true,
    });

    // Cover type toggle
    $('input[name="cover_type"]').on('change', function() {
        $('#cover_preview_wrap').toggleClass('is-pick-off', $(this).val() === 'url');
        if ($(this).val() === 'url') {
            $('#panel_cover_upload').addClass('d-none');
            $('#panel_cover_url').removeClass('d-none');
        } else {
            $('#panel_cover_url').addClass('d-none');
            $('#panel_cover_upload').removeClass('d-none');
        }
    });

    // Cover file preview
    $('#cover_file_input').on('change', function() {
        var file = this.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                $('#cover_preview_wrap').show().find('img').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Cover URL preview on blur
    $('input[name="cover_url"]').on('blur', function() {
        var url = $(this).val();
        if (url) {
            $('#cover_preview_wrap').show().find('img').attr('src', url);
        }
    });

    // TomSelect - Publisher
    var tsPublisher = new TomSelect('#ts_publisher', {
        allowEmptyOption: true,
        placeholder: '- ไม่ระบุ -',
        create: function(input, callback) {
            $.ajax({
                url: '/belib/admin/master/publisher/quick-store',
                type: 'POST',
                headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
                data: { name: input },
            }).done(function(resp) {
                if (resp.status === 200) {
                    callback({ value: resp.id, text: resp.name });
                } else {
                    callback();
                }
            }).fail(function() {
                callback();
            });
        },
        createOnBlur: false,
        createFilter: function(input) { return input.trim().length > 0; },
    });

    

    // TomSelect - Tags
    new TomSelect('#ts_tags', {
        plugins: ['remove_button'],
        create: true,
        persist: false,
        maxOptions: null,
        placeholder: 'พิมพ์เพื่อค้นหาหรือเพิ่ม tag...',
        render: {
            no_results: function() {
                return '<div class="no-results">ไม่พบ - กด Enter เพื่อสร้าง tag ใหม่</div>';
            },
        },
    });

    // TomSelect - Callnumber (082a)
    $('.ts-callnumber').each(function() {
        new TomSelect(this, {
            allowEmptyOption: true,
            valueField: 'id',
            labelField: 'text',
            searchField: 'text',
            load: function(query, callback) {
                fetch('/belib/admin/setting/call-number/callnumbers/search?q=' + encodeURIComponent(query))
                    .then(r => r.json())
                    .then(data => callback(data.results || data))
                    .catch(() => callback());
            },
            placeholder: 'พิมพ์เพื่อค้นหา Callnumber...',
            preload: true,
            create: true, // Allow user to just type free text if not in DB, since it's a string field
        });
    });

    // TomSelect - Categories
    new TomSelect('#ts_categories', {
        plugins: ['remove_button'],
        create: true,
        persist: false,
        maxOptions: null,
        placeholder: 'พิมพ์เพื่อค้นหาหรือเพิ่มหมวดหมู่...',
        render: {
            no_results: function() {
                return '<div class="no-results">ไม่พบ - กด Enter เพื่อสร้างหมวดหมู่ใหม่</div>';
            },
        },
    });

    // TomSelect - Creators (AJAX per category)
    
    // Form validate
    $('#frm_product').on('submit', function(e) {
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
        if (!$(this).valid()) {
            e.preventDefault();
            Swal.fire({
                icon: 'warning',
                title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
                text: 'โปรดตรวจสอบและกรอกข้อมูลที่จำเป็นให้ครบถ้วน',
                confirmButtonText: 'ตกลง'
            });
            var firstInvalid = $(this).find('.is-invalid').first();
            if (firstInvalid.length) {
                $('html, body').animate({ scrollTop: firstInvalid.offset().top - 100 }, 300);
            }
        }
    });
