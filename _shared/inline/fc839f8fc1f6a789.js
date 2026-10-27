
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
        var counts = { inbox: 0, security: 0 };
        var securityLoaded = false;

        function paintCount() {
            var total = counts.inbox + counts.security;
            $('#notiCount').text(total > 99 ? '99+' : total).toggle(total > 0);
            $('#countInbox').text(counts.inbox).toggle(counts.inbox > 0);
            $('#notiReadAll').toggle(counts.inbox > 0);
        }

        // แท็บแจ้งเตือน: โหลดตอนเปิดหน้า (ได้ตัวเลข + รายการพร้อมกัน)
        function loadInbox() {
            $.get('/portal/admin/notification/inbox', function (res) {
                counts.inbox = res.unread || 0;
                $('#notiInbox').html(res.html);
                paintCount();
            }).fail(function () {
                $('#notiInbox').html('<div class="text-center py-4" style="color:var(--text-3);font-size:13px;">' + "\u0e42\u0e2b\u0e25\u0e14\u0e01\u0e32\u0e23\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" + '</div>');
            });
        }
        loadInbox();

        $('#notiReadAll').on('click', function (ev) {
            ev.preventDefault();
            $.post('/portal/admin/notification/read-all', { _token: $('meta[name="csrf-token"]').attr('content') }, loadInbox);
        });

            }());
