
(function () {
    var q = document.getElementById('question');
    var a = document.getElementById('answer');
    var cat = document.getElementById('qa_category_id');
    var isOn = true; // สถานะปัจจุบัน (เปลี่ยนที่สวิตช์ในรายการ) - ใช้แสดงตัวอย่างอย่างเดียว
    var PH = { q: "\u0e04\u0e33\u0e16\u0e32\u0e21\u0e08\u0e30\u0e41\u0e2a\u0e14\u0e07\u0e15\u0e23\u0e07\u0e19\u0e35\u0e49", a: "\u0e04\u0e33\u0e15\u0e2d\u0e1a\u0e08\u0e30\u0e41\u0e2a\u0e14\u0e07\u0e15\u0e23\u0e07\u0e19\u0e35\u0e49" };

    // คำถาม = ข้อความล้วน (textContent) / คำตอบ = html จากตัวแก้ไข ซึ่งจำกัดแท็กไว้แล้ว (valid_elements ด้านล่าง)
    function setText(el, value, placeholder) {
        el.textContent = value || placeholder;
        el.classList.toggle('ff-placeholder', ! value);
    }
    function answerHtml() {
        var ed = window.tinymce && tinymce.get('answer');
        return ed ? ed.getContent() : a.value;
    }
    function render() {
        setText(document.getElementById('pv_q'), q.value.trim(), PH.q);
        var html = answerHtml();
        var pa = document.getElementById('pv_a');
        if (html.replace(/<[^>]*>|&nbsp;|\s/g, '') === '') { setText(pa, '', PH.a); }
        else { pa.innerHTML = html; pa.classList.remove('ff-placeholder'); }
        document.getElementById('pv_cat').textContent = cat.value ? cat.options[cat.selectedIndex].text.trim() : '';
        document.getElementById('question_count').textContent = q.value.length;
        document.getElementById('pv_site').classList.toggle('is-off', ! isOn);
        document.getElementById('pv_hidden').hidden = isOn;
    }
    q.addEventListener('input', render);
    cat.addEventListener('change', render);

    // ตัวแก้ไขคำตอบ - เครื่องมือเท่าที่จำเป็น แท็กชุดเดียวกับที่ server เก็บ (cleanAnswer)
    if (window.tinymce) {
        tinymce.init({
            selector: '#answer',
            license_key: 'gpl',
            promotion: false,
            branding: false,
            menubar: false,
            statusbar: false,
            height: 300,
            plugins: ['lists', 'link', 'autolink'],
            toolbar: 'bold italic underline strikethrough | link | numlist bullist | removeformat | undo redo',
            valid_elements: 'p,br,strong/b,em/i,u,s/strike,a[href|title|target|rel],ul,ol,li',
            link_default_target: '_blank',
            link_target_list: false,
            link_title: false,
            placeholder: a.getAttribute('placeholder'),
            content_style: 'body { font-family: "IBM Plex Sans Thai", sans-serif; font-size: 14px; line-height: 1.7; } a { color: #2d66cc; }',
            setup: function (ed) {
                ed.on('init input change undo redo SetContent', render);
            },
        });
    } else {
        a.addEventListener('input', render);
    }
    render();
})();
