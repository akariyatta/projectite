-- ข้อมูลตัวอย่าง (Import หลัง schema.sql)
--
-- ⚠ Import ซ้ำได้ — แต่จะ "ล้างข้อมูลทุกตาราง" แล้วใส่ข้อมูลตัวอย่างใหม่
--   (ข้อมูลที่เพิ่ม/แก้ในหลังบ้าน และรหัสผ่านที่เปลี่ยนไว้ จะกลับเป็นค่าเริ่มต้น)
--
-- บัญชีแอดมิน: Achi, Boom, Rey (รหัสผ่านแจ้งกันทางแชตส่วนตัว — เปลี่ยนได้ที่หลังบ้าน > ผู้ดูแลระบบ)
-- บัญชีลูกค้าตัวอย่าง: somchai@example.com, suda@example.com / customer1234
USE travel_booking;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE payments;
TRUNCATE TABLE booking_items;
TRUNCATE TABLE bookings;
TRUNCATE TABLE trip_plans;
TRUNCATE TABLE event_tickets;
TRUNCATE TABLE events;
TRUNCATE TABLE flights;
TRUNCATE TABLE rooms;
TRUNCATE TABLE hotels;
TRUNCATE TABLE users;
TRUNCATE TABLE admins;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO admins (name, email, password_hash) VALUES
('Achi', 'achi@hoteltravel.local', '$2b$10$6cKIyDBmvyw02KFKN45o0OeYNoiUbOuAq6LNH/tuRoy9RKaSTQZAC'),
('Boom', 'boom@hoteltravel.local', '$2b$10$iGl0OBvnga/8i7UuQvOE5uoct4QSoyyvmybU7dAT2zdqAqhzFhUOG'),
('Rey',  'rey@hoteltravel.local',  '$2b$10$pXjR/LDUjjnxOMNObvFeMemBLhwaI0Q72wzT/S8QHWeUy3IGKuGcK');

INSERT INTO users (name, email, password_hash, phone) VALUES
('สมชาย ใจดี', 'somchai@example.com', '$2b$10$6CdzKJ4xlfUrb18aSrn1ze8SrxAPrwEeYkDQ3y0/MRjLmpwYJqe.a', '0812345678'),
('Suda Kaewmanee', 'suda@example.com', '$2b$10$6CdzKJ4xlfUrb18aSrn1ze8SrxAPrwEeYkDQ3y0/MRjLmpwYJqe.a', '0898765432');

INSERT INTO hotels (name, city, country, address, description, star_rating) VALUES
('Hilton Tokyo Bay', 'Tokyo', 'Japan', '1-8 Maihama, Urayasu', 'ใกล้ Tokyo Disneyland มีรถรับส่งฟรี', 4),
('Centara Grand', 'Bangkok', 'Thailand', 'Ratchadamri Rd', 'ใจกลางเมือง ใกล้ห้างสรรพสินค้า', 5),
('Hotel Universal Port', 'Osaka', 'Japan', '1-1-111 Sakurajima', 'เดินไป Universal Studios Japan ได้', 4);

INSERT INTO rooms (hotel_id, name, capacity, price_per_night, total_rooms) VALUES
(1, 'Deluxe Double', 2, 6500.00, 20),
(1, 'Family Room', 4, 9800.00, 10),
(2, 'Superior King', 2, 4200.00, 30),
(2, 'Club Suite', 3, 12500.00, 8),
(3, 'Standard Twin', 2, 5200.00, 25);

INSERT INTO flights (airline, flight_no, origin, destination, depart_at, arrive_at, seat_class, price, seats_total, seats_available) VALUES
('Thai Airways', 'TG640', 'BKK', 'NRT', '2026-10-10 08:00:00', '2026-10-10 16:10:00', 'economy', 18500.00, 180, 176),
('Thai Airways', 'TG640', 'BKK', 'NRT', '2026-10-10 08:00:00', '2026-10-10 16:10:00', 'business', 52000.00, 30, 30),
('AirAsia X', 'XJ600', 'DMK', 'NRT', '2026-10-10 23:45:00', '2026-10-11 07:50:00', 'economy', 8900.00, 377, 377),
('Thai Airways', 'TG622', 'BKK', 'KIX', '2026-11-02 23:30:00', '2026-11-03 07:00:00', 'economy', 16900.00, 250, 248);

