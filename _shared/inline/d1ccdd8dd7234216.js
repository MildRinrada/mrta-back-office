
    $(document).ready(function () {
        $('#frm_main').validate({
            ignore: ':hidden:not([name="publisher_id"])',
            errorElement: 'div',
            errorClass: 'invalid-feedback',
            highlight: function(element) {
                $(element).addClass('is-invalid').removeClass('is-valid');
                $(element).next('.ts-wrapper').addClass('is-invalid');
            },
            unhighlight: function(element) {
                $(element).removeClass('is-invalid').addClass('is-valid');
                $(element).next('.ts-wrapper').removeClass('is-invalid');
            },
            errorPlacement: function(error, element) {
                var tsWrapper = element.next('.ts-wrapper');
                if (tsWrapper.length) {
                    error.insertAfter(tsWrapper);
                } else {
                    var hintDiv = element.siblings('.mt-1, .my-2, .form-text');
                    if (hintDiv.length) {
                        error.insertBefore(hintDiv.first());
                    } else {
                        error.insertAfter(element);
                    }
                }
            }
        });
    });

    function validate() {
        if ($('#frm_main').valid()) {
            Preloader.show();
            $('#frm_main').submit();
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
                text: 'โปรดตรวจสอบและกรอกข้อมูลที่จำเป็นให้ครบถ้วน',
                confirmButtonText: 'ตกลง'
            });
            var firstInvalid = document.querySelector('.is-invalid');
            if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    new TomSelect('#ts_publisher', {
        allowEmptyOption: true,
        placeholder: '- เลือกสำนักพิมพ์ -',
        onChange: function() {
            $('#ts_publisher').valid();
        }
    });
