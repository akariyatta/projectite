# ระบบหลังบ้าน (Admin) + ฐานข้อมูล

## ติดตั้งครั้งแรก

1. เปิด **XAMPP** แล้วกด Start ที่ **MySQL** (และ Apache ถ้าจะใช้ phpMyAdmin)
2. เปิด `http://localhost/phpmyadmin` → **Import** → เลือก `database/schema.sql` → Go
3. **Import** อีกครั้ง → `database/seed.sql` (ข้อมูลตัวอย่าง + บัญชีแอดมิน)
4. คัดลอก `.env.example` เป็น `.env.local` แล้วตั้ง `SESSION_SECRET` เป็นข้อความสุ่มยาวๆ
5. `npm install` แล้ว `npm run dev`
6. เข้า `http://localhost:3000/login`

## บัญชีแอดมิน

| ชื่อ | อีเมล |
|---|---|
| Achi | achi@hoteltravel.local |
| Boom | boom@hoteltravel.local |
| Rey  | rey@hoteltravel.local  |

รหัสผ่านแจ้งกันทางแชตส่วนตัว (ห้ามเขียนลงใน repo)
เปลี่ยนรหัส: คลิกชื่อตัวเองที่มุมล่างซ้าย → ใส่รหัสใหม่ → บันทึก

บัญชีลูกค้าตัวอย่าง (สำหรับทดสอบหน้าบ้าน): somchai@example.com / customer1234

## โครงสร้าง

```
database/schema.sql     ตารางทั้งหมด (ส่งให้ทีมหน้าบ้านใช้ชุดเดียวกัน)
database/seed.sql       ข้อมูลตัวอย่าง
lib/db.js               query(sql, params) — ใช้ต่อในหน้าบ้านได้เลย
lib/auth.js             session ของแอดมิน
lib/actions.js          Server Actions ของหลังบ้าน
lib/resources.js        ตั้งค่าหน้าเพิ่ม/แก้/ลบ + กฎตรวจข้อมูล (เพิ่มคอลัมน์ใหม่ได้ที่นี่)
components/admin/AdminForm.js   ฟอร์มที่ตรวจข้อมูลเป็นภาษาไทยก่อนบันทึก
components/admin/Toast.js       แจ้งเตือน "สำเร็จ" / error (ส่งผ่าน ?ok= / ?error= ใน URL)
app/login               หน้าเข้าสู่ระบบ
app/admin               หน้าหลังบ้านทั้งหมด
components/admin        สไตล์และคอมโพเนนต์ของหลังบ้าน (class ขึ้นต้น adm- ไม่ชนกับหน้าบ้าน)
```

## สำหรับทีมหน้าบ้าน

- ดึงข้อมูลด้วย `import { query } from "@/lib/db"` ใน Server Component เช่น
  `await query("SELECT * FROM hotels WHERE is_active = 1")`
- แสดงเฉพาะรายการที่ `is_active = 1` (แอดมินใช้ปิดการขาย)
- การจอง: สร้าง 1 แถวใน `bookings` + หลายแถวใน `booking_items` (`item_type` = room / flight / ticket) + 1 แถวใน `payments`
- ตาราง `users` = ลูกค้าเท่านั้น ส่วนแอดมินอยู่ตาราง `admins` แยกกัน — ระบบล็อกอินหน้าบ้านให้ใช้ `users` อย่างเดียว
- รหัสผ่านลูกค้าเก็บเป็น bcrypt ใน `users.password_hash` (ใช้แพ็กเกจ `bcryptjs`)
- แผนเที่ยว AI บันทึกลง `trip_plans` (`prompt` = คำขอ, `plan` = ผลลัพธ์จาก AI)