INSERT INTO events (name, category, city, country, venue, description, start_date, end_date) VALUES
('Tokyo Disneyland', 'theme_park', 'Tokyo', 'Japan', 'Urayasu, Chiba', 'บัตรเข้าสวนสนุก 1 วัน', '2026-01-01', '2026-12-31'),
('Universal Studios Japan', 'theme_park', 'Osaka', 'Japan', 'Konohana-ku', 'บัตรเข้าสวนสนุก 1 วัน', '2026-01-01', '2026-12-31'),
('Songkran Music Festival', 'concert', 'Bangkok', 'Thailand', 'Rajamangala Stadium', 'เทศกาลดนตรีสงกรานต์', '2027-04-12', '2027-04-14');

INSERT INTO event_tickets (event_id, name, price, quantity_total, quantity_sold) VALUES
(1, 'ผู้ใหญ่ (18+)', 2300.00, 1000, 3),
(1, 'เด็ก (4-11)', 1400.00, 1000, 1),
(2, '1-Day Studio Pass', 2200.00, 1000, 2),
(3, 'General Admission', 3500.00, 5000, 0),
(3, 'VIP', 8900.00, 300, 0);

INSERT INTO bookings (booking_code, user_id, status, total_amount, created_at) VALUES
('BK20260920001', 1, 'confirmed', 33800.00, '2026-09-20 10:12:00'),
('BK20260923002', 2, 'pending', 25000.00, '2026-09-23 14:40:00'),
('BK20260924003', 1, 'cancelled', 4200.00, '2026-09-24 09:05:00');

INSERT INTO booking_items (booking_id, item_type, item_id, description, start_date, end_date, quantity, unit_price, subtotal) VALUES
(1, 'flight', 1, 'TG640 BKK → NRT (economy)', '2026-10-10', NULL, 1, 18500.00, 18500.00),
(1, 'room', 1, 'Hilton Tokyo Bay — Deluxe Double', '2026-10-10', '2026-10-12', 1, 6500.00, 13000.00),
(1, 'ticket', 1, 'Tokyo Disneyland — ผู้ใหญ่ (18+)', '2026-10-11', NULL, 1, 2300.00, 2300.00),
(2, 'flight', 4, 'TG622 BKK → KIX (economy)', '2026-11-02', NULL, 1, 16900.00, 16900.00),
(2, 'room', 5, 'Hotel Universal Port — Standard Twin', '2026-11-03', '2026-11-04', 1, 5200.00, 5200.00),
(2, 'ticket', 3, 'Universal Studios Japan — 1-Day Studio Pass', '2026-11-03', NULL, 2, 2200.00, 4400.00),
(3, 'room', 3, 'Centara Grand — Superior King', '2026-10-01', '2026-10-02', 1, 4200.00, 4200.00);

INSERT INTO payments (booking_id, method, amount, status, paid_at) VALUES
(1, 'promptpay', 33800.00, 'paid', '2026-09-20 10:15:00'),
(2, 'credit_card', 25000.00, 'pending', NULL),
(3, 'bank_transfer', 4200.00, 'refunded', '2026-09-24 09:10:00');

-- การจองย้อนหลังตลอดปี (ให้หน้ารายงานยอดขายมีข้อมูลให้ดู) — booking id 4–12
INSERT INTO bookings (booking_code, user_id, status, total_amount, created_at) VALUES
('BK20260115004', 2, 'completed', 8400.00,  '2026-01-15 11:20:00'),
('BK20260210005', 1, 'completed', 13500.00, '2026-02-10 19:05:00'),
('BK20260305006', 2, 'completed', 12500.00, '2026-03-05 08:45:00'),
('BK20260418007', 1, 'completed', 40900.00, '2026-04-18 21:30:00'),
('BK20260512008', 2, 'cancelled', 5200.00,  '2026-05-12 13:10:00'),
('BK20260620009', 1, 'completed', 6600.00,  '2026-06-20 10:00:00'),
('BK20260708010', 2, 'completed', 27300.00, '2026-07-08 16:25:00'),
('BK20260822011', 1, 'confirmed', 24100.00, '2026-08-22 09:40:00'),
('BK20251205012', 1, 'completed', 8400.00,  '2025-12-05 15:00:00');

