# -*- coding: utf-8 -*-
"""
สร้างเว็บ static หลังบ้าน MRTA (เวอร์ชันทดลอง) จากผล capture.php + ตารางข้อมูลสมมติจาก pii_dict.php

    python build.py <raw dir> <pii.json> <site dir>

1) หน้า HTML → <site>/<ระบบ>/<path>.html (เปิดเป็น /<ระบบ>/<path> ด้วย cleanUrls ของ Vercel)
   ข้อมูล AJAX → <site>/_data/<ระบบ>/*.json + ดัชนี _demo/idx-<ระบบ>.js ให้ demo.js ตอบแทนเซิร์ฟเวอร์
2) แทนข้อมูลส่วนบุคคลด้วยข้อมูลสมมติ (ตาราง + รูปแบบอีเมล / IP / เบอร์มือถือ / เลขบัตร) และล้างค่าลับ (CSRF, รหัสผ่าน, คีย์)
3) URL http://<ระบบ>.mrta.test/... → /<ระบบ>/... แล้วก๊อปไฟล์ static ที่หน้าใช้จาก public ของแต่ละระบบ (TinyMCE ใช้ร่วมชุดเดียว)
4) ใส่ demo.js ต้น <head> ทุกหน้า

ผลดิบจาก capture มีข้อมูลจริง - เก็บไว้นอกโฟลเดอร์ที่ deploy เสมอ
"""
import base64
import hashlib
import json
import posixpath
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import unquote

RAW, PII, SITE = (Path(a) for a in sys.argv[1:4])
SRC = Path(r'C:\XAMPP 8.5')
APPS = {'auth': 'mrta-auth', 'belib': 'mrta-belib', 'booking': 'mrta-booking-2', 'knowledge': 'mrta-knowledge',
        'learnext': 'mrta-learnext', 'news': 'mrta-news', 'portal': 'mrta-portal'}
SYS_ALT = '|'.join(APPS)
HOME = '/portal/admin'  # หน้าแรกของเว็บทดลอง
OK_STYLE = {'booking': 'success'}  # ระบบที่ JS ส่วนใหญ่เช็ก status === 'success' (ที่เหลือเช็ก 200)
TINY_SRC = 'back/theme_metronic/vendor/tinymce_8.3.2'
MAX_ASSET = 8 * 1024 * 1024
ASSET_EXT = 'css|js|mjs|png|jpe?g|gif|svg|webp|ico|bmp|avif|woff2?|ttf|eot|otf|json|map|mp3|wav|txt|xml'
STOP = {'admin', 'test', 'user', 'member', 'demo', 'tester', 'staff', 'guest', 'system', 'root', 'manager', 'editor', 'viewer'}
FILE_TLD = {'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'css', 'js', 'json', 'map', 'woff', 'woff2', 'ttf', 'ico', 'php',
            'html', 'txt', 'xml', 'pdf', 'min'}
ROLE_MAIL = {'info', 'contact', 'noreply', 'no-reply', 'support', 'webmaster', 'library', 'callcenter', 'saraban', 'pr', 'admin'}
SECRET_KEY = re.compile(r'(secret|password|passwd|pwd|api_?key|apikey|private_?key|access_?token|smtp_?pass|app_?key|jwt|'
                        r'remember_token|two_factor|temp_token|^token$|data_info|recovery)', re.I)


