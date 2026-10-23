# -*- coding: utf-8 -*-
"""
ทดสอบ flow หลักของเว็บทดลองด้วยเบราว์เซอร์จริง: เข้าสู่ระบบ → ตาราง (ค้นหา/เปลี่ยนหน้า) → ดูข้อมูลเต็ม → สร้าง/บันทึก → ลบ → สลับระบบ → ลิงก์หน้าบ้าน → ออกจากระบบ
ใช้: python flow_test.py <base url> <screenshot dir>
"""
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip('/')
SHOTS = Path(sys.argv[2])
SHOTS.mkdir(parents=True, exist_ok=True)
results = []


def ok(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f' - {detail}' if detail else ''))


async def toast_text(page):
    await page.wait_for_timeout(400)
    return await page.evaluate("Array.from(document.querySelectorAll('.demo-toast')).map(e => e.textContent).join(' | ')")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, locale='th-TH')
        page = await ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(f'{page.url[len(BASE):]}: {str(e)[:120]}'))
        page.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))

        # 0) หน้าแรกของเว็บ = หลังบ้าน portal
        await page.goto(BASE + '/')
        await page.wait_for_load_state('load')
        ok('หน้าแรก → หลังบ้าน portal', page.url.endswith('/portal/admin'), page.url[len(BASE):])
        await page.screenshot(path=str(SHOTS / '01-home.png'))
        r = await ctx.request.get(BASE + '/auth/login')
        ok('ไม่มีหน้าบ้าน (หน้า login)', r.status == 404, f'/auth/login → {r.status}')

        # 2) ตารางผู้ใช้: แถว / ค้นหา / ดูข้อมูลเต็ม
        await page.goto(BASE + '/portal/admin/user')
        await page.wait_for_timeout(1500)
        rows = await page.locator('table tbody tr').count()
        ok('ตารางผู้ใช้มีข้อมูล', rows > 3, f'{rows} แถว')
        search = page.locator('input[type=search], input[placeholder*="ค้นหา"]').first
        if await search.count():
            await search.fill('Piyanuch')
            await search.press('Enter')
            await page.wait_for_timeout(1500)
            rows2 = await page.locator('table tbody tr').count()
            ok('ค้นหาในตารางกรองแถวได้', 0 < rows2 < rows, f'{rows} → {rows2} แถว')
            await search.fill('')
            await search.press('Enter')
            await page.wait_for_timeout(1000)
        eye = page.locator('.pii-eye').first
        if await eye.count():
            before = await page.locator('.pii').first.text_content()
            await eye.click()
            await page.wait_for_timeout(800)
            after = await page.locator('.pii').first.text_content()
            ok('ปุ่มดูข้อมูลเต็ม (ค่าสมมติ)', before != after and '*' not in (after or ''), f'{before} → {after}')
        await page.screenshot(path=str(SHOTS / '02-user-list.png'))

        # 3) สร้างข่าว → บันทึก → กลับหน้ารายการ
        await page.goto(BASE + '/news/admin/news/create')
        await page.wait_for_timeout(1500)
        title = page.locator('form input[type=text]:visible').first
        if await title.count():
            await title.fill('ข่าวทดสอบเวอร์ชันทดลอง')
        await page.screenshot(path=str(SHOTS / '03-news-create.png'))
        save = page.locator('form button[type=submit]:visible, button:visible:has-text("บันทึก")').first
        url_before = page.url
        if await save.count():
            await save.click()
            await page.wait_for_timeout(2500)
            t = await toast_text(page)
            await page.screenshot(path=str(SHOTS / '04-news-after-save.png'))
            ok('บันทึกข่าว → กลับหน้ารายการ/แจ้งบันทึก', page.url != url_before or 'บันทึก' in t, f'{page.url[len(BASE):]} toast="{t}"')
        else:
            ok('พบปุ่มบันทึกในหน้าสร้างข่าว', False)

        # 4) ลบในตาราง (SweetAlert ยืนยัน → AJAX)
        await page.goto(BASE + '/news/admin/news')
        await page.wait_for_timeout(1500)
        menu = page.locator('table tbody [data-bs-toggle="dropdown"]').first
        if await menu.count():
            await menu.click()
            await page.wait_for_timeout(300)
        delete = page.locator('table tbody .dropdown-menu.show :is(a,button):has-text("ลบ"), '
                              'table tbody [class*="delete"]:visible, table tbody :is(a,button)[title*="ลบ"]:visible').first
        if await delete.count():
            await delete.click()
            await page.wait_for_timeout(700)
            confirm = page.locator('.swal2-confirm:visible')
            if await confirm.count():
                await confirm.click()
                await page.wait_for_timeout(1500)
            body = await page.evaluate("(document.querySelector('.swal2-popup') || {}).innerText || ''")
            await page.screenshot(path=str(SHOTS / '05-news-after-delete.png'))
            ok('ลบรายการ → ขึ้นผลสำเร็จ', 'ไม่สำเร็จ' not in body and 'error' not in body.lower(), body[:120].replace('\n', ' '))
        else:
            ok('พบปุ่มลบในตารางข่าว', False)

        # 5) สลับระบบจากเมนู (portal → belib)
        await page.goto(BASE + '/portal/admin')
        link = page.locator('a[href^="/belib/admin"]').first
        if await link.count() and not await link.is_visible():
            await page.locator('.dropdown:has(a[href^="/belib/admin"]) > [data-bs-toggle="dropdown"]').first.click()
            await page.wait_for_timeout(300)
        if await link.count():
            await link.click()
            await page.wait_for_load_state('load')
            ok('สลับไประบบ e-Library', '/belib/admin' in page.url, page.url[len(BASE):])
        else:
            ok('พบลิงก์ไประบบ e-Library', False)

        # 6) ลิงก์หน้าบ้าน → แจ้งเตือน ไม่เปิดหน้าเปล่า
        await page.goto(BASE + '/portal/admin')
        front = page.locator('a[href="/portal/home"], a[href="/portal"], a[href="/portal/"]').first
        if await front.count():
            await front.click(force=True)
            t = await toast_text(page)
            ok('ลิงก์หน้าบ้าน → แจ้งว่ามีเฉพาะหลังบ้าน', page.url.endswith('/portal/admin') and 'หลังบ้าน' in t, t)

        # 7) ออกจากระบบ: ทุกระบบต้องอยู่หน้าเดิม (ไม่พาไปหน้าบ้าน / หน้า login)
        for home in ['/portal/admin', '/auth/admin/reward', '/belib/admin/dashboard', '/booking/admin', '/knowledge/admin',
                     '/learnext/admin/dashboard', '/news/admin']:
            await page.goto(BASE + home)
            await page.wait_for_timeout(800)
            out = page.locator('.sb-logout, a[href*="logout"], form[action*="logout"] button, :is(a,button):has-text("ออกจากระบบ")').first
            if not await out.count():
                ok(f'พบปุ่มออกจากระบบ {home}', False)
                continue
            await out.click(force=True)
            confirm = page.locator('.swal2-confirm:visible')
            try:
                await confirm.wait_for(timeout=3000)
                await confirm.click()
            except Exception:
                pass  # บางระบบไม่ถามยืนยัน
            await page.wait_for_timeout(800)
            t = await toast_text(page)
            ok(f'ออกจากระบบ {home} → อยู่หน้าเดิม', page.url.endswith(home) and 'ออกจากระบบ' in t, f'{page.url[len(BASE):]} toast="{t}"')

        await b.close()
        print('page errors:', errors[:10])
        print(f"{sum(1 for r in results if r[1])}/{len(results)} passed")


asyncio.run(main())