INSERT INTO booking_items (booking_id, item_type, item_id, description, start_date, end_date, quantity, unit_price, subtotal) VALUES
(4,  'room',   3, 'Centara Grand — Superior King', '2026-02-01', '2026-02-03', 1, 4200.00, 8400.00),
(5,  'flight', 3, 'XJ600 DMK → NRT (economy)', '2026-03-01', NULL, 1, 8900.00, 8900.00),
(5,  'ticket', 1, 'Tokyo Disneyland — ผู้ใหญ่ (18+)', '2026-03-02', NULL, 2, 2300.00, 4600.00),
(6,  'room',   4, 'Centara Grand — Club Suite', '2026-03-20', '2026-03-21', 1, 12500.00, 12500.00),
(7,  'flight', 1, 'TG640 BKK → NRT (economy)', '2026-05-01', NULL, 1, 18500.00, 18500.00),
(7,  'room',   2, 'Hilton Tokyo Bay — Family Room', '2026-05-01', '2026-05-03', 1, 9800.00, 19600.00),
(7,  'ticket', 2, 'Tokyo Disneyland — เด็ก (4-11)', '2026-05-02', NULL, 2, 1400.00, 2800.00),
(8,  'room',   5, 'Hotel Universal Port — Standard Twin', '2026-06-01', '2026-06-02', 1, 5200.00, 5200.00),
(9,  'ticket', 3, 'Universal Studios Japan — 1-Day Studio Pass', '2026-07-01', NULL, 3, 2200.00, 6600.00),
(10, 'flight', 4, 'TG622 BKK → KIX (economy)', '2026-08-01', NULL, 1, 16900.00, 16900.00),
(10, 'room',   5, 'Hotel Universal Port — Standard Twin', '2026-08-02', '2026-08-04', 1, 5200.00, 10400.00),
(11, 'room',   1, 'Hilton Tokyo Bay — Deluxe Double', '2026-10-20', '2026-10-23', 1, 6500.00, 19500.00),
(11, 'ticket', 1, 'Tokyo Disneyland — ผู้ใหญ่ (18+)', '2026-10-21', NULL, 2, 2300.00, 4600.00),
(12, 'room',   3, 'Centara Grand — Superior King', '2025-12-24', '2025-12-26', 1, 4200.00, 8400.00);

INSERT INTO payments (booking_id, method, amount, status, paid_at) VALUES
(4,  'promptpay',     8400.00,  'paid',     '2026-01-15 11:25:00'),
(5,  'credit_card',   13500.00, 'paid',     '2026-02-10 19:08:00'),
(6,  'bank_transfer', 12500.00, 'paid',     '2026-03-05 09:30:00'),
(7,  'credit_card',   40900.00, 'paid',     '2026-04-18 21:33:00'),
(8,  'promptpay',     5200.00,  'refunded', '2026-05-12 13:15:00'),
(9,  'paypal',        6600.00,  'paid',     '2026-06-20 10:02:00'),
(10, 'credit_card',   27300.00, 'paid',     '2026-07-08 16:30:00'),
(11, 'promptpay',     24100.00, 'paid',     '2026-08-22 09:45:00'),
(12, 'bank_transfer', 8400.00,  'paid',     '2025-12-05 15:20:00');

INSERT INTO trip_plans (user_id, title, destination, start_date, end_date, budget, prompt, plan) VALUES
(1, 'โตเกียว 3 วัน 2 คืน', 'Tokyo', '2026-10-10', '2026-10-12', 50000.00,
 'อยากไป Disneyland และกินอาหารญี่ปุ่นอร่อยๆ',
 '{"days":[{"day":1,"items":["ถึง NRT","เช็คอิน Hilton Tokyo Bay"]},{"day":2,"items":["Tokyo Disneyland ทั้งวัน"]},{"day":3,"items":["ตลาดปลาสึกิจิ","บินกลับ"]}]}');
