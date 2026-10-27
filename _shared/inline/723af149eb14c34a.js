
    // ═══ ตัวรองรับโค้ดของธีม Metronic เดิม ═══
    // หน้าหลังบ้านหลายหน้ายังเรียก KTUtil / .datepicker() / .select2() / .selectpicker() / .summernote() ฯลฯ
    // ซึ่ง layout ใหม่ไม่ได้โหลดแล้ว - เรียกเมื่อไหร่ JS ของหน้านั้นหยุดทั้งก้อน ตารางจึงไม่โหลดข้อมูลเลย
    // ที่นี่ทำให้เรียกได้ไม่พัง: datepicker → flatpickr (ยิง change เหมือนเดิม) / ปลั๊กอินที่ไม่มีแล้ว → ช่องธรรมดา
    (function ($) {
        window.KTUtil = window.KTUtil || {
            isRTL: function () { return false; },
            isMobileDevice: function () { return window.innerWidth < 992; },
            getViewPort: function () { return { width: window.innerWidth, height: window.innerHeight }; },
            ready: function (fn) { $(fn); },
        };
        window.KTApp = window.KTApp || {
            block: function () { Preloader.show(); },
            unblock: function () { Preloader.hide(); },
            blockPage: function () { Preloader.show(); },
            unblockPage: function () { Preloader.hide(); },
            initTooltips: function () {},
        };

        // วันที่แบบ moment ขนาดเล็ก (มีแค่ .format) - ปลั๊กอินเดิมคืน moment ให้หน้าเรียก .format('YYYY-MM-DD h:mm A')
        function miniMoment(d) {
            d = d instanceof Date ? d : (d ? new Date(d) : new Date());
            var pad = function (n) { return (n < 10 ? '0' : '') + n; };
            return {
                _d: d,
                toDate: function () { return d; },
                format: function (f) {
                    var h = d.getHours(), h12 = h % 12 || 12;
                    return String(f || 'YYYY-MM-DD').replace(/YYYY|MM|DD|HH|H|hh|h|mm|ss|A/g, function (t) {
                        return { YYYY: d.getFullYear(), MM: pad(d.getMonth() + 1), DD: pad(d.getDate()), HH: pad(h), H: h,
                                 hh: pad(h12), h: h12, mm: pad(d.getMinutes()), ss: pad(d.getSeconds()), A: h < 12 ? 'AM' : 'PM' }[t];
                    });
                },
            };
        }
        // "dd/mm/yyyy" หรือ "dd/mm/yyyy HH:ii" → Date
        function parseDmy(v) {
            if (v instanceof Date) return v;
            var m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
            return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null;
        }
        // ตัวช่องกรอกจริง - ปลั๊กอินเดิมผูกกับ div.input-group ที่มี input อยู่ข้างใน
        function pickerInput(el) { return $(el).is('input') ? el : $(el).find('input').get(0); }
        window.miniMoment = miniMoment;

        // bootstrap-datepicker → flatpickr  (รูปแบบ dd/mm/yyyy ของเดิม → d/m/Y)
        // รองรับ .datepicker('setDate', 'dd/mm/yyyy') และ .data('datepicker').getFormattedDate('yyyy-mm-dd') ที่ฟอร์มหลักสูตรใช้
        if (!$.fn.datepicker) {
            $.fn.datepicker = function (opts, value) {
                if (typeof opts === 'string') {
                    if (opts === 'setDate') this.each(function () { var i = pickerInput(this); if (i && i._flatpickr) i._flatpickr.setDate(parseDmy(value) || value, true); });
                    if (opts === 'clearDates') this.each(function () { var i = pickerInput(this); if (i && i._flatpickr) i._flatpickr.clear(); });
                    return this;
                }
                return this.each(function () {
                    var input = pickerInput(this);
                    if (!input || input._flatpickr || typeof flatpickr === 'undefined') return;
                    var fmt = String($(input).data('date-format') || (opts && opts.format) || 'dd/mm/yyyy');
                    var fp = flatpickr(input, { dateFormat: fmt.replace('yyyy', 'Y').replace('mm', 'm').replace('dd', 'd'), allowInput: true });
                    var api = {
                        getDate: function () { return fp.selectedDates[0] || null; },
                        getFormattedDate: function (f) {
                            var d = fp.selectedDates[0];
                            return d ? miniMoment(d).format(String(f || 'dd/mm/yyyy').replace('yyyy', 'YYYY').replace('mm', 'MM').replace('dd', 'DD')) : '';
                        },
                    };
                    $(this).data('datepicker', api);
                    $(input).data('datepicker', api);
                });
            };
        }

        // bootstrap-daterangepicker → flatpickr แบบช่วง  .daterangepicker(opts, callback(start, end))
        // .data('daterangepicker') มี startDate / endDate (.format ได้) และ setStartDate / setEndDate ('dd/mm/yyyy HH:ii')
        if (!$.fn.daterangepicker) {
            $.fn.daterangepicker = function (opts, cb) {
                opts = opts || {};
                return this.each(function () {
                    var $wrap = $(this), input = pickerInput(this);
                    if (!input || typeof flatpickr === 'undefined') return;
                    if (input._flatpickr) input._flatpickr.destroy();
                    var api = { startDate: miniMoment(parseDmy(opts.startDate) || new Date()), endDate: miniMoment(parseDmy(opts.endDate) || new Date()) };
                    var fp = flatpickr(input, {
                        mode: 'range', enableTime: !!opts.timePicker, time_24hr: true,
                        dateFormat: opts.timePicker ? 'd/m/Y H:i' : 'd/m/Y',
                        locale: { rangeSeparator: ' - ' },
                        onChange: function (sel) {
                            if (sel.length !== 2) return;
                            api.startDate = miniMoment(sel[0]);
                            api.endDate = miniMoment(sel[1]);
                            if (typeof cb === 'function') cb(api.startDate, api.endDate, '');
                        },
                    });
                    var sync = function () { fp.setDate([api.startDate._d, api.endDate._d], false); };
                    api.setStartDate = function (v) { var d = parseDmy(v); if (d) { api.startDate = miniMoment(d); sync(); } };
                    api.setEndDate = function (v) { var d = parseDmy(v); if (d) { api.endDate = miniMoment(d); sync(); } };
                    $wrap.data('daterangepicker', api);
                    $(input).data('daterangepicker', api);
                });
            };
        }
        // ตั้งค่าช่วงวันที่ที่บันทึกไว้แล้ว (สคริปต์จาก CourseController@ajaxLoadForm) - "dd/mm/yyyy HH:ii|dd/mm/yyyy HH:ii"
        window.setDateRange = function (sel, range) {
            var parts = String(range).split('|'), $el = $(sel);
            if (!$el.data('daterangepicker')) $el.daterangepicker({ timePicker: true });
            var api = $el.data('daterangepicker');
            if (!api) return;
            api.setStartDate(parts[0]);
            api.setEndDate(parts[1]);
            $(pickerInput($el.get(0))).val(parts[0] + ' - ' + parts[1]);
        };
        if (!$.fn.timepicker) {
            $.fn.timepicker = function (opts) {
                if (typeof opts === 'string') return this;
                return this.each(function () {
                    if (this._flatpickr || typeof flatpickr === 'undefined') return;
                    flatpickr(this, { enableTime: true, noCalendar: true, dateFormat: 'H:i', time_24hr: true, allowInput: true });
                });
            };
        }

        // select2 → Tom Select (layout โหลดไว้แล้ว) - ค่ายังอยู่ใน <select> เดิม อ่านด้วย .val() / FormData ได้เหมือนเดิม
        if (!$.fn.select2) {
            $.fn.select2 = function (opts) {
                if (opts === 'destroy') return this.each(function () { if (this.tomselect) this.tomselect.destroy(); });
                if (typeof opts === 'string') return this;
                opts = opts || {};
                return this.each(function () {
                    // select ที่ซ่อนไว้ (hidden) ให้ JS ของหน้าเปิดเอง - ไม่สร้างกล่องที่มองเห็นทับ
                    if (this.tagName !== 'SELECT' || this.tomselect || this.hidden || typeof TomSelect === 'undefined') return;
                    try {
                        new TomSelect(this, {
                            plugins: this.multiple ? ['remove_button'] : [],
                            placeholder: opts.placeholder || '',
                            allowEmptyOption: true,
                            maxOptions: null,
                            create: !!opts.tags,
                        });
                    } catch (e) { /* ช่องที่ทำไม่ได้ เหลือเป็น select ธรรมดา */ }
                });
            };
        }
        if (!$.fn.selectpicker) $.fn.selectpicker = function () { return this; };

        // summernote → TinyMCE (layout โหลดไว้แล้ว) - เขียนค่ากลับลง textarea ทุกครั้งที่แก้ (ฟอร์มส่งด้วย FormData)
        // .summernote('code') อ่าน / ('code', html) ตั้ง / ('pasteHTML', html) แทรก / ('disable') อ่านอย่างเดียว
        if (!$.fn.summernote) {
            $.fn.summernote = function (cmd, value) {
                var el = this[0];
                var ed = el && el.id && window.tinymce ? tinymce.get(el.id) : null;
                if (cmd === 'code') {
                    if (value === undefined) return ed ? ed.getContent() : this.val();
                    if (ed) ed.setContent(value || '');
                    return this.val(value);
                }
                if (cmd === 'pasteHTML') { if (ed) ed.insertContent(value || ''); return this; }
                if (cmd === 'disable' || cmd === 'enable') { if (ed) ed.mode.set(cmd === 'disable' ? 'readonly' : 'design'); return this; }
                if (typeof cmd === 'string') return this;
                var opts = cmd || {};
                return this.each(function () {
                    var ta = this;
                    if (ta.tagName !== 'TEXTAREA' || typeof tinymce === 'undefined') return;
                    if (!ta.id) ta.id = 'sn_' + Math.random().toString(36).slice(2);
                    // เนื้อหาขั้นตอนโหลดใหม่ด้วย ajax - ตัวแก้ไขเก่าที่ element หายไปแล้วต้องทิ้งก่อน
                    var old = tinymce.get(ta.id);
                    if (old) { if (document.body.contains(old.getElement())) return; old.remove(); }
                    tinymce.init({
                        target: ta, license_key: 'gpl', promotion: false, branding: false, menubar: false,
                        height: (opts.height || 150) + 110,
                        plugins: 'lists link image table code',
                        toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | link image table | code',
                        readonly: ta.disabled,
                        setup: function (editor) {
                            editor.on('change input undo redo', function () { editor.save(); $(ta).trigger('change'); });
                        },
                    });
                });
            };
        }
        // DataTables: หน้าเดิมเขียนด้วย API รุ่น 1.10 (.dataTable().fnDestroy() / fnSettings()) - layout ใช้รุ่น 2 ซึ่งไม่มีแล้ว
        $.fn.fnDestroy = function () {
            return this.each(function () { if ($.fn.DataTable.isDataTable(this)) $(this).DataTable().destroy(); });
        };
        $.fn.fnSettings = function () {
            return this.length && $.fn.DataTable.isDataTable(this[0]) ? $(this[0]).DataTable().settings()[0] : null;
        };

        // Bootstrap 4 → 5: data-toggle / data-dismiss / data-target และ dropdown-menu-right
        // (เมนู ... ของแต่ละแถว ปุ่มปิด alert/modal ฯลฯ ไม่ทำงานบน Bootstrap 5)
        // รวมแถวที่ตารางโหลดมาทีหลังด้วย - ใช้ MutationObserver
        function upgradeBs4(root) {
            $(root).find('[data-toggle], [data-dismiss], [data-target], [data-placement], .dropdown-menu-right').addBack('[data-toggle], [data-dismiss], [data-target]').each(function () {
                var el = this;
                ['toggle', 'dismiss', 'target', 'placement', 'parent'].forEach(function (k) {
                    var v = el.getAttribute('data-' + k);
                    if (v !== null && !el.hasAttribute('data-bs-' + k)) el.setAttribute('data-bs-' + k, v);
                });
                if (el.classList.contains('dropdown-menu-right')) el.classList.add('dropdown-menu-end');
                // ปุ่มปิด/ยกเลิกที่ไม่ระบุ type = ปุ่มส่งฟอร์ม (POST ไปที่ URL ของหน้า = 405) - ตั้งเป็นปุ่มธรรมดา
                if (el.tagName === 'BUTTON' && !el.hasAttribute('type') && el.hasAttribute('data-dismiss')) el.type = 'button';
            });
        }
        upgradeBs4(document.body);
        new MutationObserver(function (list) {
            list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) upgradeBs4(n); }); });
        }).observe(document.body, { childList: true, subtree: true });

        if (!$.notify) {
            $.notify = function (opts, settings) {
                var o = typeof opts === 'string' ? { message: opts } : (opts || {});
                var type = (settings && settings.type) || 'info';
                Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2500,
                    icon: { success: 'success', danger: 'error', warning: 'warning' }[type] || 'info',
                    title: o.title || '', text: $('<div>').html(o.message || '').text() });
            };
        }
    })(jQuery);
