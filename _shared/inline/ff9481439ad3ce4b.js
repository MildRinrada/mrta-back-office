
    function logout() {
        event.preventDefault();
        Swal.fire({
            title: "\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: "\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a",
            cancelButtonText: "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01",
            confirmButtonColor: '#e74a3b'
        }).then((result) => {
            if (result.isConfirmed) {
                $('#logout_form').submit();
            }
        });
    }
    (function () {
        var todayLoaded    = false;
        var registerLoaded = false;
        var counts = { booking: 0, inbox: 0 };

        function paintCount() {
            var total = counts.booking + counts.inbox;
            $('#notiCount').text(total > 99 ? '99+' : total).toggle(total > 0);
            $('#countInbox').text(counts.inbox).toggle(counts.inbox > 0);
            $('#notiReadAll').toggle(counts.inbox > 0);
        }

        function loadNotiCount() {
                        $.get('/booking/admin/notification/count', function (res) {
                counts.booking = res.count_total || 0;
                paintCount();
                if (res.count_today > 0)    $('#countToday').text(res.count_today).show();
                if (res.count_register > 0) $('#countRegister').text(res.count_register).show();
            });
                        loadInbox();
        }

        // แท็บแจ้งเตือน (admin_notifications) - โหลดตอนเปิดหน้า ได้ตัวเลข + รายการพร้อมกัน
        function loadInbox() {
            $.get('/booking/admin/notification/inbox', function (res) {
                counts.inbox = res.unread || 0;
                $('#notiInbox').html(res.html);
                paintCount();
            }).fail(function () {
                $('#notiInbox').html('<div class="text-center py-4" style="color:var(--text-3);font-size:13px;">' + "\u0e42\u0e2b\u0e25\u0e14\u0e01\u0e32\u0e23\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" + '</div>');
            });
        }

        $('#notiReadAll').on('click', function (ev) {
            ev.preventDefault();
            $.post('/booking/admin/notification/read-all', { _token: $('meta[name="csrf-token"]').attr('content') }, loadInbox);
        });

        function loadToday() {
            if (todayLoaded) return;
            todayLoaded = true;
            $.get('/booking/admin/notification/today', function (res) {
                $('#notiToday').html(res.html);
            });
        }

        function loadRegister() {
            if (registerLoaded) return;
            registerLoaded = true;
            $.get('/booking/admin/notification/register', function (res) {
                $('#notiRegister').html(res.html);
            });
        }

                $('#notiDropdown').on('show.bs.dropdown', function () {
            loadToday();
        });
        
        $('#notiRegisterTab').on('shown.bs.tab', function () {
            loadRegister();
        });

        loadNotiCount();
    }());
