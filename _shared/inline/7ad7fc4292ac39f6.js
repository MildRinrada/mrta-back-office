
(function () {
    var uploadUrl = "\/news\/admin\/upload\/summernote-upload-image";
    var token = $('meta[name="csrf-token"]').attr('content');

    tinymce.init({
        selector: '#body',
        license_key: 'gpl',
        promotion: false,
        branding: false,
        menubar: false,
        height: 460,
        plugins: 'advlist autolink lists link image media table charmap searchreplace visualblocks code fullscreen wordcount',
        toolbar: 'undo redo | blocks | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | '
               + 'bullist numlist outdent indent | blockquote | link image media table | removeformat | code fullscreen',
        block_formats: 'ย่อหน้า=p; หัวข้อ 2=h2; หัวข้อ 3=h3; หัวข้อ 4=h4',
        toolbar_mode: 'sliding',
        placeholder: 'พิมพ์รายละเอียด...',
        // เก็บ URL เต็มของรูปที่อัปโหลด (ตัวกรองไม่รับ path แบบ relative ของ TinyMCE)
        relative_urls: false,
        convert_urls: false,
        image_caption: false,
        image_advtab: false,
        automatic_uploads: true,
        images_file_types: 'jpg,jpeg,png,webp,gif,bmp',
        images_upload_handler: function (blobInfo) {
            var data = new FormData();
            data.append('image', blobInfo.blob(), blobInfo.filename());

            return fetch(uploadUrl, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
                body: data,
                credentials: 'same-origin',
            }).then(function (res) {
                if (!res.ok) throw { message: 'อัปโหลดรูปไม่สำเร็จ (รูปต้องเป็น jpg/png/gif ไม่เกิน 5 MB)', remove: true };
                return res.text();
            });
        },
        content_style: 'body{font-family:"IBM Plex Sans Thai",sans-serif;font-size:15px;color:#2d3436;line-height:1.8;}'
                     + 'img{max-width:100%;height:auto;}',
        setup: function (editor) {
            // ให้ jQuery Validate / การส่งฟอร์มเห็นค่าล่าสุดของตัวแก้ไข
            editor.on('change input undo redo', function () { editor.save(); });
        },
    });
})();
