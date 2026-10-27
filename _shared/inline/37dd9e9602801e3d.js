
    function initCatTable() {
        if ($.fn.DataTable.isDataTable('#cat-table')) {
            $('#cat-table').DataTable().clear().destroy();
        }
        $('#cat-table').DataTable({
            processing: true,
            serverSide: true,
            pageLength: 25,
            ajax: {
                url: $('#url_datatable').val(),
                type: 'POST',
                headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
            },
            columns: [
                { data: 'DT_RowIndex', orderable: false, searchable: false, width: '50px' },
                { data: 'name_display', name: 'name', orderable: true, searchable: true },
                { data: 'actions', orderable: false, searchable: false, width: '60px', className: 'text-center' },
            ],
            initComplete: function() {
                $('#cat-table thead').addClass('bg-light');
            }
        });
    }

    $(document).ready(function() {
        initCatTable();

        // DELETE
        $(document).on('click', '.delete-cat-btn', function(e) {
            e.preventDefault();
            var id   = $(this).data('id');
            var name = $(this).data('name');
            Swal.fire({
                title: "\u0e25\u0e1a\u0e2b\u0e21\u0e27\u0e14\u0e2b\u0e21\u0e39\u0e48?",
                html: "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e25\u0e1a :name \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?".replace(':name', function() { return '<strong>' + name + '</strong>'; }) + '<br><small class="text-danger">' + "\u0e01\u0e32\u0e23\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e22\u0e49\u0e2d\u0e19\u0e01\u0e25\u0e31\u0e1a\u0e44\u0e14\u0e49" + '</small>',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: "\u0e25\u0e1a",
                cancelButtonText: "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01",
            }).then(function(result) {
                if (result.isConfirmed) {
                    document.getElementById('page-preloader').classList.add('active');
                    $.ajax({
                        url: $('#url_delete').val(),
                        type: 'POST',
                        headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
                        data: { id: id },
                    }).done(function(resp) {
                        document.getElementById('page-preloader').classList.remove('active');
                        Swal.fire({ toast: true, position: 'top-end', icon: resp.notify_type, title: resp.notify_title, text: resp.notify_msg, showConfirmButton: false, timer: 3000 });
                        if (resp.status === 200) initCatTable();
                    });
                }
            });
        });
    });
