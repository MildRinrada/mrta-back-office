
    //init cookie
    $(document).ready(function() {
        if($('.cookie-nav').hasClass('d-none')){
            $('.cookie-open-setting').removeClass('d-none');
        }

        
    });


    function saveConsent(action){
        if (!"") { $('#myModalConsentInfo').modal('hide'); return; }
        $('.btn-consent').prop('disabled', true);
        $.ajax({
            type: 'POST',
            url: "",
            data: {
                _token: "demo-token",
                action:action
            },
            dataType: "json",
            success: function(data) {
                $('.btn-consent').prop('disabled', false);
                $('#myModalConsentInfo').modal('hide')
            }
        });
    }

    $('.toggle-setting').on('click', function(){
        $('.cookie-sidebar').toggleClass('closed')
    });

    $('.btn-save-setting, .btn-save-cookie').on('click', function(){
        var cookiePerformance = $('#cookiePerformance').is(":checked");
        var cookieFunctional = $('#cookieFunctional').is(":checked");
        // ไม่มี endpoint บันทึก - ปิดแถบเฉพาะหน้านี้ไปก่อน (เดิมยิงแล้ว 500 แถบค้างอยู่)
        if (!"") {
            $('.cookie-nav').fadeOut().addClass('d-none');
            $('.cookie-sidebar').addClass('closed');
            $('.cookie-open-setting').removeClass('d-none');
            return;
        }
        $.ajax({
            type: 'POST',
            url: "",
            data: {
                _token: "demo-token",
                cookiePerformance:cookiePerformance,
                cookieFunctional:cookieFunctional,
            },
            dataType: "json",
            success: function(data) {
                $('.cookie-nav').fadeOut().addClass('d-none');
                $('.cookie-sidebar').addClass('closed');
                $('.cookie-open-setting').removeClass('d-none');
            }
        });
    });


