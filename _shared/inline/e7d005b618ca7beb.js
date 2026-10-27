

function deleteItem(e) 
{
    var id = $(e).data('id');
    var id2 = $(e).data('id2');
    var url = $('#page_url_delete').val();
    var isleaf = $(e).attr('data-isleaf');

    var title = $('<div>').text($(e).data('title') || '').html(); // .data() ถอด entity แล้ว - escape ก่อนต่อเป็น HTML ของ Swal
    var extraText = '';
    if (typeof isleaf !== typeof undefined && isleaf !== false) {
        if (isleaf != '1') extraText = "\u0e40\u0e21\u0e19\u0e39\u0e19\u0e35\u0e49\u0e41\u0e25\u0e30\u0e40\u0e21\u0e19\u0e39\u0e22\u0e48\u0e2d\u0e22\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e08\u0e30\u0e16\u0e39\u0e01\u0e25\u0e1a\u0e2d\u0e2d\u0e01";
    }

    Swal.fire({
        title: "\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e01\u0e32\u0e23\u0e25\u0e1a?",
        html: "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e25\u0e1a :name \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?".replace(':name', '<strong>' + title + '</strong>')
            + (extraText ? '<br><small class="text-danger">' + extraText + '</small>' : '')
            + '<br><small class="text-danger">' + "\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e30\u0e16\u0e39\u0e01\u0e25\u0e1a\u0e16\u0e32\u0e27\u0e23 \u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e01\u0e39\u0e49\u0e04\u0e37\u0e19\u0e44\u0e14\u0e49" + '</small>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: "\u0e25\u0e1a",
        cancelButtonText: "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01",
    }).then((result) => {
        if (result.value) {
            initpreload();
            $.ajaxSetup({
                headers: {
                    'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
                }
            });
            $.ajax({
                url: url,
                method: 'POST',
                data: { id: id, id2: id2, name: "", lang: "th" },
                dataType: 'json',
            }).done(function(response) {
                if (response.status == '200') {
                    initDataTable();
                }
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: response.notify_msg, showConfirmButton: false, timer: 2000 });
                closepreload();
            });
        }
    })
}

function tinymceinit() {
    tinymce.init({
        selector: '.tinymceinit',
        license_key: 'gpl',
        promotion: false,
        branding: false,
        menubar: false,
        height: 420,
        plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'visualchars', 'code',
            'fullscreen', 'insertdatetime', 'media', 'table', 'wordcount',
            'emoticons', 'codesample', 'directionality', 'nonbreaking',
            'pagebreak', 'quickbars', 'accordion'
        ],
        toolbar: [
            'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | removeformat',
            'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ltr rtl | blockquote codesample',
            'link image media table insertdatetime charmap emoticons | searchreplace | visualblocks visualchars | fullscreen code preview | accordion'
        ],
        toolbar_mode: 'sliding',
        placeholder: "\u0e40\u0e23\u0e34\u0e48\u0e21\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e17\u0e35\u0e48\u0e19\u0e35\u0e48...",
        font_family_formats:
            'IBM Plex Sans Thai=IBM Plex Sans Thai,sans-serif;' +
            'Sarabun=Sarabun,sans-serif;' +
            'Noto Sans Thai=Noto Sans Thai,sans-serif;' +
            'Prompt=Prompt,sans-serif;' +
            'Kanit=Kanit,sans-serif;' +
            'Mitr=Mitr,sans-serif;' +
            'Anuphan=Anuphan,sans-serif;' +
            'Arial=Arial,Helvetica,sans-serif;' +
            'Georgia=Georgia,serif;' +
            'Tahoma=Tahoma,Geneva,sans-serif;' +
            'Times New Roman=Times New Roman,Times,serif;' +
            'Trebuchet MS=Trebuchet MS,sans-serif;' +
            'Verdana=Verdana,Geneva,sans-serif;' +
            'JetBrains Mono=JetBrains Mono,monospace;' +
            'Courier New=Courier New,Courier,monospace',
        content_css: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Sarabun:wght@300;400;600&family=Noto+Sans+Thai:wght@300;400;600&family=Prompt:wght@300;400;600&family=Kanit:wght@300;400;600&family=Mitr:wght@300;400;600&family=Anuphan:wght@300;400;600&family=JetBrains+Mono:wght@400;500&display=swap',
        image_advtab: true,
        image_caption: true,
        image_uploadtab: true,
        media_live_embeds: true,
        file_picker_types: 'image media',
        file_picker_callback: function (callback, value, meta) {
            const input = document.createElement('input');
            input.type = 'file';
            if (meta.filetype === 'image') {
                input.accept = 'image/*';
                input.onchange = function () {
                    const file = this.files[0];
                    const reader = new FileReader();
                    reader.onload = function () { callback(reader.result, { title: file.name }); };
                    reader.readAsDataURL(file);
                };
            } else if (meta.filetype === 'media') {
                input.accept = 'video/*,audio/*';
                input.onchange = function () {
                    const file = this.files[0];
                    callback(URL.createObjectURL(file), { title: file.name });
                };
            }
            input.click();
        },
        quickbars_selection_toolbar: 'bold italic | quicklink h2 h3 blockquote quickimage quicktable',
        contextmenu: 'link image table configurepermanentpen',
        table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol',
        content_style: 'body{font-family:"IBM Plex Sans Thai",sans-serif;font-size:14px;color:#2d3436;line-height:1.7;background:#ffffff;caret-color:#2d3436;cursor:text;}'
    });
}


