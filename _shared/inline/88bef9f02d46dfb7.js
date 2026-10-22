
(function () {
    var STATUS = "\/portal\/admin\/security\/confirm";
    var CONFIRM = "\/portal\/admin\/security\/confirm";
    var TXT = { empty: "\u0e01\u0e23\u0e2d\u0e01\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e2b\u0e23\u0e37\u0e2d\u0e23\u0e2b\u0e31\u0e2a 2FA", retry: "\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e15\u0e31\u0e27\u0e15\u0e19\u0e41\u0e25\u0e49\u0e27 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e17\u0e33\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07" };
    var csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
    var modalEl = document.getElementById('scReauthModal');
    var origFetch = window.fetch.bind(window);
    var pending = null;   // { resolve, reject } ของรอบที่เปิดหน้าต่างอยู่

    function $id(id) { return document.getElementById(id); }

    function setMethods(m) {
        $id('scReauthPwGroup').classList.toggle('d-none', !m.password);
        $id('scReauthCodeGroup').classList.toggle('d-none', !m.totp);
        $id('scReauthOr').classList.toggle('d-none', !(m.password && m.totp));
        $id('scReauthNoMethod').classList.toggle('d-none', !!(m.password || m.totp));
        $id('scReauthSubmit').disabled = !(m.password || m.totp);
    }

    function status() {
        return origFetch(STATUS, { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' })
            .then(function (r) { return r.json(); });
    }

    /** ยืนยันตัวตน - ยืนยันไว้แล้ว = ผ่านทันที / ยังไม่ = เปิดหน้าต่าง (resolve เมื่อสำเร็จ, reject เมื่อปิดหน้าต่าง) */
    window.scReauth = function (forceOpen) {
        return status().then(function (s) {
            if (s.confirmed && !forceOpen) return true;
            return new Promise(function (resolve, reject) {
                pending = { resolve: resolve, reject: reject };
                setMethods(s);
                $id('scReauthPassword').value = '';
                $id('scReauthCode').value = '';
                $id('scReauthError').textContent = '';
                bootstrap.Modal.getOrCreateInstance(modalEl).show();
            });
        });
    };

    modalEl.addEventListener('shown.bs.modal', function () {
        var first = modalEl.querySelector('#scReauthPwGroup:not(.d-none) input, #scReauthCodeGroup:not(.d-none) input');
        if (first) first.focus();
    });
    modalEl.addEventListener('hidden.bs.modal', function () {
        if (pending) { pending.reject(new Error('cancelled')); pending = null; }
    });

    $id('scReauthForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var pw = $id('scReauthPassword').value, code = $id('scReauthCode').value.trim();
        if (!pw && !code) { $id('scReauthError').textContent = TXT.empty; return; }
        $id('scReauthSubmit').disabled = true;
        origFetch(CONFIRM, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ password: pw, code: code })
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
              $id('scReauthSubmit').disabled = false;
              if (res.ok) {
                  var p = pending; pending = null;
                  bootstrap.Modal.getOrCreateInstance(modalEl).hide();
                  if (p) p.resolve(true);
                  return;
              }
              if (res.j && res.j.status === 'logout') { window.location.href = res.j.redirect || '/'; return; }
              $id('scReauthError').textContent = (res.j && res.j.message) || TXT.empty;
              $id('scReauthPassword').value = ''; $id('scReauthCode').value = '';
          })
          .catch(function () { $id('scReauthSubmit').disabled = false; });
    });

    // 1) fetch: 428 → ยืนยันแล้วส่งซ้ำ
    window.fetch = function (input, init) {
        return origFetch(input, init).then(function (res) {
            if (res.status !== 428) return res;
            return res.clone().json().then(function (j) {
                if (!j || !j.reauth_required) return res;
                return window.scReauth(true).then(function () { return origFetch(input, init); }, function () { return res; });
            }, function () { return res; });
        });
    };

    // 2) jQuery ajax: 428 → ยืนยันแล้วส่งซ้ำ (ผูกผลรอบใหม่เข้ากับ jqXHR เดิมของผู้เรียก)
    if (window.jQuery) {
        jQuery.ajaxPrefilter(function (opts, original, jqXHR) {
            if (opts._scRetry) return;
            var dfd = jQuery.Deferred();
            jqXHR.done(dfd.resolve);
            jqXHR.fail(function (xhr) {
                var args = arguments;
                if (xhr.status === 428 && xhr.responseJSON && xhr.responseJSON.reauth_required) {
                    window.scReauth(true).then(function () {
                        jQuery.ajax(jQuery.extend({}, original, { _scRetry: true })).then(dfd.resolve, dfd.reject);
                    }, function () { dfd.rejectWith(xhr, args); });
                } else {
                    dfd.rejectWith(xhr, args);
                }
            });
            return dfd.promise(jqXHR);
        });
    }

    // 3) ฟอร์มที่ต้องยืนยันก่อนส่ง
    function snapshot(form, fields) {
        var out = {};
        fields.forEach(function (n) {
            var els = form.querySelectorAll('[name="' + n + '"]');
            out[n] = Array.prototype.map.call(els, function (el) {
                return (el.type === 'checkbox' || el.type === 'radio') ? (el.checked ? el.value : '') : el.value;
            }).join('|');
        });
        return JSON.stringify(out);
    }
    document.querySelectorAll('form[data-reauth-fields]').forEach(function (form) {
        form._scInitial = snapshot(form, form.dataset.reauthFields.split(','));
    });
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!(form instanceof HTMLFormElement) || form._scPassed) return;
        var always = form.hasAttribute('data-reauth');
        var fields = form.dataset.reauthFields ? form.dataset.reauthFields.split(',') : null;
        if (!always && !fields) return;
        if (fields && !always && snapshot(form, fields) === form._scInitial) return;
        // หยุดตั้งแต่ตรงนี้ - ตัวจัดการ submit ของหน้านั้น (เช่นปิดปุ่ม/แสดงกำลังบันทึก) ยังไม่ต้องทำงานจนกว่าจะยืนยันเสร็จ
        e.preventDefault();
        e.stopPropagation();
        if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) return;
        window.scReauth().then(function () {
            form._scPassed = true;
            if (form.requestSubmit) form.requestSubmit(); else form.submit();
        }, function () {});
    }, true);

    // 4) ถูกตีกลับจากเซิร์ฟเวอร์ (ฟอร์มธรรมดา / ลิงก์ดาวน์โหลด)
    })();
