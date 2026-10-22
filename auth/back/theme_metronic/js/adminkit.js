/* ═══════════════════════════════════════════════════════════════
   AdminKit — Shared JavaScript
═══════════════════════════════════════════════════════════════ */

// ═══ THEME TOGGLE ═══
(function () {
    var COOKIE_KEY = 'adminkit_theme';

    // Derive parent domain: 'auth.nesdc.local' → '.nesdc.local'
    function cookieDomain() {
        var parts = location.hostname.split('.');
        return parts.length > 1 ? '.' + parts.slice(1).join('.') : location.hostname;
    }

    function saveTheme(theme) {
        document.cookie = COOKIE_KEY + '=' + theme
            + '; path=/; domain=' + cookieDomain()
            + '; max-age=31536000; SameSite=Lax';
    }

    function getTheme() {
        var m = document.cookie.match(/adminkit_theme=([^;]+)/);
        return m ? m[1] : null;
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        var isDark = theme === 'dark';
        document.getElementById('themeIconMoon')?.classList.toggle('d-none', isDark);
        document.getElementById('themeIconSun')?.classList.toggle('d-none', !isDark);
    }

    // Sync icon with theme already applied by inline <head> script
    var saved = getTheme();
    if (saved) applyTheme(saved);

    // Toggle + persist on click
    document.getElementById('themeToggle')?.addEventListener('click', function () {
        var isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        var next = isDark ? 'light' : 'dark';
        applyTheme(next);
        saveTheme(next);
    });
}());

// ═══ SIDEBAR TOGGLE (Mobile) ═══
function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('show');
    document.getElementById('overlay')?.classList.toggle('show');
}
document.getElementById('overlay')?.addEventListener('click', toggleSidebar);

// ═══ SUBMENU TOGGLE ═══
function toggleSubMenu(el) {
    const sub = el.nextElementSibling;
    const isOpen = sub.classList.contains('open');
    el.classList.toggle('open', !isOpen);
    sub.classList.toggle('open', !isOpen);
}

// ═══ SIDEBAR ACTIVE STATE ═══
document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', function () {
        document.querySelectorAll('.sidebar-nav .nav-link').forEach(n => n.classList.remove('active'));
        this.classList.add('active');
    });
});

// ═══ TAB NAVIGATION FROM SIDEBAR ═══
function showTab(tabId) {
    const btn = document.getElementById(tabId + '-btn');
    if (btn) new bootstrap.Tab(btn).show();
    if (window.innerWidth < 992) toggleSidebar();
}

// ═══ SWEETALERT HELPERS ═══
function showDeleteAlert(name) {
    Swal.fire({
        title: 'ยืนยันการลบ?',
        html: `ต้องการลบ <strong>${name}</strong>?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74a3b',
        cancelButtonColor: '#636e72',
        confirmButtonText: '<i class="fa-solid fa-trash-can"></i> ลบ',
        cancelButtonText: 'ยกเลิก',
        reverseButtons: true
    }).then(r => {
        if (r.isConfirmed) Swal.fire({ title: 'ลบสำเร็จ!', icon: 'success', timer: 1500, showConfirmButton: false });
    });
}

function showEditAlert(name) {
    Swal.fire({ title: 'แก้ไขข้อมูล', text: `เปิดฟอร์มแก้ไข ${name}`, icon: 'info', confirmButtonColor: '#4e73df' });
}

function saveData() {
    const modal = document.getElementById('addModal');
    if (modal) bootstrap.Modal.getInstance(modal)?.hide();
    Swal.fire({ title: 'บันทึกสำเร็จ!', icon: 'success', confirmButtonColor: '#4e73df' });
}

function saveSummernote() {
    var editor = tinymce.get('summernote');
    var c = editor ? editor.getContent() : '';
    if (!c || c.trim() === '') {
        Swal.fire({ icon: 'warning', title: 'ไม่มีเนื้อหา', confirmButtonColor: '#4e73df' });
        return;
    }
    Swal.fire({ icon: 'success', title: 'บันทึกเรียบร้อย!', confirmButtonColor: '#4e73df' });
}

function exportReport() {
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'กำลังส่งออก Excel...', showConfirmButton: false, timer: 2000 });
}

function swalInput() {
    Swal.fire({
        title: 'กรอกชื่อ', input: 'text', inputPlaceholder: 'ชื่อ...',
        showCancelButton: true, confirmButtonColor: '#4e73df',
        inputValidator: v => { if (!v) return 'กรุณากรอก'; }
    }).then(r => {
        if (r.isConfirmed) Swal.fire({ title: 'สวัสดี ' + r.value + '!', icon: 'success', confirmButtonColor: '#4e73df' });
    });
}