class Scrub:
    """แทนข้อมูลส่วนบุคคลจริงด้วยข้อมูลสมมติ"""

    MASKED_EMAIL = re.compile(r'(?<![A-Za-z0-9._%+\-])([A-Za-z0-9._%+\-]{1,3})(\*{3,})@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})')
    EMAIL = re.compile(r'(?<![A-Za-z0-9._%+\-])([A-Za-z0-9._%+\-]+)@([A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.([A-Za-z]{2,}))(?![A-Za-z0-9\-])')
    IP = re.compile(r'(?<![\w.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\w]|\.\d)')
    MASKED_IP = re.compile(r'(?<![\w.])(\d{1,3})\.(\d{1,3})\.x\.x(?!\w)')
    PHONE = re.compile(r'(?<![\d])(0[689]\d)([- ]?)(\d{3})([- ]?)(\d{4})(?![\d])')
    IDCARD = re.compile(r'(?<![\d-])(\d)-(\d{4})-(\d{5})-(\d{2})-(\d)(?![\d-])')
    CANARY = re.compile(r'mrta_(?:sso|live)_sk_[0-9a-f]+')
    PII_TOKEN = re.compile(r'data-pii=(\\?)"demo:([A-Za-z0-9+/=]*)\\?"')

    def __init__(self, d):
        self.allow = set(d.get('allow', []))
        self.allow_digits = {re.sub(r'\D', '', a) for a in self.allow if re.sub(r'\D', '', a)}
        self.map = {}
        for real, fake in list(d['pairs'].items()) + list(d['masked'].items()):
            r = real.strip()
            if len(r) < 3 or (r.isdigit() and len(r) < 6) or r.lower() in STOP:
                continue
            self.map.setdefault(r, fake)
            if not r.isascii():
                # ชื่อภาษาไทยใน @json(...) ของสคริปต์ถูก escape เป็น \u0e..
                self.map.setdefault(json.dumps(r)[1:-1], json.dumps(fake)[1:-1])
        keys = sorted(self.map, key=len, reverse=True)
        plain = [k for k in keys if not k.isascii() or k.startswith('\\u')]
        words = [k for k in keys if k.isascii() and not k.startswith('\\u')]
        self.re_plain = re.compile('|'.join(map(re.escape, plain))) if plain else None
        self.re_words = re.compile(r'(?<![A-Za-z0-9_@.])(?:' + '|'.join(map(re.escape, words)) + r')(?![A-Za-z0-9_])') if words else None
        self.ips, self.emails, self.phones = {}, {}, {}

    @staticmethod
    def _h(s, n):
        return int(hashlib.md5(s.encode('utf-8')).hexdigest()[:8], 16) % n

    def _email(self, m):
        full, local, dom, tld = m.group(0), m.group(1), m.group(2).lower(), m.group(3).lower()
        if tld in FILE_TLD or dom.endswith('example.com') or full in self.allow or local.lower() in ROLE_MAIL:
            return full
        if full not in self.emails:
            self.emails[full] = f'person{len(self.emails) + 1}@example.com'
        return self.emails[full]

    def _masked_email(self, m):
        return m.group(0) if m.group(3).lower().endswith('example.com') else 'pe*****@example.com'

    def _ip(self, m):
        parts = [int(x) for x in m.groups()]
        if any(p > 255 for p in parts) or m.group(0) == '0.0.0.0':
            return m.group(0)
        ip = m.group(0)
        if ip not in self.ips:
            n = len(self.ips)
            self.ips[ip] = f'203.0.113.{10 + n}' if n < 240 else f'198.51.100.{n - 230}'
        return self.ips[ip]

    def _phone(self, m):
        digits = ''.join(m.group(1, 3, 5))
        if digits in self.allow_digits:
            return m.group(0)
        h = hashlib.md5(('p' + digits).encode()).hexdigest()
        fake = ''.join(str(int(c, 16) % 10) for c in h[:7])
        return f'{m.group(1)}{m.group(2)}{fake[:3]}{m.group(4)}{fake[3:]}'

    def _id(self, m):
        h = hashlib.md5(('id' + m.group(0)).encode()).hexdigest()
        d = '1' + ''.join(str(int(c, 16) % 10) for c in h[:11])
        d += str((11 - sum(int(d[i]) * (13 - i) for i in range(12)) % 11) % 10)
        return f'{d[0]}-{d[1:5]}-{d[5:10]}-{d[10:12]}-{d[12]}'

    def text(self, s):
        s = self.PII_TOKEN.sub(self._token, s)
        if self.re_plain:
            s = self.re_plain.sub(lambda m: self.map[m.group(0)], s)
        if self.re_words:
            s = self.re_words.sub(lambda m: self.map[m.group(0)], s)
        s = self.MASKED_EMAIL.sub(self._masked_email, s)
        s = self.EMAIL.sub(self._email, s)
        s = self.IP.sub(self._ip, s)
        s = self.MASKED_IP.sub('203.0.x.x', s)
        s = self.PHONE.sub(self._phone, s)
        s = self.IDCARD.sub(self._id, s)
        return self.CANARY.sub('demo_key', s)

    def _token(self, m):
        try:
            v = base64.b64decode(m.group(2)).decode('utf-8')
        except Exception:
            v = ''
        v = self.text(v) if v else v
        return f'data-pii={m.group(1)}"demo:{base64.b64encode(v.encode("utf-8")).decode()}{m.group(1)}"'


