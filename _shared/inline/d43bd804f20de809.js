
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
        var loaded = {};
        var failed = '<div class="text-center py-4" style="color:var(--text-3);font-size:13px;">' + "\u0e42\u0e2b\u0e25\u0e14\u0e01\u0e32\u0e23\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" + '</div>';
        function badge(sel, n) { $(sel).text(n > 99 ? '99+' : n).toggle(n > 0); }

        function loadCount() {
            $.get('/learnext/admin/notification/count', function (res) {
                badge('#notiCount', res.total || 0);
                badge('#countInbox', res.inbox || 0);
                badge('#countEnrol', res.enrol || 0);
                badge('#countGrade', res.grade || 0);
                $('#notiReadAll').toggle((res.inbox || 0) > 0);
            });
        }

        function loadPane(key, url, force) {
            if (loaded[key] && !force) return;
            loaded[key] = true;
            $.get(url, function (res) { $('#' + key).html(res.html); }).fail(function () { $('#' + key).html(failed); });
        }

        $('#notiDropdown').on('show.bs.dropdown', function () { loadPane('notiInbox', '/learnext/admin/notification/inbox'); });
        $('#notiEnrolTab').on('shown.bs.tab', function () { loadPane('notiEnrol', '/learnext/admin/notification/enrol'); });
        $('#notiGradeTab').on('shown.bs.tab', function () { loadPane('notiGrade', '/learnext/admin/notification/grade'); });

        $('#notiReadAll').on('click', function (ev) {
            ev.preventDefault();
            $.post('/learnext/admin/notification/read-all', { _token: $('meta[name="csrf-token"]').attr('content') }, function () {
                loadCount();
                loadPane('notiInbox', '/learnext/admin/notification/inbox', true);
            });
        });

        loadCount();
    }());
