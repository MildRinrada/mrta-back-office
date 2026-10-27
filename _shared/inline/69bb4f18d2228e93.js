

$.extend(true, $.fn.dataTable.defaults, {
    language: {
        emptyTable: "\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e19\u0e15\u0e32\u0e23\u0e32\u0e07",
        info: "\u0e41\u0e2a\u0e14\u0e07 _START_ \u0e16\u0e36\u0e07 _END_ \u0e08\u0e32\u0e01 _TOTAL_ \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23",
        infoEmpty: "\u0e41\u0e2a\u0e14\u0e07 0 \u0e16\u0e36\u0e07 0 \u0e08\u0e32\u0e01 0 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23",
        infoFiltered: "(\u0e01\u0e23\u0e2d\u0e07\u0e08\u0e32\u0e01\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14 _MAX_ \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23)",
        lengthMenu: "\u0e41\u0e2a\u0e14\u0e07 _MENU_ \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e15\u0e48\u0e2d\u0e2b\u0e19\u0e49\u0e32",
        loadingRecords: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...",
        processing: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23...",
        search: "\u0e04\u0e49\u0e19\u0e2b\u0e32:",
        zeroRecords: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e19",
    }
});

/**
 * แจ้งเตือนผลของ ajax ฝั่งแอดมิน
 *
 * มีหลายหน้าเรียกใช้ชื่อนี้อยู่แล้ว (reward_item, reward_category, reward_redemption)
 * แต่ไม่เคยมีใครประกาศไว้ฝั่งแอดมินเลย - ตัวที่มีอยู่อยู่ในพาร์เชียลของ frontend
 * ซึ่ง tpl_admin ไม่ได้ include และยังพึ่ง toastr ที่ฝั่งแอดมินก็ไม่ได้โหลดอีกที
 * ผลคือทุกจุดที่เรียกโยน ReferenceError เงียบ ๆ ใน console ผู้ใช้ไม่เห็นอะไรเลย
 * แม้แต่ตอนที่เซิร์ฟเวอร์ตอบว่าทำงานไม่สำเร็จ
 *
 * ใช้ SweetAlert2 ที่ footer_scripts_base โหลดไว้อยู่แล้ว รูปแบบเดียวกับ toast
 * ที่ setStatus() ด้านล่างใช้ จะได้หน้าตาเหมือนกันทั้งระบบ
 */
/**
 * escape ข้อความก่อนต่อเข้า HTML (Swal title/html เป็น innerHTML)
 * ใช้กับค่าจาก data-* ทุกตัว (ชื่อผู้ใช้/ชื่อรายการที่คนพิมพ์เอง) - server ใส่ data-x="e(...)" แล้ว
 * แต่เบราว์เซอร์ถอด entity คืนตอนอ่าน attribute จึงต้อง escape ซ้ำตรงจุดที่เอาไปต่อ HTML
 */
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showNotifyOnScreen(resp) {
    if (!resp || !resp.notify_msg) return;

    // 'danger' เป็นชื่อของ bootstrap ส่วน SweetAlert2 เรียกไอคอนนี้ว่า 'error'
    var icons = { success: 'success', warning: 'warning', danger: 'error', error: 'error', info: 'info' };

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: icons[resp.notify_type] || 'info',
        title: resp.notify_msg,
        showConfirmButton: false,
        // ข้อความ error มักยาวกว่าและต้องอ่านจริง จึงค้างนานกว่าข้อความสำเร็จ
        timer: (icons[resp.notify_type] === 'success') ? 2500 : 5000,
        timerProgressBar: true,
    });
}

function deleteItem(e)
{
    var id = $(e).data('id');
    var id2 = $(e).data('id2');
    var url = $('#page_url_delete').val();
    var isleaf = $(e).attr('data-isleaf');

    var confirm_line_1 = "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e25\u0e1a\n:title \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?".replace(':title', () => escapeHtml($(e).attr('data-title')));
    var confirm_line_2 = '';

    if (typeof isleaf !== typeof undefined && isleaf !== false) {
        if (isleaf != '1') confirm_line_2 = "\u0e04\u0e33\u0e40\u0e15\u0e37\u0e2d\u0e19! \u0e40\u0e21\u0e19\u0e39\u0e19\u0e35\u0e49\u0e41\u0e25\u0e30\u0e40\u0e21\u0e19\u0e39\u0e22\u0e48\u0e2d\u0e22\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e08\u0e30\u0e16\u0e39\u0e01\u0e25\u0e1a!";
    }

    const swalWithBootstrapButtons = Swal.mixin({
    customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-danger'
        },
        buttonsStyling: false
    })

    swalWithBootstrapButtons.fire({
        title: confirm_line_1,
        text: confirm_line_2,
        type: 'warning',
        showCancelButton: !0,
        confirmButtonText: "\u0e43\u0e0a\u0e48 \u0e25\u0e1a\u0e40\u0e25\u0e22!",
        // cancelButtonText: 'Cancel!',
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


function toggleStatus(e) 
{
    var id = $(e).data('id');
    var status = $(e).data('status');
    var url = $('#page_url_set_status').val();

    const swalWithBootstrapButtons = Swal.mixin({
        customClass: {
            confirmButton: 'btn btn-success',
            cancelButton: 'btn btn-danger'
        },
        buttonsStyling: false
    })

    swalWithBootstrapButtons.fire({
        title: (status == '1' ? "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19 :title \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?" : "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19 :title \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?").replace(':title', () => escapeHtml($(e).attr('data-title'))),
        // text: confirm_line_2,
        type: 'warning',
        showCancelButton: !0,
        confirmButtonText: (status == '1' ? "\u0e43\u0e0a\u0e48 \u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19!" : "\u0e43\u0e0a\u0e48 \u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19!"),
        // cancelButtonText: 'Cancel!',
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


function toggleInCenter(e) 
{
    var id = $(e).data('id');
    var status = $(e).data('status');
    var url = $('#page_url_set_in_center').val();

    const swalWithBootstrapButtons = Swal.mixin({
    customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-danger'
        },
        buttonsStyling: false
    })

    swalWithBootstrapButtons.fire({
        title: (status == '1' ? "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19 :title \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?" : "\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19 :title \u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?").replace(':title', () => escapeHtml($(e).attr('data-title'))),
        // text: confirm_line_2,
        type: 'warning',
        showCancelButton: !0,
        confirmButtonText: (status == '1' ? "\u0e43\u0e0a\u0e48 \u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19!" : "\u0e43\u0e0a\u0e48 \u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19!"),
        // cancelButtonText: 'Cancel!',
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