# ---------------------------------------------------------------- URL
HOST_RE = re.compile(r'(?:https?:)?(\\?/)\\?/(' + SYS_ALT + r')\.mrta\.test(?::\d+)?', re.I)
ATTR_RE = re.compile(r'''(\s(?:href|src|action|data-url|data-href|data-src|data-action|poster|formaction)\s*=\s*["'])/(?![/\\])'''
                     r'''(?!(?:%s|_demo|_data|_shared)(?:[/"'?#]))''' % SYS_ALT, re.I)
CSSURL_RE = re.compile(r'''(url\(\s*["']?)/(?![/\\])(?!(?:%s|_demo|_data|_shared)/)''' % SYS_ALT, re.I)
TINY_RE = re.compile(r'(\\?/)(?:%s)\\?/back\\?/theme_metronic\\?/vendor\\?/tinymce_8\.3\.2\\?/' % SYS_ALT)
ASSET_RE = re.compile(r'(?<![\w])/(%s)/([^"\'\s()<>\\?#,&]+?\.(?:%s))(?=[?#"\'\s)<>\\,&]|$)' % (SYS_ALT, ASSET_EXT), re.I)
CSS_REF = re.compile(r'''url\(\s*["']?([^"')]+?)["']?\s*\)|@import\s+["']([^"']+)["']''', re.I)


ESC_ATTR_RE = re.compile(r'''((?:src|href)=(?:&quot;|&\#0?39;|\\"))/(?![/\\])(?!(?:%s|_demo|_data|_shared)/)''' % SYS_ALT, re.I)
WS_RE = re.compile(r'"ws":\{"key":"[^"]*","host":"[a-z]+\.mrta\.test"')
COOKIE_SCRIPT_RE = re.compile(r'<script\b[^>]*\ssrc="[^"]*/cookie-consent/script[^"]*"[^>]*>\s*</script>', re.I)


def rewrite_urls(s, sys_):
    """path ที่ขึ้นต้นด้วย / ของระบบนี้ → /<ระบบ>/... แล้ว http://<ระบบ>.mrta.test → /<ระบบ>"""
    s = ATTR_RE.sub(lambda m: m.group(1) + '/' + sys_ + '/', s)
    s = ESC_ATTR_RE.sub(lambda m: m.group(1) + '/' + sys_ + '/', s)  # HTML ใน textarea ของ editor (&quot;) / ใน JSON (\")
    s = CSSURL_RE.sub(lambda m: m.group(1) + '/' + sys_ + '/', s)
    s = HOST_RE.sub(lambda m: m.group(1) + m.group(2).lower(), s)
    s = WS_RE.sub('"ws":{"key":"demo","host":"ws.demo.invalid"', s)  # แจ้งเตือนสด (Reverb) ไม่มีในเวอร์ชันทดลอง
    return TINY_RE.sub(lambda m: m.group(1) + '_shared' + m.group(1) + 'tinymce_8.3.2' + m.group(1), s)


