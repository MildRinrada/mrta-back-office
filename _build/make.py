# -*- coding: utf-8 -*-
"""
สร้างเว็บทดลองหลังบ้านใหม่ทั้งหมด: capture ทั้ง 7 ระบบ → ตารางข้อมูลสมมติ → build

    python make.py [--uid 120] [--raw <โฟลเดอร์ผลดิบ>] [--seeds <seeds.json>]

--uid   ผู้ใช้ที่ใช้ล็อกอินเก็บหน้า (ค่าเริ่มต้น 120 = Admin Belib + Admin Learnext, ไม่ใช่ superadmin)
--raw   ที่เก็บผลดิบ (มีข้อมูลจริง ต้องอยู่นอกโฟลเดอร์ที่ deploy) ค่าเริ่มต้น %TEMP%/mrta-back-office-raw
--seeds คำขอ AJAX ที่ยังไม่มีข้อมูล จาก check_site.py (เก็บเพิ่มพร้อมพารามิเตอร์จริง)
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent
SRC = Path(r'C:\XAMPP 8.5')
PHP = Path(os.environ.get('USERPROFILE', '')) / '.config/herd/bin/php85/php.exe'
APPS = {'auth': 'mrta-auth', 'belib': 'mrta-belib', 'booking': 'mrta-booking-2', 'knowledge': 'mrta-knowledge',
        'learnext': 'mrta-learnext', 'news': 'mrta-news', 'portal': 'mrta-portal'}
GUEST = {'auth': '/login'}  # หน้าที่เปิดแบบยังไม่ล็อกอิน (หน้าแรกของเว็บทดลอง)

ap = argparse.ArgumentParser()
ap.add_argument('--uid', default='120')
ap.add_argument('--raw', default=str(Path(tempfile.gettempdir()) / 'mrta-back-office-raw'))
ap.add_argument('--seeds', default='')
a = ap.parse_args()
raw = Path(a.raw)
if raw.resolve().is_relative_to(SITE.resolve()):
    sys.exit('ผลดิบมีข้อมูลจริง ห้ามเก็บในโฟลเดอร์ที่ deploy')
raw.mkdir(parents=True, exist_ok=True)

for sys_, app in APPS.items():
    shutil.rmtree(raw / sys_, ignore_errors=True)
    cmd = [str(PHP), str(HERE / 'capture.php'), str(SRC / app), sys_, a.uid, str(raw), GUEST.get(sys_, '')]
    if a.seeds:
        cmd.append(a.seeds)
    with open(raw / f'{sys_}.log', 'w', encoding='utf-8') as log:
        out = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=log, text=True, encoding='utf-8')
    print(out.stdout.strip())

subprocess.run([str(PHP), str(HERE / 'pii_dict.php'), str(SRC / APPS['portal']), str(raw / 'pii.json')], check=True)
subprocess.run([sys.executable, str(HERE / 'build.py'), str(raw), str(raw / 'pii.json'), str(SITE)], check=True,
               env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
