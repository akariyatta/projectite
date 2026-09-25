-- อัปเดตตาราง trip_plans สำหรับฐานข้อมูลที่สร้างไว้ก่อนวันที่ 2026-09-26
-- (ถ้าเพิ่ง Import schema.sql ใหม่ ไม่ต้องรันไฟล์นี้) — รันซ้ำได้ ไม่ error
USE travel_booking;

ALTER TABLE trip_plans
  ADD COLUMN IF NOT EXISTS travelers  TINYINT NOT NULL DEFAULT 1 AFTER end_date,
  ADD COLUMN IF NOT EXISTS source     ENUM('customer','ai') NOT NULL DEFAULT 'customer' AFTER budget,
  ADD COLUMN IF NOT EXISTS style      ENUM('budget','balanced','premium') AFTER source,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