def scrub_secrets_html(s):
    s = COOKIE_SCRIPT_RE.sub('', s)  # สคริปต์แบนเนอร์คุกกี้ที่เซิร์ฟเวอร์สร้างสด (หน้าบ้าน) ไม่มีในเวอร์ชันทดลอง
    s = re.sub(r'<script\b[^>]*id="browser-logger-active"[^>]*>.*?</script>', '', s, flags=re.S | re.I)  # เครื่องมือ dev (Laravel Boost)
    s = re.sub(r'(<meta\s+name="csrf-token"\s+content=")[^"]*(")', r'\1demo-token\2', s, flags=re.I)
    s = re.sub(r'''((?:csrf[_-]?token|_token)["']?\s*[:,=]\s*["'])[A-Za-z0-9]{40}(["'])''', r'\1demo-token\2', s, flags=re.I)

    def inp(m):
        tag = m.group(0)
        name = re.search(r'''name\s*=\s*["']([^"']*)["']''', tag, re.I)
        name = name.group(1) if name else ''
        if name == '_token':
            return re.sub(r'''\svalue\s*=\s*("[^"]*"|'[^']*')''', ' value="demo-token"', tag)
        if re.search(r'''type\s*=\s*["']password["']''', tag, re.I) or SECRET_KEY.search(name):
            return re.sub(r'''\svalue\s*=\s*("[^"]*"|'[^']*')''', ' value=""', tag)
        return tag

    return re.sub(r'<input\b[^>]*>', inp, s, flags=re.I)


def scrub_json(v, scrub, sys_):
    if isinstance(v, dict):
        return {k: (None if isinstance(k, str) and SECRET_KEY.search(k) and not isinstance(val, (dict, list)) else scrub_json(val, scrub, sys_))
                for k, val in v.items()}
    if isinstance(v, list):
        return [scrub_json(x, scrub, sys_) for x in v]
    if isinstance(v, str):
        return scrub.text(rewrite_urls(v, sys_))
    return v


# ---------------------------------------------------------------- ไฟล์ static
copied, missing = set(), set()
css_deps = {}  # (ระบบ, css rel) → rel ของไฟล์ที่ css อ้างแบบ relative
AVATARS = []
DT_MAX_ROWS = 300  # ตาราง DataTables เก็บไว้ไม่เกินกี่แถว (log บางตารางมีหลายพันแถว)
INLINE_MIN, INLINE_PAGES = 1500, 4  # บล็อก <script>/<style> ยาวเท่านี้ขึ้นไปและซ้ำกันเท่านี้หน้าขึ้นไป → แยกเป็นไฟล์กลาง


def copy_asset(sys_, rel):
    rel = posixpath.normpath(unquote(rel).lstrip('/'))
    if rel.startswith('..') or (sys_, rel) in copied:
        return
    copied.add((sys_, rel))
    app = SRC / APPS[sys_]
    src = app / 'public' / rel
    if not src.is_file() and rel.startswith('storage/'):
        src = app / 'storage' / 'app' / 'public' / rel[8:]
    if any(a and rel.endswith(a) for a in AVATARS):
        src = app / 'public' / 'client/default/images/placeholder/default-avatar.png'
    if not src.is_file():
        missing.add(f'/{sys_}/{rel}')
        return
    if src.stat().st_size > MAX_ASSET:
        missing.add(f'/{sys_}/{rel} (ใหญ่เกิน {src.stat().st_size // 1048576}MB)')
        return
    dst = SITE / sys_ / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    low = rel.lower()
    if low.endswith('.css'):
        css = src.read_text(encoding='utf-8', errors='replace')
        css = CSSURL_RE.sub(lambda m: m.group(1) + '/' + sys_ + '/', HOST_RE.sub(lambda m: m.group(1) + m.group(2).lower(), css))
        for a, b in CSS_REF.findall(css):
            ref = (a or b).strip().split('?')[0].split('#')[0]
            if not ref or re.match(r'^(data:|https?:|//|about:)', ref, re.I):
                continue
            if ref.startswith('/'):
                m = re.match(r'^/(%s)/(.+)$' % SYS_ALT, ref)
                if m:
                    copy_asset(m.group(1), m.group(2))
            else:
                dep = posixpath.normpath(posixpath.join(posixpath.dirname(rel), ref))
                css_deps.setdefault((sys_, rel), set()).add(dep)
                copy_asset(sys_, dep)
        dst.write_text(css, encoding='utf-8')
    elif low.endswith('.js'):
        b = src.read_bytes()
        if b'.mrta.test' in b:
            t = b.decode('utf-8', errors='surrogateescape')
            dst.write_bytes(HOST_RE.sub(lambda m: m.group(1) + m.group(2).lower(), t).encode('utf-8', errors='surrogateescape'))
        else:
            shutil.copyfile(src, dst)
    else:
        shutil.copyfile(src, dst)


