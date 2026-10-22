
window.UA = (function () {
    var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    var text = {"actions":{"create":"\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e43\u0e2b\u0e21\u0e48","edit":"\u0e41\u0e01\u0e49\u0e44\u0e02","view":"\u0e14\u0e39\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14","more":"\u0e01\u0e32\u0e23\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23\u0e2d\u0e37\u0e48\u0e19","delete":"\u0e25\u0e1a\u0e1a\u0e31\u0e0d\u0e0a\u0e35","save_settings":"\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32","suspend":"\u0e23\u0e30\u0e07\u0e31\u0e1a\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19","activate":"\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19","force_reset":"\u0e1a\u0e31\u0e07\u0e04\u0e31\u0e1a\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19","send_reset_link":"\u0e2a\u0e48\u0e07\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19","reset_mfa":"\u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15 MFA","sign_out":"\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a\u0e17\u0e38\u0e01\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c","approve":"\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34","reject":"\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18","verify_email":"\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e41\u0e17\u0e19","resend_verification":"\u0e2a\u0e48\u0e07\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07"},"confirm":{"ok":"\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19","cancel":"\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01","reason":"\u0e40\u0e2b\u0e15\u0e38\u0e1c\u0e25 (\u0e44\u0e21\u0e48\u0e1a\u0e31\u0e07\u0e04\u0e31\u0e1a) - \u0e41\u0e2a\u0e14\u0e07\u0e43\u0e19\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e1a\u0e31\u0e0d\u0e0a\u0e35","bulk_title":":action :n \u0e1a\u0e31\u0e0d\u0e0a\u0e35?","one_title":":action \u0022:name\u0022?","delete_title":"\u0e25\u0e1a\u0e1a\u0e31\u0e0d\u0e0a\u0e35 \u0022:name\u0022?","delete_text":"\u0e25\u0e1a\u0e41\u0e25\u0e49\u0e27\u0e01\u0e39\u0e49\u0e04\u0e37\u0e19\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 \u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e02\u0e2d\u0e07\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e19\u0e35\u0e49\u0e08\u0e30\u0e44\u0e21\u0e48\u0e1c\u0e39\u0e01\u0e01\u0e31\u0e1a\u0e43\u0e04\u0e23\u0e2d\u0e35\u0e01 - \u0e16\u0e49\u0e32\u0e41\u0e04\u0e48\u0e44\u0e21\u0e48\u0e43\u0e2b\u0e49\u0e40\u0e02\u0e49\u0e32\u0e43\u0e0a\u0e49 \u0e43\u0e2b\u0e49\u0e23\u0e30\u0e07\u0e31\u0e1a\u0e41\u0e17\u0e19","suspend_text":"\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e08\u0e30\u0e16\u0e39\u0e01\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a\u0e17\u0e38\u0e01\u0e23\u0e30\u0e1a\u0e1a\u0e17\u0e31\u0e19\u0e17\u0e35 \u0e41\u0e25\u0e30\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e43\u0e2b\u0e21\u0e48\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e08\u0e19\u0e01\u0e27\u0e48\u0e32\u0e08\u0e30\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19","activate_text":"\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e08\u0e30\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e44\u0e14\u0e49\u0e15\u0e32\u0e21\u0e1b\u0e01\u0e15\u0e34","force_reset_text":"\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e08\u0e30\u0e16\u0e39\u0e01\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a \u0e41\u0e25\u0e30\u0e15\u0e49\u0e2d\u0e07\u0e15\u0e31\u0e49\u0e07\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e43\u0e2b\u0e21\u0e48\u0e43\u0e19\u0e01\u0e32\u0e23\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e04\u0e23\u0e31\u0e49\u0e07\u0e16\u0e31\u0e14\u0e44\u0e1b","send_reset_link_text":"\u0e23\u0e30\u0e1a\u0e1a\u0e08\u0e30\u0e2a\u0e48\u0e07\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e15\u0e31\u0e49\u0e07\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e43\u0e2b\u0e21\u0e48\u0e44\u0e1b\u0e17\u0e35\u0e48\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e02\u0e2d\u0e07\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49 (\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e43\u0e0a\u0e49\u0e44\u0e14\u0e49 60 \u0e19\u0e32\u0e17\u0e35)","reset_mfa_text":"\u0e25\u0e1a\u0e01\u0e32\u0e23\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32 MFA \u0e41\u0e25\u0e30\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e33\u0e23\u0e2d\u0e07\u0e02\u0e2d\u0e07\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49 - \u0e43\u0e0a\u0e49\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e17\u0e33\u0e42\u0e17\u0e23\u0e28\u0e31\u0e1e\u0e17\u0e4c\u0e2b\u0e32\u0e22 \u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e15\u0e49\u0e2d\u0e07\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e43\u0e2b\u0e21\u0e48\u0e16\u0e49\u0e32\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e19\u0e42\u0e22\u0e1a\u0e32\u0e22\u0e1a\u0e31\u0e07\u0e04\u0e31\u0e1a","sign_out_text":"\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e08\u0e30\u0e16\u0e39\u0e01\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a\u0e17\u0e38\u0e01\u0e23\u0e30\u0e1a\u0e1a\u0e41\u0e25\u0e30\u0e17\u0e38\u0e01\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c\u0e17\u0e31\u0e19\u0e17\u0e35 (\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e22\u0e31\u0e07\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e44\u0e14\u0e49)","approve_text":"\u0e1c\u0e39\u0e49\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e08\u0e30\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e44\u0e14\u0e49\u0e17\u0e31\u0e19\u0e17\u0e35","reject_text":"\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e08\u0e30\u0e16\u0e39\u0e01\u0e1b\u0e34\u0e14\u0e41\u0e25\u0e30\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49","verify_email_text":"\u0e16\u0e37\u0e2d\u0e27\u0e48\u0e32\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e19\u0e35\u0e49\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e41\u0e25\u0e49\u0e27 \u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e44\u0e14\u0e49\u0e42\u0e14\u0e22\u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e14\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e43\u0e19\u0e2d\u0e35\u0e40\u0e21\u0e25","resend_verification_text":"\u0e23\u0e30\u0e1a\u0e1a\u0e08\u0e30\u0e2a\u0e48\u0e07\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e44\u0e1b\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07"},"reasonLabel":"\u0e40\u0e2b\u0e15\u0e38\u0e1c\u0e25 (\u0e44\u0e21\u0e48\u0e1a\u0e31\u0e07\u0e04\u0e31\u0e1a) - \u0e41\u0e2a\u0e14\u0e07\u0e43\u0e19\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e1a\u0e31\u0e0d\u0e0a\u0e35","ok":"\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19","cancel":"\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01","failed":"\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08","bulkTitle":"__A__ __N__ \u0e1a\u0e31\u0e0d\u0e0a\u0e35?","oneTitle":"__A__ \u0022__NAME__\u0022?","deleteTitle":"\u0e25\u0e1a\u0e1a\u0e31\u0e0d\u0e0a\u0e35 \u0022__NAME__\u0022?","deleteText":"\u0e25\u0e1a\u0e41\u0e25\u0e49\u0e27\u0e01\u0e39\u0e49\u0e04\u0e37\u0e19\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 \u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e02\u0e2d\u0e07\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e19\u0e35\u0e49\u0e08\u0e30\u0e44\u0e21\u0e48\u0e1c\u0e39\u0e01\u0e01\u0e31\u0e1a\u0e43\u0e04\u0e23\u0e2d\u0e35\u0e01 - \u0e16\u0e49\u0e32\u0e41\u0e04\u0e48\u0e44\u0e21\u0e48\u0e43\u0e2b\u0e49\u0e40\u0e02\u0e49\u0e32\u0e43\u0e0a\u0e49 \u0e43\u0e2b\u0e49\u0e23\u0e30\u0e07\u0e31\u0e1a\u0e41\u0e17\u0e19"};
    var urls = {"action":"\/portal\/admin\/user\/action","delete":"\/portal\/admin\/user\/delete","detail":"\/portal\/admin\/user"};
    // ต้องใส่เหตุผล / ใส่ได้ / สีปุ่มยืนยัน
    var withReason = ['suspend', 'reject'];
    var danger = ['suspend', 'reject', 'force_reset', 'reset_mfa', 'sign_out'];
    var detailModal = null, detailId = null;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function post(url, body) {
        return fetch(url, {
            method: 'POST',
            headers: { 'X-CSRF-TOKEN': csrf, 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify(body || {})
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (json) {
                if (!res.ok || json.ok === false) { json.status = res.status; throw json; }
                return json;
            });
        });
    }

    function toast(message, icon) {
        Swal.fire({ toast: true, position: 'top-end', icon: icon || 'success', titleText: message, showConfirmButton: false, timer: 3200 });
    }

    function updateCounts(counts) {
        if (!counts) return;
        Object.keys(counts).forEach(function (key) {
            var el = document.querySelector('[data-count="' + key + '"]');
            if (el) el.textContent = Number(counts[key]).toLocaleString();
        });
    }

    function refresh() {
        if (window.uaReload) window.uaReload();
        if (detailId && document.getElementById('uaDetailModal').classList.contains('show')) openDetail(detailId);
    }

    // ถามยืนยัน (+ เหตุผลสำหรับระงับ / ปฏิเสธ) แล้วส่ง - ids = [1, 2, 3]
    function act(action, ids, name, done) {
        if (!ids.length) return;
        var label = text.actions[action] || action;
        var title = ids.length > 1
            ? text.bulkTitle.replace('__A__', label).replace('__N__', ids.length)
            : text.oneTitle.replace('__A__', label).replace('__NAME__', name || '');
        // titleText = ข้อความล้วน: ชื่อผู้ใช้ตั้งเองได้ตอนสมัคร ถ้าใช้ title (HTML) สคริปต์ในชื่อจะรันในหน้าแอดมิน
        var opts = {
            titleText: title,
            text: text.confirm[action + '_text'] || '',
            icon: danger.indexOf(action) !== -1 ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonText: text.ok,
            cancelButtonText: text.cancel,
            confirmButtonColor: danger.indexOf(action) !== -1 ? '#d33' : 'var(--pri)',
            cancelButtonColor: '#6c757d'
        };
        if (withReason.indexOf(action) !== -1) {
            opts.input = 'textarea';
            opts.inputLabel = text.reasonLabel;
            opts.inputAttributes = { maxlength: 500 };
        }
        Swal.fire(opts).then(function (r) {
            if (!r.isConfirmed) return;
            post(urls.action, { ids: ids, action: action, note: r.value || '' }).then(function (res) {
                toast(res.message);
                updateCounts(res.counts);
                refresh();
                if (done) done(res);
            }).catch(function (err) {
                Swal.fire({ icon: 'warning', title: text.failed, text: (err && err.message) || '' });
                if (err && err.counts) updateCounts(err.counts);
            });
        });
    }

    function remove(id, name) {
        Swal.fire({
            titleText: text.deleteTitle.replace('__NAME__', name || ''), text: text.deleteText, icon: 'warning',
            showCancelButton: true, confirmButtonText: text.ok, cancelButtonText: text.cancel, confirmButtonColor: '#d33', cancelButtonColor: '#6c757d'
        }).then(function (r) {
            if (!r.isConfirmed) return;
            post(urls.delete, { id: id }).then(function (res) {
                toast(res.notify_msg);
                if (detailModal) detailModal.hide();
                if (window.uaReload) window.uaReload();
            }).catch(function (err) {
                Swal.fire({ icon: 'warning', title: text.failed, text: (err && (err.notify_msg || err.message)) || '' });
            });
        });
    }

    function openDetail(id) {
        detailId = id;
        detailModal = detailModal || bootstrap.Modal.getOrCreateInstance(document.getElementById('uaDetailModal'));
        fetch(urls.detail + '/' + id + '/detail', { headers: { 'Accept': 'application/json' } })
            .then(function (r) { if (!r.ok) throw r; return r.json(); })
            .then(function (res) {
                document.getElementById('uaDetailBody').innerHTML = res.html;
                detailModal.show();
            })
            .catch(function () { Swal.fire({ icon: 'warning', title: text.failed }); });
    }

    document.addEventListener('click', function (e) {
        var a = e.target.closest('[data-act][data-id]');
        if (a) { e.preventDefault(); act(a.dataset.act, [Number(a.dataset.id)], a.dataset.name); return; }
        var v = e.target.closest('[data-view]');
        if (v) { e.preventDefault(); openDetail(v.dataset.view); return; }
        var d = e.target.closest('[data-delete]');
        if (d) { e.preventDefault(); remove(Number(d.dataset.delete), d.dataset.name); }
    });

    return { post: post, toast: toast, act: act, openDetail: openDetail, updateCounts: updateCounts, esc: esc };
})();
