-- ============================================================
-- Hotel Travel — โครงสร้างฐานข้อมูล (MySQL / MariaDB)
-- วิธีใช้: phpMyAdmin > Import > เลือกไฟล์นี้ (จะสร้าง DB travel_booking ให้เอง)
-- แล้ว Import seed.sql ต่อ ถ้าต้องการข้อมูลตัวอย่าง
-- ============================================================

CREATE DATABASE IF NOT EXISTS travel_booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE travel_booking;

-- ลูกค้า (สมัคร / ล็อกอินจากหน้าเว็บ)
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,           -- bcrypt (ใช้ bcryptjs)
  phone         VARCHAR(30),
  status        ENUM('active','banned') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ผู้ดูแลระบบ (ล็อกอินหลังบ้านเท่านั้น — แยกจากลูกค้าโดยสิ้นเชิง)
CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,           -- bcrypt
  status        ENUM('active','banned') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- โรงแรม
CREATE TABLE IF NOT EXISTS hotels (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  country     VARCHAR(100) NOT NULL,
  address     VARCHAR(255),
  description TEXT,
  star_rating TINYINT NOT NULL DEFAULT 3,
  image_url   VARCHAR(500),
  is_active   TINYINT(1) NOT NULL DEFAULT 1,       -- 0 = ซ่อนจากหน้าเว็บ
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ห้องพักของแต่ละโรงแรม
CREATE TABLE IF NOT EXISTS rooms (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id        INT NOT NULL,
  name            VARCHAR(100) NOT NULL,           -- เช่น Deluxe Double
  capacity        TINYINT NOT NULL DEFAULT 2,      -- จำนวนผู้เข้าพักสูงสุด
  price_per_night DECIMAL(10,2) NOT NULL,
  total_rooms     INT NOT NULL DEFAULT 1,          -- จำนวนห้องประเภทนี้ทั้งหมด
  image_url       VARCHAR(500),
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- เที่ยวบิน
CREATE TABLE IF NOT EXISTS flights (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  airline         VARCHAR(100) NOT NULL,
  flight_no       VARCHAR(20)  NOT NULL,
  origin          VARCHAR(10)  NOT NULL,           -- รหัสสนามบิน เช่น BKK
  destination     VARCHAR(10)  NOT NULL,           -- เช่น NRT
  depart_at       DATETIME NOT NULL,
  arrive_at       DATETIME NOT NULL,
  seat_class      ENUM('economy','business','first') NOT NULL DEFAULT 'economy',
  price           DECIMAL(10,2) NOT NULL,
  seats_total     INT NOT NULL,
  seats_available INT NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1
);

-- งาน / สวนสนุก / คอนเสิร์ต
CREATE TABLE IF NOT EXISTS events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  category    ENUM('theme_park','concert','exhibition','sport','other') NOT NULL DEFAULT 'theme_park',
  city        VARCHAR(100) NOT NULL,
  country     VARCHAR(100) NOT NULL,
  venue       VARCHAR(150),
  description TEXT,
  image_url   VARCHAR(500),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1
);

-- ประเภทตั๋วของแต่ละงาน (ผู้ใหญ่ / เด็ก / VIP ...)
CREATE TABLE IF NOT EXISTS event_tickets (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  event_id       INT NOT NULL,
  name           VARCHAR(100) NOT NULL,
  price          DECIMAL(10,2) NOT NULL,
  quantity_total INT NOT NULL,
  quantity_sold  INT NOT NULL DEFAULT 0,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- การจอง 1 ครั้ง (1 booking มีได้หลายรายการ)
CREATE TABLE IF NOT EXISTS bookings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  booking_code VARCHAR(20) NOT NULL UNIQUE,        -- เช่น BK20260925001
  user_id      INT NOT NULL,
  status       ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- รายการในการจอง: ห้องพัก / เที่ยวบิน / ตั๋วงาน
CREATE TABLE IF NOT EXISTS booking_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT NOT NULL,
  item_type   ENUM('room','flight','ticket') NOT NULL,
  item_id     INT NOT NULL,                         -- rooms.id / flights.id / event_tickets.id
  description VARCHAR(255) NOT NULL,                -- ชื่อที่แสดง เก็บไว้เผื่อสินค้าถูกลบ
  start_date  DATE,                                 -- เช็คอิน / วันเดินทาง / วันเข้างาน
  end_date    DATE,                                 -- เช็คเอาท์ (เฉพาะห้องพัก)
  quantity    INT NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL,
  subtotal    DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- การชำระเงิน
CREATE TABLE IF NOT EXISTS payments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  method     ENUM('credit_card','promptpay','bank_transfer','paypal') NOT NULL,
  amount     DECIMAL(12,2) NOT NULL,
  status     ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  paid_at    DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- แผนเที่ยว — ลูกค้าวางเอง (source = customer) หรือ AI เสนอให้เลือก (source = ai)
CREATE TABLE IF NOT EXISTS trip_plans (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  title       VARCHAR(150) NOT NULL,
  destination VARCHAR(150) NOT NULL,                -- ชื่อเมือง ตรงกับ hotels.city / events.city
  start_date  DATE,
  end_date    DATE,
  travelers   TINYINT NOT NULL DEFAULT 1,
  budget      DECIMAL(12,2),
  source      ENUM('customer','ai') NOT NULL DEFAULT 'customer',
  style       ENUM('budget','balanced','premium'),  -- แผนแบบไหนที่ AI เสนอ (ถ้ามาจาก AI)
  prompt      TEXT,                                 -- สิ่งที่ลูกค้าพิมพ์ขอ
  plan        LONGTEXT,                             -- JSON: { summary, estimated_cost, days: [{ day, date, title, items: [...] }] }
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- โครง plan.days[].items[]:
--   { time: "08:00", type: "flight|hotel|event|activity|food|transport",
--     ref_id: flights.id | rooms.id | event_tickets.id | null, title, note, cost }
