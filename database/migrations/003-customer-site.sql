-- หน้าเว็บลูกค้า: ประวัติการล็อกอินของลูกค้า (สำหรับฐานข้อมูลที่สร้างก่อนวันที่ 2026-09-27)
-- ถ้าเพิ่ง Import schema.sql ใหม่ ไม่ต้องรันไฟล์นี้ — รันซ้ำได้ ไม่ error
USE travel_booking;

CREATE TABLE IF NOT EXISTS customer_login_attempts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(150) NOT NULL,
  ip         VARCHAR(64) NOT NULL,
  success    TINYINT(1) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (email, created_at),
  INDEX (ip, created_at)
);
