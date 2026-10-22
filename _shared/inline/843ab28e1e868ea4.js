
(function () {
    var tsRelated = null;

    function initRelatedTable() {
        if ($.fn.DataTable.isDataTable('#related-table')) {
            $('#related-table').DataTable().clear().destroy();
        }
        $('#related-table').DataTable({
            processing: true,
            serverSide: true,
            pageLength: 25,
            order: [[3, 'asc']],
            ajax: {
                url:  $('#url_related_datatable').val(),
                type: 'POST',
                headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
            },
            columns: [
                { data: 'DT_RowIndex',      orderable: false, searchable: false, width: '50px' },
                { data: 'product_main_name', name: 'product_main_name', orderable: false, searchable: false, width: '100px' },
                { data: 'cover_html',        orderable: false, searchable: false, width: '70px' },
                { data: 'title_action',      name: 'title', orderable: true, searchable: true },
                { data: 'status_html',       name: 'status', orderable: false, searchable: false, width: '100px' },
                { data: 'actions',           orderable: false, searchable: false, width: '60px', className: 'text-center' },
            ],
            initComplete: function () {
                $('#related-table thead').addClass('bg-light');
            }
        });
    }

    function initTomSelect() {
        tsRelated = new TomSelect('#ts_related_search', {
            valueField: 'id',
            labelField: 'title',
            searchField: 'title',
            placeholder: 'ค้นหาชื่อ product เพื่อเชื่อมโยง...',
            load: function (query, callback) {
                if (!query.trim()) return callback();
                fetch($('#url_related_typeahead').val() + '?q=' + encodeURIComponent(query))
                    .then(r => r.json())
                    .then(data => callback(data))
                    .catch(() => callback());
            },
            render: {
                option: function (item) {
                    return '<div><span class="text-muted me-1" style="font-size:11px;">' + item.product_main_name + '</span> ' + item.title + '</div>';
                },
                item: function (item) {
                    return '<div>' + item.title + '</div>';
                },
            },
            shouldLoad: function (query) { return query.trim().length >= 1; },
        });
    }

    window.addRelatedItem = function () {
        var siblingId = tsRelated ? tsRelated.getValue() : null;
        if (!siblingId) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'กรุณาเลือก product ที่ต้องการเชื่อมโยง', showConfirmButton: false, timer: 2500 });
            return;
        }
        $.ajax({
            url:     $('#url_related_store').val(),
            type:    'POST',
            headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
            data:    { product_sibling_id: siblingId },
        }).done(function (resp) {
            Swal.fire({ toast: true, position: 'top-end', icon: resp.notify_type, title: resp.notify_msg, showConfirmButton: false, timer: 3000 });
            if (resp.status === 200) {
                tsRelated.clear();
                tsRelated.clearOptions();
                initRelatedTable();
            }
        });
    };

    window.deleteItem = function (el) {
        var id    = $(el).data('id');
        var title = $(el).data('title');
        Swal.fire({
            title: 'ลบรายการที่เกี่ยวข้อง?',
            html: 'ต้องการลบ <strong>' + title + '</strong> ออกจากรายการที่เกี่ยวข้องใช่หรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor:  '#6c757d',
            confirmButtonText: 'ลบ',
            cancelButtonText:  'ยกเลิก',
        }).then(function (result) {
            if (result.isConfirmed) {
                $.ajax({
                    url:     $('#url_related_delete').val(),
                    type:    'POST',
                    headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
                    data:    { id: id },
                }).done(function (resp) {
                    Swal.fire({ toast: true, position: 'top-end', icon: resp.notify_type, title: resp.notify_msg, showConfirmButton: false, timer: 3000 });
                    if (resp.status === 200) initRelatedTable();
                });
            }
        });
    };

    // Init when tab is first shown (lazy - avoid unnecessary DataTable call)
    var relatedInited = false;
    document.addEventListener('shown.bs.tab', function (e) {
        if (e.target.getAttribute('data-bs-target') === '#tab-related' && !relatedInited) {
            relatedInited = true;
            initRelatedTable();
        }
    });

    $(document).ready(function () {
        initTomSelect();
    });
}());