def collect_assets(text):
    for m in ASSET_RE.finditer(text.replace('\\/', '/')):
        copy_asset(m.group(1).lower(), m.group(2))


# ---------------------------------------------------------------- หน้า
def page_file(sys_, path):
    p = unquote(path).strip('/')
    return SITE / sys_ / ((p or 'index') + '.html')


OK_SUCCESS = re.compile(r'''\.status\s*[!=]==?\s*["']success["']''')
OK_200 = re.compile(r'''\.status\s*[!=]==?\s*["']?20[01]\b''')
INLINE_RE = re.compile(r'<(script|style)\b([^>]*)>(.*?)</\1>', re.S | re.I)


def ok_style(html, sys_):
    """สคริปต์ในหน้านี้เช็กผลบันทึกแบบไหน (นับก่อนแยกบล็อกออกเป็นไฟล์กลาง)"""
    js = ' '.join(m.group(3) for m in INLINE_RE.finditer(html) if m.group(1).lower() == 'script' and 'src=' not in m.group(2))
    a, b = len(OK_SUCCESS.findall(js)), len(OK_200.findall(js))
    return 'success' if a > b else (200 if b > a else OK_STYLE.get(sys_, 200))


def inject(html, sys_, path, style=200):
    cfg = json.dumps({'sys': sys_, 'path': path, 'okStyle': style})
    tags = ('<meta name="robots" content="noindex, nofollow">'
            f'<script>window.__DEMO={cfg};</script>'
            '<script src="/_demo/pages.js"></script>'
            f'<script src="/_demo/idx-{sys_}.js"></script>'
            '<script src="/_demo/demo.js"></script>'
            '<link rel="stylesheet" href="/_demo/demo.css">')
    html = re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>', '', html, flags=re.I)
    m = re.search(r'<head\b[^>]*>', html, re.I)
    return html[:m.end()] + tags + html[m.end():] if m else tags + html


def redirect_stub(target):
    t = json.dumps(target)
    return ('<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow">'
            f'<meta http-equiv="refresh" content="0;url={target}"><title>กำลังเปิดหน้า</title>'
            f'<script>location.replace({t});</script></head><body></body></html>')


