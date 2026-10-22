# -*- coding: utf-8 -*-
"""
เปิดเว็บทดลองในเครื่องแบบเดียวกับ Vercel (cleanUrls: /a/b → a/b.html, ไม่เจอ → 404.html)
ใช้: python serve.py [port]   แล้วเปิด http://localhost:8787
"""
import http.server
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        if path.startswith('/_build'):
            return self._not_found()
        target = ROOT / path.lstrip('/')
        if path.endswith('/') and path != '/':
            self.send_response(308)
            self.send_header('Location', path.rstrip('/'))
            self.end_headers()
            return None
        if target.is_file():
            return super().send_head()
        for cand in (ROOT / (path.strip('/') + '.html'), target / 'index.html'):
            if cand.is_file():
                self.path = '/' + cand.relative_to(ROOT).as_posix()
                return super().send_head()
        return self._not_found()

    def _not_found(self):
        body = (ROOT / '404.html').read_bytes()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return None

    def guess_type(self, path):
        if str(path).endswith('.js'):
            return 'text/javascript; charset=utf-8'
        if str(path).endswith('.json'):
            return 'application/json; charset=utf-8'
        return super().guess_type(path)


if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as s:
        print(f'http://localhost:{PORT}')
        s.serve_forever()
