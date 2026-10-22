# เว็บทดลองหลังบ้าน MRTA (static)

หน้าหลังบ้านของ 7 ระบบ (auth, belib, booking, knowledge, learnext, news, portal) ในสิทธิ์ admin
เก็บเป็นไฟล์ static สำหรับ deploy ขึ้น Vercel ให้ลูกค้าลองใช้

- ข้อมูลส่วนบุคคล (ชื่อ อีเมล เบอร์ เลขบัตร ที่อยู่ IP) เป็นข้อมูลสมมติทั้งหมด
- กดบันทึก แก้ไข หรือลบได้ ระบบจะตอบว่าสำเร็จแล้วพากลับหน้ารายการ แต่ไม่มีอะไรถูกบันทึกจริง
- ตาราง (DataTables) ค้นหา เรียง และแบ่งหน้าได้จากข้อมูลตัวอย่าง (ตารางละไม่เกิน 300 แถว)
- หน้าแรก `/` เข้าหลังบ้าน portal (`/portal/admin`) ทันที
- มีเฉพาะหลังบ้าน ไม่มีหน้าบ้าน (login / สมัครสมาชิก / หน้าเว็บ) ลิงก์ไปหน้าบ้านขึ้นข้อความแจ้งแทน
- ปุ่มออกจากระบบขึ้นข้อความแจ้ง แล้วอยู่หน้าเดิม

## Deploy

```
cd "C:\XAMPP 8.5\mrta-back-office"
npx vercel          # ครั้งแรก: ล็อกอิน + สร้างโปรเจกต์ (Framework: Other, ไม่ต้องมี build command)
npx vercel --prod
```

โฟลเดอร์ `_build` ไม่ถูกอัปโหลด (`.vercelignore`)

## สร้างใหม่ (หลังแก้หน้าหลังบ้านในระบบจริง)

```
cd "C:\XAMPP 8.5\mrta-back-office\_build"
python make.py                       # capture ทั้ง 7 ระบบ → ข้อมูลสมมติ → build
python serve.py                      # เปิดดูในเครื่อง http://localhost:8787 (ทำงานแบบเดียวกับ Vercel)
python check_site.py http://localhost:8787 %TEMP%\check.json   # เปิดทุกหน้า หา error + เขียน seeds.json
python make.py --seeds %TEMP%\seeds.json                        # เก็บ AJAX ที่ยังขาดเพิ่ม
python flow_test.py http://localhost:8787 %TEMP%\flow           # ทดสอบ flow หลัก
```

- `capture.php`: ล็อกอินเป็นผู้ใช้ id 120 (Admin Belib + Admin Learnext, ไม่ใช่ superadmin) ในโปรเซส
  ทุก request อยู่ในทรานแซกชันแล้ว rollback ไม่เขียนฐานข้อมูลจริง ไม่ส่งอีเมล
- ผลดิบจาก capture มีข้อมูลจริง เก็บไว้ที่ `%TEMP%\mrta-back-office-raw` เท่านั้น ห้ามย้ายมาไว้ในโฟลเดอร์นี้
- `pii_dict.php`: ทำตารางแทนข้อมูลจริง → ข้อมูลสมมติ (`build.py` รายงาน `LEFTOVER` ถ้ายังมีค่าจริงหลงเหลือ)
- `build.py`: แปลง URL, ก๊อปไฟล์ static, รวมไฟล์ที่ซ้ำข้ามระบบไว้ที่ `_shared`, ใส่ `_demo/demo.js`
- `_demo/demo.js`: จำลองฝั่งเซิร์ฟเวอร์ในเบราว์เซอร์ (AJAX, ตาราง, บันทึก, ลิงก์ที่ไม่มีในเวอร์ชันทดลอง)