def externalize_inline(pages_html):
    """บล็อก <script>/<style> ที่ซ้ำกันหลายหน้า (layout / sidebar / แถบเครื่องมือ) → ไฟล์กลาง /_shared/inline/*"""
    count = {}
    for html in pages_html.values():
        for block in set(m.group(0) for m in INLINE_RE.finditer(html)):
            count[block] = count.get(block, 0) + 1
    out_dir = SITE / '_shared' / 'inline'
    out_dir.mkdir(parents=True, exist_ok=True)
    repl = {}
    for block, n in count.items():
        m = INLINE_RE.fullmatch(block)
        tag, attrs, body = m.group(1).lower(), m.group(2), m.group(3)
        if n < INLINE_PAGES or len(body) < INLINE_MIN or 'src=' in attrs.lower():
            continue
        key = hashlib.sha1(body.encode('utf-8')).hexdigest()[:16]
        if tag == 'script':
            typ = re.search(r'''type\s*=\s*["']([^"']+)["']''', attrs, re.I)
            if typ and typ.group(1).lower() not in ('text/javascript', 'module', 'application/javascript'):
                continue  # JSON / template ที่สคริปต์อื่นอ่าน textContent
            if re.search(r'document\.currentScript|document\.write', body):
                continue
            (out_dir / f'{key}.js').write_text(body, encoding='utf-8')
            repl[block] = f'<script{attrs} src="/_shared/inline/{key}.js"></script>'
        else:
            if attrs.strip() and not re.fullmatch(r'''\s*type\s*=\s*["']text/css["']\s*''', attrs, re.I):
                continue
            if re.search(r'''url\(\s*["']?(?!/|data:|https?:|#)''', body, re.I):
                continue  # url แบบ relative จะเพี้ยนเมื่อย้ายไฟล์
            (out_dir / f'{key}.css').write_text(body, encoding='utf-8')
            repl[block] = f'<link rel="stylesheet" href="/_shared/inline/{key}.css">'
    if not repl:
        return pages_html
    rx = re.compile('|'.join(map(re.escape, sorted(repl, key=len, reverse=True))))
    return {k: rx.sub(lambda m: repl[m.group(0)], v) for k, v in pages_html.items()}


def dedupe_assets(texts):
    """ไฟล์ static ที่เนื้อหาเหมือนกันทุกไบต์ใน path เดียวกันข้ามระบบ → /_shared/a/<path> ใช้ร่วมกัน (ธีม / ไลบรารี)"""
    groups = {}
    for sys_, rel in copied:
        f = SITE / sys_ / rel
        if f.is_file():
            groups.setdefault((rel, hashlib.sha1(f.read_bytes()).hexdigest()), []).append(sys_)
    shared = {}  # ระบบ → rel ที่ย้ายไปใช้ร่วม
    for (rel, _), systems in groups.items():
        if len(systems) < 2:
            continue
        first = systems[0]
        dst = SITE / '_shared' / 'a' / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SITE / first / rel, dst)
        for dep in css_deps.get((first, rel), ()):  # css ที่ย้ายไป ต้องมีไฟล์ที่อ้างแบบ relative อยู่ข้าง ๆ ด้วย
            src, out = SITE / first / dep, SITE / '_shared' / 'a' / dep
            if src.is_file() and not out.exists():
                out.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, out)
        for s in systems:
            shared.setdefault(s, set()).add(rel)
    if not shared:
        return texts

    rx = {}
    for s, rels in shared.items():
        alts = '|'.join(re.escape(r).replace('/', r'\\?/') for r in sorted(rels, key=len, reverse=True))
        rx[s] = re.compile(r'(\\?/)%s\\?/(%s)(?=[?#"\'\s)<>\\,&]|$)' % (s, alts))

    def fix(text):
        for r in rx.values():
            text = r.sub(lambda m: m.group(1) + '_shared' + m.group(1) + 'a' + m.group(1) + m.group(2), text)
        return text

    texts = {k: fix(v) for k, v in texts.items()}
    # css/js ทั้งที่อยู่ในแต่ละระบบและที่ย้ายไปแล้ว อาจอ้างไฟล์ที่ย้ายแบบ /<ระบบ>/...
    targets = [SITE / s / r for s, r in copied] + list((SITE / '_shared' / 'a').rglob('*'))
    for f in targets:
        if f.is_file() and f.suffix.lower() in ('.css', '.js'):
            t = f.read_text(encoding='utf-8', errors='surrogateescape')
            t2 = fix(t)
            if t2 != t:
                f.write_text(t2, encoding='utf-8', errors='surrogateescape')
    # ลบสำเนาในแต่ละระบบ ยกเว้นไฟล์ที่ css ของระบบนั้น (ที่ไม่ได้ย้าย) อ้างแบบ relative
    keep = {(s, dep) for (s, css), deps in css_deps.items() if css not in shared.get(s, ()) for dep in deps}
    for s, rels in shared.items():
        for rel in rels:
            if (s, rel) not in keep:
                (SITE / s / rel).unlink(missing_ok=True)
    return texts


