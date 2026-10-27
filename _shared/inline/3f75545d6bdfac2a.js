
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
        var overdueLoaded = false;
        var reserveLoaded = false;

        function loadNotiCount() {
            $.get('/belib/admin/notification/count', function (res) {
                var total = res.count_total || 0;
                $('#notiCount').text(total > 99 ? '99+' : total).toggle(total > 0);
                if (res.count_overdue > 0) $('#countOverdue').text(res.count_overdue).show();
                if (res.count_reserve > 0) $('#countReserve').text(res.count_reserve).show();
            });
        }

        function loadOverdue() {
            if (overdueLoaded) return;
            overdueLoaded = true;
            $.get('/belib/admin/notification/overdue', function (res) {
                $('#notiOverdue').html(res.html);
            });
        }

        function loadReserve() {
            if (reserveLoaded) return;
            reserveLoaded = true;
            $.get('/belib/admin/notification/reserve', function (res) {
                $('#notiReserve').html(res.html);
            });
        }

        $('#notiDropdown').on('show.bs.dropdown', function () {
            loadOverdue();
        });

        $('#notiReserveTab').on('shown.bs.tab', function () {
            loadReserve();
        });


        loadNotiCount();
    }());
