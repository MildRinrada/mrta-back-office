# -*- coding: utf-8 -*-
"""
ลองทุกหน้า .../create: กรอกช่องที่บังคับ → กดบันทึก → ดูผล (กลับหน้ารายการ / ข้อความสำเร็จ / ข้อความตรวจฟอร์มของหน้า)
ใช้: python create_test.py <base url> <report.json> [screenshot dir]
"""
import asyncio
import json
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip('/')
REPORT = Path(sys.argv[2])
SHOTS = Path(sys.argv[3]) if len(sys.argv) > 3 else None
SITE = Path(__file__).resolve().parent.parent

FILL = r"""
() => {
  const vis = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const form = Array.from(document.querySelectorAll('main form, .content form, form')).find(f => vis(f) && !/logout|search/i.test(f.action)) || document;
  let n = 0;
  form.querySelectorAll('input, textarea, select').forEach(el => {
    if (!vis(el) || el.disabled || el.readOnly) return;
    const t = (el.type || '').toLowerCase();
    if (['hidden','file','checkbox','radio','submit','button','search','password'].includes(t)) return;
    if (el.tagName === 'SELECT') { if (el.options.length > 1 && !el.value) { el.selectedIndex = 1; el.dispatchEvent(new Event('change', {bubbles: true})); n++; } return; }
    if (el.value) return;
    el.value = t === 'email' ? 'demo@example.com' : t === 'number' ? '1' : t === 'date' ? '2026-11-01'
      : t === 'url' ? 'https://example.com' : t === 'tel' ? '0812345678' : t === 'time' ? '09:00' : 'ทดสอบเวอร์ชันทดลอง';
    el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); n++;
  });
  if (window.tinymce) tinymce.get().forEach(ed => { ed.setContent('<p>ทดสอบเวอร์ชันทดลอง</p>'); ed.save(); });
  return n;
}
"""


def creates():
    t = (SITE / '_demo' / 'pages.js').read_text(encoding='utf-8')
    return [p for p in json.loads(re.search(r'__DEMO_PAGES=(\{.*?\});', t).group(1)) if p.endswith('/create')]


async def run_one(browser, path, out):
    ctx = await browser.new_context(viewport={'width': 1440, 'height': 900}, locale='th-TH')
    page = await ctx.new_page()
    r = {'path': path, 'errors': [], 'dialogs': []}
    page.on('pageerror', lambda e: r['errors'].append(str(e)[:150]))

    async def on_dialog(d):
        r['dialogs'].append(d.message[:150])
        await d.accept()

    page.on('dialog', on_dialog)
    try:
        await page.goto(BASE + path, wait_until='load')
        await page.wait_for_timeout(1500)
        r['filled'] = await page.evaluate(FILL)
        btn = page.locator('form button[type=submit]:visible, button:visible:has-text("บันทึก"), button:visible:text-is("Save"), '
                           'input[type=submit]:visible').first
        if not await btn.count():
            r['result'] = 'ไม่พบปุ่มบันทึก'
        else:
            await btn.click()
            await page.wait_for_timeout(2500)
            conf = page.locator('.swal2-confirm:visible')
            if await conf.count():  # หน้าที่ถามยืนยันก่อนบันทึก
                await conf.click()
                await page.wait_for_timeout(2000)
            r['final'] = page.url[len(BASE):]
            r['title'] = await page.title()
            r['toast'] = await page.evaluate("Array.from(document.querySelectorAll('.demo-toast')).map(e => e.textContent).join(' | ')")
            r['swal'] = await page.evaluate("(document.querySelector('.swal2-popup') || {}).innerText || ''")
            r['invalid'] = await page.evaluate("document.querySelectorAll('.is-invalid, .invalid-feedback:not(:empty), :invalid').length")
            if 'ไม่มีในเวอร์ชันทดลอง' in r['title']:
                r['result'] = 'ไปหน้า 404'
            elif r['final'] != path or 'บันทึก' in r['toast'] or 'สำเร็จ' in r['swal']:
                r['result'] = 'บันทึกสำเร็จ'
            elif r['invalid']:
                r['result'] = 'หน้าแจ้งให้กรอกข้อมูลเพิ่ม'
            else:
                r['result'] = 'ไม่มีอะไรเกิดขึ้น'
            if SHOTS and r['result'] in ('ไม่มีอะไรเกิดขึ้น', 'ไปหน้า 404'):
                SHOTS.mkdir(parents=True, exist_ok=True)
                await page.screenshot(path=str(SHOTS / (path.strip('/').replace('/', '__') + '.png')))
    except Exception as e:
        r['result'] = 'ERROR ' + str(e)[:150]
    await ctx.close()
    out.append(r)


async def main():
    out = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        sem = asyncio.Semaphore(6)

        async def go(path):
            async with sem:
                await run_one(b, path, out)

        await asyncio.gather(*(go(x) for x in creates()))
        await b.close()
    out.sort(key=lambda x: x['path'])
    REPORT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    from collections import Counter
    print(Counter(x['result'] for x in out))
    for x in out:
        if x['result'] != 'บันทึกสำเร็จ' or x['errors']:
            print(x['path'], '|', x['result'], '|', x.get('final'), '|', x['errors'][:1], x['dialogs'][:1], (x.get('swal') or '')[:80].replace('\n', ' '))


asyncio.run(main())