def main():
    d = json.loads(PII.read_text(encoding='utf-8'))
    AVATARS.extend(a for a in d.get('avatars', []) if a)
    scrub = Scrub(d)

    # ล้างผลรอบก่อน (คงไฟล์ที่เขียนมือ: _build, _demo/demo.*, 404.html, vercel.json)
    for name in list(APPS) + ['_data', '_shared']:
        shutil.rmtree(SITE / name, ignore_errors=True)
    for f in (SITE / '_demo').glob('idx-*.js'):
        f.unlink()

    pages, redirs = {}, {}
    idx = {s: {} for s in APPS}
    page_html, page_meta, data_text = {}, {}, {}
    stats = {}

    # ---- 1) แปลงทุกรายการ (ยังไม่เขียนไฟล์) + ก๊อปไฟล์ static ที่ใช้
    for sys_ in APPS:
        man = json.loads((RAW / sys_ / 'manifest.json').read_text(encoding='utf-8'))
        n_page = n_data = 0
        for e in man['entries']:
            path, kind = e['p'], e.get('kind')
            if e.get('g'):
                continue  # หน้าบ้าน (login / สมัครสมาชิก) ไม่อยู่ในเว็บทดลอง - มีเฉพาะหลังบ้าน
            if kind == 'redirect':
                loc = e['loc']
                redirs[f'/{sys_}{path}'.rstrip('/')] = f'/{sys_}{loc}' if loc.startswith('/') else rewrite_urls(loc, sys_)
                continue
            raw = (RAW / sys_ / e['f']).read_text(encoding='utf-8', errors='replace')
            if kind == 'json':
                try:
                    j = json.loads(raw)
                    if isinstance(j, dict):
                        j.pop('queries', None)  # yajra โหมด debug แนบ SQL ที่รัน + input มาด้วย
                        j.pop('input', None)
                    if e.get('dt') and isinstance(j, dict) and isinstance(j.get('data'), list) and len(j['data']) > DT_MAX_ROWS:
                        j['data'] = j['data'][:DT_MAX_ROWS]
                    body = json.dumps(scrub_json(j, scrub, sys_), ensure_ascii=False, separators=(',', ':'))
                    body = body.replace('<', '\\u003c')  # ให้ $.load() ที่ได้ JSON ไม่เอาแท็ก <script> ในข้อความไปรัน
                except ValueError:
                    body = scrub.text(rewrite_urls(raw, sys_))
                collect_assets(body.replace('\\u003c', '<'))
                key = hashlib.sha1(f"{e['m']} {path} {e.get('x', '')}".encode()).hexdigest()[:20]
                data_text[f'_data/{sys_}/{key}.json'] = body
                entry = {'f': f'/_data/{sys_}/{key}.json', 't': 'json'}
                if e.get('dt'):
                    entry['dt'] = 1
                k = ('XHR ' if e.get('x') else e['m'] + ' ') + path
                idx[sys_][k] = entry
                if re.search(r'/\d{10,}$', path):  # ตัวกันแคช (timestamp) ท้าย URL - demo.js ตัดออกก่อนหา
                    idx[sys_].setdefault(re.sub(r'/\d{10,}$', '', k), entry)
                n_data += 1
                continue
            html = scrub.text(scrub_secrets_html(rewrite_urls(raw, sys_)))
            collect_assets(html)
            if kind == 'fragment':
                key = hashlib.sha1(f"{e['m']} {path}".encode()).hexdigest()[:20]
                data_text[f'_data/{sys_}/{key}.html'] = html
                idx[sys_][f"{e['m']} {path}"] = {'f': f'/_data/{sys_}/{key}.html', 't': 'html'}
                n_data += 1
                continue
            rel = page_file(sys_, path).relative_to(SITE).as_posix()
            page_meta[rel] = (sys_, path, ok_style(html, sys_))
            page_html[rel] = html
            pages[f'/{sys_}{path}'.rstrip('/')] = 1
            n_page += 1
        stats[sys_] = (n_page, n_data)

    # ---- 2) ไฟล์ซ้ำข้ามระบบ → ใช้ร่วม / บล็อก inline ที่ซ้ำ → ไฟล์กลาง
    shutil.copytree(SRC / APPS['portal'] / 'public' / TINY_SRC, SITE / '_shared' / 'tinymce_8.3.2')
    merged = dedupe_assets({**{'P:' + k: v for k, v in page_html.items()}, **{'D:' + k: v for k, v in data_text.items()}})
    page_html = {k[2:]: v for k, v in merged.items() if k.startswith('P:')}
    data_text = {k[2:]: v for k, v in merged.items() if k.startswith('D:')}
    page_html = externalize_inline(page_html)

    # ---- 3) เขียนไฟล์
    for rel, html in page_html.items():
        sys_, path, style = page_meta[rel]
        out = SITE / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(inject(html, sys_, path, style), encoding='utf-8')
    for rel, body in data_text.items():
        out = SITE / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(body, encoding='utf-8')
    for src, target in redirs.items():
        if src in pages:
            continue
        sys_ = src.split('/')[1]
        out = page_file(sys_, src[len(sys_) + 1:])
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(redirect_stub(target), encoding='utf-8')
    # หน้าแรกของเว็บทดลอง = หลังบ้าน portal (vercel.json redirect ให้ด้วย ไฟล์นี้ใช้ตอนเปิดในเครื่อง)
    (SITE / 'index.html').write_text(redirect_stub(HOME), encoding='utf-8')
    redirs['/'] = HOME

    demo = SITE / '_demo'
    (demo / 'pages.js').write_text(
        'window.__DEMO_PAGES=' + json.dumps(pages, ensure_ascii=False, separators=(',', ':')) + ';\n'
        'window.__DEMO_REDIR=' + json.dumps(redirs, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    for sys_, m in idx.items():
        (demo / f'idx-{sys_}.js').write_text('window.__DEMO_IDX=' + json.dumps(m, ensure_ascii=False, separators=(',', ':')) + ';\n',
                                             encoding='utf-8')

    # ---- 4) ตรวจข้อมูลจริงหลงเหลือ (ค่าที่บังเอิญอยู่ในค่าสมมติไม่นับ)
    fakes = set(d['pairs'].values()) | set(d['masked'].values())
    reals = [k for k in d['pairs'] if len(k.strip()) >= 3 and k.strip().lower() not in STOP
             and not (k.isdigit() and len(k) < 6) and not any(k in f for f in fakes)]
    leftovers = {}
    for f in SITE.rglob('*'):
        if not f.is_file() or f.suffix not in ('.html', '.json', '.js', '.css') or {'_build', '.git', 'tinymce_8.3.2'} & set(f.parts):
            continue
        t = f.read_text(encoding='utf-8', errors='ignore')
        for k in reals:
            if k in t:
                leftovers.setdefault(k, []).append(f.relative_to(SITE).as_posix())

    files = [f for f in SITE.rglob('*') if f.is_file() and not {'_build', '.git'} & set(f.parts)]
    print('pages/data per system:', stats)
    print(f'pages {len(pages)}, redirects {len(redirs)}, assets {len(copied)}, missing {len(missing)}')
    print(f'site size {sum(f.stat().st_size for f in files) / 1048576:.1f} MB, files {len(files)}')
    print('replaced: emails', len(scrub.emails), 'ips', len(scrub.ips))
    print('LEFTOVER real values:', {k[:2] + '…': (len(v), v[:2]) for k, v in leftovers.items()} or 'none')
    (RAW / 'missing-assets.txt').write_text('\n'.join(sorted(missing)), encoding='utf-8')


if __name__ == '__main__':
    main()
