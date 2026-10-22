
    document.querySelectorAll('[data-imgfield]').forEach(function (field) {
        var img = field.querySelector('[data-imgfield-img]');
        var tag = field.querySelector('[data-imgfield-tag]');
        var file = field.querySelector('[data-imgfield-file]');
        var flag = field.querySelector('[data-imgfield-flag]');
        var removeBtn = field.querySelector('[data-imgfield-remove]');
        var undoBtn = field.querySelector('[data-imgfield-undo]');
        var original = field.dataset.original || '';
        var placeholder = field.dataset.placeholder;
        var objectUrl = null;

        // src = null → รูปตั้งต้น / removed = กำลังจะลบรูปเดิม (เลิกทำได้)
        function show(src, removed) {
            img.src = src || placeholder;
            tag.hidden = !!src;
            removeBtn.hidden = !src;
            undoBtn.hidden = !removed;
            flag.value = removed ? '1' : '0';
        }

        function clearFile() {
            file.value = '';
            if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
        }

        file.addEventListener('change', function () {
            var f = file.files && file.files[0];
            if (!f) return;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            objectUrl = URL.createObjectURL(f);
            show(objectUrl, false);
        });

        removeBtn.addEventListener('click', function () {
            if (objectUrl) {
                clearFile();
                show(original, false);
            } else {
                show(null, !!original);
            }
        });

        undoBtn.addEventListener('click', function () {
            show(original, false);
        });
    });
    