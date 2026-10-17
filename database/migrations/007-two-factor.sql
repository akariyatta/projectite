-- ยืนยันตัวตน 2 ขั้น (แอป Authenticator) สำหรับแอดมินและลูกค้า (สำหรับฐานข้อมูลที่สร้างก่อนวันที่ 2026-10-17)
-- รันซ้ำได้ ไม่ลบข้อมูล — ทุกบัญชีเริ่มต้นแบบยังไม่เปิด 2FA
USE travel_booking;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret    VARCHAR(255) AFTER session_version,
  ADD COLUMN IF NOT EXISTS totp_enabled   TINYINT(1) NOT NULL DEFAULT 0 AFTER totp_secret,
  ADD COLUMN IF NOT EXISTS totp_last_step BIGINT AFTER totp_enabled,
  ADD COLUMN IF NOT EXISTS backup_codes   TEXT AFTER totp_last_step;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS totp_secret    VARCHAR(255) AFTER password_changed_at,
  ADD COLUMN IF NOT EXISTS totp_enabled   TINYINT(1) NOT NULL DEFAULT 0 AFTER totp_secret,
  ADD COLUMN IF NOT EXISTS totp_last_step BIGINT AFTER totp_enabled,
  ADD COLUMN IF NOT EXISTS backup_codes   TEXT AFTER totp_last_step;