// สวิตช์สถานะในตาราง (admin_status_switch): ไม่ให้ติ๊กเปลี่ยนเอง → เรียกฟังก์ชันเปิด/ปิดของหน้า (data-fn) ซึ่งยืนยัน บันทึก แล้วโหลดตาราง/หน้าใหม่
$(document).on('click', '.js-row-switch', function (ev) {
    ev.preventDefault();
    var fn = window[this.dataset.fn || 'toggleStatus'];
    if (typeof fn === 'function') fn(this);
});

function toggleStatus(e)
{
    var id = $(e).data('id');
    var status = $(e).data('status');
    var url = $('#page_url_set_status').val();

    Swal.fire({
        title: status == '1' ? "\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19?" : "\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19?",
        html: (status == '1' ? "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u003Cstrong\u003E\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u003C\/strong\u003E :name \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?" : "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u003Cstrong\u003E\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u003C\/strong\u003E :name \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?").replace(':name', '<strong>' + $('<div>').text($(e).data('title') || '').html() + '</strong>'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: status == '1' ? '#d33' : '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: status == '1' ? "\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19" : "\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19",
        cancelButtonText: "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01",
    }).then((result) => {
        if (result.isConfirmed) {
            initpreload();
            $.ajaxSetup({
                headers: {
                    'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
                }
            });
            $.ajax({
                url: url,
                method: 'POST',
                data: { id: id, status: status, name: "", lang: "th" },
                dataType: 'json',
            }).done(function(response) {
                if (response.status == '200') {
                    initDataTable();
                }
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: response.notify_msg, showConfirmButton: false, timer: 2000 });
                closepreload();
            });
        }
    })
}


function toggleInCenter(e) 
{
    var id = $(e).data('id');
    var status = $(e).data('status');
    var url = $('#page_url_set_in_center').val();

    Swal.fire({
        title: status == '1' ? "\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19?" : "\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19?",
        html: (status == '1' ? "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u003Cstrong\u003E\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u003C\/strong\u003E :name \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?" : "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u003Cstrong\u003E\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u003C\/strong\u003E :name \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?").replace(':name', '<strong>' + $('<div>').text($(e).data('title') || '').html() + '</strong>'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: status == '1' ? '#d33' : '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: status == '1' ? "\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19" : "\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19",
        cancelButtonText: "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01",
    }).then((result) => {
        if (result.value) {
            initpreload();
            $.ajaxSetup({
                headers: {
                    'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
                }
            });
            $.ajax({
                url: url,
                method: 'POST',
                data: { id: id, status: status, name: "", lang: "th" },
                dataType: 'json',
            }).done(function(response) {
                if (response.status == '200') {
                    initDataTable();
                }
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: response.notify_msg, showConfirmButton: false, timer: 2000 });
                closepreload();
            });
        }
    })
}
