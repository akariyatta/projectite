-- ชำระเงินจริง (Stripe) + หมดเวลาจ่ายเงิน + อีเมล + ลืมรหัสผ่าน (สำหรับฐานข้อมูลที่สร้างก่อนวันที่ 2026-10-03)
-- ถ้าเพิ่ง Import schema.sql ใหม่ ไม่ต้องรันไฟล์นี้ — รันซ้ำได้ ไม่ error
USE travel_booking;

-- การจองที่ยังไม่จ่ายเงิน จะถูกยกเลิกอัตโนมัติเมื่อเลยเวลานี้
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at DATETIME AFTER note;

-- ผู้ให้บริการชำระเงิน: simulated (โหมดทดสอบ) หรือ stripe
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider     VARCHAR(20) NOT NULL DEFAULT 'simulated' AFTER method,
  ADD COLUMN IF NOT EXISTS provider_ref VARCHAR(255) AFTER provider;

-- เปลี่ยน/รีเซ็ตรหัสผ่านแล้ว เครื่องอื่นที่ล็อกอินค้างไว้จะหลุด
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 1 AFTER status;

CREATE TABLE IF NOT EXISTS password_resets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,   -- sha256 ของ token (ไม่เก็บ token จริง)
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- อีเมลทุกฉบับที่ระบบส่ง (ถ้ายังไม่ตั้ง SMTP จะเก็บไว้ที่นี่ให้เปิดดูในหลังบ้าน)
CREATE TABLE IF NOT EXISTS email_outbox (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  to_email   VARCHAR(150) NOT NULL,
  subject    VARCHAR(255) NOT NULL,
  body_html  MEDIUMTEXT NOT NULL,
  status     ENUM('sent','logged','failed') NOT NULL,  -- logged = ยังไม่ได้ตั้ง SMTP
  error      VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (created_at)
);
