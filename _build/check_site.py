# -*- coding: utf-8 -*-
"""
เปิดทุกหน้าของเว็บทดลองด้วย Chromium (Playwright) แล้วรายงาน: JS error, ไฟล์ที่โหลดไม่ได้, กล่อง alert (เช่น DataTables warning)
ใช้: python check_site.py <base url> <report.json> [จำนวนหน้าพร้อมกัน] [screenshot dir]
"""
import asyncio
import json
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip('/')
REPORT = Path(sys.argv[2])
CONC = int(sys.argv[3]) if len(sys.argv) > 3 else 6
SHOTS = Path(sys.argv[4]) if len(sys.argv) > 4 else None
SITE = Path(__file__).resolve().parent.parent


def page_list():
    t = (SITE / '_demo' / 'pages.js').read_text(encoding='utf-8')
    return list(json.loads(re.search(r'__DEMO_PAGES=(\{.*?\});', t).group(1)).keys())


async def check(browser, path, results, shots):
    ctx = await browser.new_context(viewport={'width': 1440, 'height': 900}, locale='th-TH')
    page = await ctx.new_page()
    r = {'path': path, 'errors': [], 'failed': [], 'dialogs': [], 'console': []}
    page.on('pageerror', lambda e: r['errors'].append(str(e)[:300]))
    page.on('console', lambda m: r['console'].append(m.text[:300]) if m.type == 'error' else None)

    def on_response(resp):
        if resp.status >= 400 and resp.url.startswith(BASE):
            r['failed'].append(f'{resp.status} {resp.url[len(BASE):][:200]}')

    page.on('response', on_response)
    page.on('requestfailed', lambda req: r['failed'].append(f'ERR {req.url[:200]} {req.failure}') if req.url.startswith(BASE) else None)

    async def on_dialog(d):
        r['dialogs'].append(d.message[:300])
        await d.dismiss()

    page.on('dialog', on_dialog)
    try:
        resp = await page.goto(BASE + path, wait_until='load', timeout=30000)
        r['status'] = resp.status if resp else 0
        try:
            await page.wait_for_load_state('networkidle', timeout=8000)
        except Exception:
            pass
        await page.wait_for_timeout(600)
        r['misses'] = await page.evaluate('window.__demoMisses || []')
        r['title'] = await page.title()
        r['final'] = page.url[len(BASE):]
        if shots is not None and path in shots:
            SHOTS.mkdir(parents=True, exist_ok=True)
            await page.screenshot(path=str(SHOTS / (path.strip('/').replace('/', '__') or 'index')) + '.png', full_page=False)
    except Exception as e:
        r['errors'].append('NAV ' + str(e)[:200])
    await ctx.close()
    results.append(r)


async def main():
    paths = page_list()
    shots = set(sys.argv[5].split(',')) if len(sys.argv) > 5 else set()
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        sem = asyncio.Semaphore(CONC)

        async def run(path):
            async with sem:
                await check(browser, path, results, shots)

        await asyncio.gather(*(run(x) for x in paths))
        await browser.close()
    results.sort(key=lambda x: x['path'])
    REPORT.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding='utf-8')
    bad = [x for x in results if x['errors'] or x['failed'] or x['dialogs']]
    print(f'checked {len(results)} pages, with problems {len(bad)}')
    # คำขอ AJAX ที่ยังไม่มีข้อมูล → seeds ให้ capture.php เก็บเพิ่ม (ระบบ → รายการ)
    seeds = {}
    for x in results:
        for m in x.get('misses') or []:
            seeds.setdefault(m['s'], {})[m['m'] + ' ' + m['p']] = {'m': m['m'], 'p': m['p'], 'q': m['q'], 'from': x['path']}
    (REPORT.parent / 'seeds.json').write_text(json.dumps({s: list(v.values()) for s, v in seeds.items()}, ensure_ascii=False, indent=1),
                                              encoding='utf-8')
    print('ajax misses:', {s: len(v) for s, v in seeds.items()})


if __name__ == '__main__':
    asyncio.run(main())
