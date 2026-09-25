-- ความปลอดภัยการล็อกอิน + บันทึกการแก้ไข (สำหรับฐานข้อมูลที่สร้างก่อนวันที่ 2026-09-26)
-- ถ้าเพิ่ง Import schema.sql ใหม่ ไม่ต้องรันไฟล์นี้ — รันซ้ำได้ ไม่ error
USE travel_booking;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 1 AFTER status,
  ADD COLUMN IF NOT EXISTS session_version      INT NOT NULL DEFAULT 1 AFTER must_change_password,
  ADD COLUMN IF NOT EXISTS password_changed_at  DATETIME AFTER session_version;

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(150) NOT NULL,
  ip         VARCHAR(64) NOT NULL,
  success    TINYINT(1) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (email, created_at),
  INDEX (ip, created_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  admin_id   INT,
  admin_name VARCHAR(100) NOT NULL,
  action     VARCHAR(30) NOT NULL,
  entity     VARCHAR(50) NOT NULL,
  entity_id  INT,
  summary    VARCHAR(255) NOT NULL,
  changes    LONGTEXT,
  ip         VARCHAR(64),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (entity, entity_id),
  INDEX (created_at)
);
