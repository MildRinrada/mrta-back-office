
    // ข้อความในตัว DataTables ตามภาษาที่เลือก (lang/{th,en}/datatable.php - ชุดเดียวกับ portal)
    // ทุกตารางได้ค่านี้ หน้าไหนตั้ง language เองจะทับเฉพาะ key นั้น
    $.extend(true, $.fn.dataTable.defaults, { language: {"processing":"\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1b\u0e23\u0e30\u0e21\u0e27\u0e25\u0e1c\u0e25...","search":"\u0e04\u0e49\u0e19\u0e2b\u0e32:","lengthMenu":"\u0e41\u0e2a\u0e14\u0e07 _MENU_ \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e15\u0e48\u0e2d\u0e2b\u0e19\u0e49\u0e32","info":"\u0e41\u0e2a\u0e14\u0e07 _START_ \u0e16\u0e36\u0e07 _END_ \u0e08\u0e32\u0e01 _TOTAL_ \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23","infoEmpty":"\u0e41\u0e2a\u0e14\u0e07 0 \u0e16\u0e36\u0e07 0 \u0e08\u0e32\u0e01 0 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23","infoFiltered":"(\u0e01\u0e23\u0e2d\u0e07\u0e08\u0e32\u0e01\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14 _MAX_ \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23)","zeroRecords":"\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e04\u0e49\u0e19\u0e2b\u0e32","emptyTable":"\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25","loadingRecords":"\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14..."} });
    // ตารางโหลดข้อมูลไม่สำเร็จ: แจ้งเป็น toast แทน alert() ของ DataTables (alert ค้างทั้งหน้า และข้อความเป็นภาษาอังกฤษยาว)
    $.fn.dataTable.ext.errMode = 'none';
    $(document).on('error.dt', function (e, settings, techNote, message) {
        if (window.console) console.error('DataTables:', message);
        if (typeof Swal !== 'undefined') Swal.fire({ toast: true, position: 'top-end', icon: 'error', showConfirmButton: false, timer: 4000, titleText: "\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07" });
    });
