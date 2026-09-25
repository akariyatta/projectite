"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Plane,
  BedDouble,
  ChevronDown,
  Minus,
  Plus,
  ArrowLeftRight,
} from "lucide-react";

/**
 * Hotel Travel — booking search page (hotel + flight)
 * Plain CSS via styled-jsx (built into Next.js — no Tailwind needed).
 */

const NAV_TABS = [
  { key: "hotel", label: "ที่พัก", icon: BedDouble },
  { key: "flight", label: "เที่ยวบิน", icon: Plane },
  { key: "combo", label: "ตั๋วเครื่องบิน + ที่พัก", icon: Search },
];

function formatThaiDate(date) {
  const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return {
    top: `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`,
    bottom: days[date.getDay()],
  };
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function GuestPicker({ rooms, setRooms }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const totalAdults = rooms.reduce((s, r) => s + r.adults, 0);

  function updateRoom(i, field, delta) {
    setRooms((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? { ...r, [field]: Math.max(field === "adults" ? 1 : 0, r[field] + delta) }
          : r
      )
    );
  }

  return (
    <div className="guestPicker" ref={ref}>
      <button type="button" className="fieldBtn" onClick={() => setOpen((o) => !o)}>
        <Users size={18} className="goldIcon" />
        <span className="fieldBtnText">
          <span className="fieldBtnMain">ผู้ใหญ่ {totalAdults} คน</span>
          <span className="fieldBtnSub">{rooms.length} ห้อง</span>
        </span>
        <ChevronDown size={16} className={`chevron ${open ? "chevronOpen" : ""}`} />
      </button>

      {open && (
        <div className="guestDropdown">
          {rooms.map((room, i) => (
            <div key={i} className={i > 0 ? "roomBlock roomBlockDivider" : "roomBlock"}>
              <p className="roomTitle">ห้อง {i + 1}</p>
              <div className="counterRow">
                <span className="counterLabel">ผู้ใหญ่</span>
                <div className="counterControls">
                  <button
                    type="button"
                    className="counterBtn"
                    onClick={() => updateRoom(i, "adults", -1)}
                    disabled={room.adults <= 1}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="counterValue">{room.adults}</span>
                  <button
                    type="button"
                    className="counterBtn"
                    onClick={() => updateRoom(i, "adults", 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="counterRow">
                <span className="counterLabel">เด็ก</span>
                <div className="counterControls">
                  <button
                    type="button"
                    className="counterBtn"
                    onClick={() => updateRoom(i, "children", -1)}
                    disabled={room.children <= 0}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="counterValue">{room.children}</span>
                  <button
                    type="button"
                    className="counterBtn"
                    onClick={() => updateRoom(i, "children", 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="guestDropdownFooter">
            <button
              type="button"
              className="addRoomBtn"
              onClick={() => setRooms((r) => [...r, { adults: 1, children: 0 }])}
            >
              + เพิ่มห้อง
            </button>
            <button type="button" className="doneBtn" onClick={() => setOpen(false)}>
              เสร็จสิ้น
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DateField({ label, date }) {
  const { top, bottom } = formatThaiDate(date);
  return (
    <div className="dateField">
      <Calendar size={18} className="goldIcon" />
      <div>
        <span className="dateLabel">{label}</span>
        <span className="dateTop">{top}</span>
        <span className="dateBottom">{bottom}</span>
      </div>
    </div>
  );
}

export default function HotelPlaneBooking() {
  const [tab, setTab] = useState("hotel");
  const [destination, setDestination] = useState("");
  const [origin, setOrigin] = useState("");
  const [flightTo, setFlightTo] = useState("");
  const [checkIn] = useState(new Date(2026, 9, 4));
  const [checkOut] = useState(addDays(new Date(2026, 9, 4), 1));
  const [rooms, setRooms] = useState([{ adults: 2, children: 0 }]);

  const destinations = ["กรุงเทพ", "เชียงใหม่", "ภูเก็ต", "พัทยา", "หัวหิน / ชะอำ"];

  return (
    <div className="page">
      <header className="header">
        <div className="headerInner">
          <div className="brand">
            <span className="brandStar">✦</span>
            <span className="brandName">Hotel Travel</span>
          </div>
          <nav className="nav">
            <a href="#">คู่มือท่องเที่ยว</a>
            <a href="#">รีวิวทริปเที่ยว</a>
            <a href="#">สิทธิพิเศษสมาชิก</a>
          </nav>
          <button className="loginBtn">เข้าสู่ระบบ</button>
        </div>
      </header>

      <section className="hero">
        <div className="heroInner">
          <p className="heroStars">✦ ✦ ✦</p>
          <h1 className="heroTitle">ท่องโลกทั้งใบ ในแบบที่ใช่สำหรับคุณ</h1>
          <p className="heroSubtitle">
            ค้นหาที่พักและเที่ยวบิน จัดการการจองทั้งหมดได้ในที่เดียว
          </p>
        </div>
      </section>

      <section className="searchSection">
        <div className="searchCard">
          <div className="tabs">
            {NAV_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={tab === key ? "tabBtn tabBtnActive" : "tabBtn"}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div className="tabPanel">
            {tab === "hotel" && (
              <div className="formStack">
                <div className="searchInput">
                  <Search size={18} className="goldIcon" />
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="ใส่จุดหมายปลายทางหรือชื่อที่พัก"
                    list="destination-list"
                  />
                  <datalist id="destination-list">
                    {destinations.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div className="row">
                  <div className="dateRow">
                    <DateField label="เช็คอิน" date={checkIn} />
                    <DateField label="เช็คเอาท์" date={checkOut} />
                  </div>
                  <GuestPicker rooms={rooms} setRooms={setRooms} />
                </div>

                <button className="searchBtn">
                  <Search size={18} />
                  ค้นหาที่พัก
                </button>
              </div>
            )}

            {tab === "flight" && (
              <div className="formStack">
                <div className="row rowAlignCenter">
                  <div className="searchInput flexOne">
                    <Plane size={18} className="goldIcon" />
                    <input
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="ต้นทาง"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="สลับต้นทางและปลายทาง"
                    className="swapBtn"
                    onClick={() => {
                      setOrigin(flightTo);
                      setFlightTo(origin);
                    }}
                  >
                    <ArrowLeftRight size={16} />
                  </button>
                  <div className="searchInput flexOne">
                    <MapPin size={18} className="goldIcon" />
                    <input
                      value={flightTo}
                      onChange={(e) => setFlightTo(e.target.value)}
                      placeholder="ปลายทาง"
                    />
                  </div>
                </div>

                <div className="row">
                  <div className="dateRow">
                    <DateField label="ขาไป" date={checkIn} />
                    <DateField label="ขากลับ" date={checkOut} />
                  </div>
                  <GuestPicker rooms={rooms} setRooms={setRooms} />
                </div>

                <button className="searchBtn">
                  <Search size={18} />
                  ค้นหาเที่ยวบิน
                </button>
              </div>
            )}

            {tab === "combo" && (
              <div className="formStack">
                <div className="row">
                  <div className="searchInput flexOne">
                    <Plane size={18} className="goldIcon" />
                    <input
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="บินจาก"
                    />
                  </div>
                  <div className="searchInput flexOne">
                    <Search size={18} className="goldIcon" />
                    <input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="จุดหมายปลายทาง"
                    />
                  </div>
                </div>

                <div className="row">
                  <div className="dateRow">
                    <DateField label="เดินทาง" date={checkIn} />
                    <DateField label="กลับ" date={checkOut} />
                  </div>
                  <GuestPicker rooms={rooms} setRooms={setRooms} />
                </div>

                <button className="searchBtn">
                  <Search size={18} />
                  ค้นหาตั๋วเครื่องบิน + ที่พัก
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="destinations">
          <h2 className="destinationsTitle">จุดหมายยอดนิยม</h2>
          <div className="destinationsRow">
            {destinations.map((d) => (
              <button
                key={d}
                className="destCard"
                onClick={() => {
                  setDestination(d);
                  setTab("hotel");
                }}
              >
                <span className="destCardOverlay" />
                <span className="destCardLabel">{d}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">HOTEL TRAVEL · BOOK WITH CONFIDENCE</footer>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #faf7f0;
          color: #1b2430;
          font-family: "Noto Sans Thai", "Segoe UI", sans-serif;
        }
        .header {
          border-bottom: 1px solid #e3dcc9;
          background: #14213d;
        }
        .headerInner {
          max-width: 1152px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brandStar {
          color: #c9973b;
        }
        .brandName {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 20px;
          color: #fff;
        }
        .nav {
          display: none;
          gap: 32px;
          font-size: 14px;
          color: #c9c2ac;
        }
        @media (min-width: 768px) {
          .nav {
            display: flex;
          }
        }
        .nav a {
          color: inherit;
          text-decoration: none;
        }
        .nav a:hover {
          color: #fff;
        }
        .loginBtn {
          border: 1px solid #c9973b;
          background: transparent;
          color: #e4c588;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }
        .loginBtn:hover {
          background: #1e3a5f;
        }
        .hero {
          position: relative;
          background: #14213d;
          overflow: hidden;
        }
        .heroInner {
          position: relative;
          max-width: 1152px;
          margin: 0 auto;
          padding: 56px 24px 112px;
          text-align: center;
        }
        .heroStars {
          margin-bottom: 8px;
          font-size: 12px;
          letter-spacing: 0.3em;
          color: #c9973b;
        }
        .heroTitle {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 32px;
          color: #fff;
          margin: 0;
        }
        .heroSubtitle {
          margin-top: 12px;
          font-size: 14px;
          color: #c9c2ac;
        }
        .searchSection {
          max-width: 960px;
          margin: -80px auto 0;
          padding: 0 24px 64px;
        }
        .searchCard {
          border-radius: 10px;
          border: 1px solid #e3dcc9;
          background: #fff;
          box-shadow: 0 20px 50px -20px rgba(20, 33, 61, 0.35);
        }
        .tabs {
          display: flex;
          border-bottom: 1px solid #ede7da;
          padding: 0 8px;
          overflow-x: auto;
        }
        .tabBtn {
          display: flex;
          align-items: center;
          gap: 8px;
          border: none;
          background: transparent;
          border-bottom: 2px solid transparent;
          padding: 16px 20px;
          font-size: 14px;
          color: #8a8371;
          cursor: pointer;
          white-space: nowrap;
        }
        .tabBtn:hover {
          color: #14213d;
        }
        .tabBtnActive {
          border-bottom-color: #c9973b;
          color: #14213d;
        }
        .tabPanel {
          padding: 24px;
        }
        .formStack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .searchInput {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid #e3dcc9;
          border-radius: 6px;
          background: #fff;
          padding: 12px 16px;
        }
        .searchInput:focus-within {
          border-color: #c9973b;
        }
        .searchInput input {
          border: none;
          outline: none;
          width: 100%;
          font-size: 15px;
        }
        .searchInput input::placeholder {
          color: #a69b84;
        }
        .flexOne {
          flex: 1;
        }
        .row {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        @media (min-width: 640px) {
          .row {
            flex-direction: row;
          }
        }
        .rowAlignCenter {
          align-items: center;
        }
        .swapBtn {
          align-self: center;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid #e3dcc9;
          background: #fff;
          color: #c9973b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .swapBtn:hover {
          background: #faf7f0;
        }
        .dateRow {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        @media (min-width: 640px) {
          .dateRow {
            flex-direction: row;
          }
        }
        .dateField {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid #e3dcc9;
          background: #fff;
          padding: 12px 16px;
        }
        .dateRow .dateField:first-child {
          border-radius: 6px 6px 0 0;
        }
        .dateRow .dateField:last-child {
          border-radius: 0 0 6px 6px;
          border-top: none;
        }
        @media (min-width: 640px) {
          .dateRow .dateField:first-child {
            border-radius: 6px 0 0 6px;
            border-right: none;
          }
          .dateRow .dateField:last-child {
            border-radius: 0 6px 6px 0;
            border-top: 1px solid #e3dcc9;
          }
        }
        .dateLabel {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #a69b84;
        }
        .dateTop {
          display: block;
          font-size: 15px;
          line-height: 1.3;
          color: #1b2430;
        }
        .dateBottom {
          display: block;
          font-size: 12px;
          color: #7a7266;
        }
        .goldIcon {
          flex-shrink: 0;
          color: #c9973b;
        }
        .guestPicker {
          position: relative;
          flex: 1;
          min-width: 180px;
        }
        .fieldBtn {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          border: 1px solid #e3dcc9;
          border-radius: 6px;
          background: #fff;
          padding: 12px 16px;
          text-align: left;
          cursor: pointer;
        }
        .fieldBtn:hover {
          border-color: #c9973b;
        }
        .fieldBtnText {
          flex: 1;
        }
        .fieldBtnMain {
          display: block;
          font-size: 15px;
          line-height: 1.3;
          color: #1b2430;
        }
        .fieldBtnSub {
          display: block;
          font-size: 12px;
          color: #7a7266;
        }
        .chevron {
          flex-shrink: 0;
          color: #7a7266;
          transition: transform 0.15s ease;
        }
        .chevronOpen {
          transform: rotate(180deg);
        }
        .guestDropdown {
          position: absolute;
          right: 0;
          z-index: 20;
          margin-top: 8px;
          width: 320px;
          max-width: 90vw;
          border: 1px solid #e3dcc9;
          border-radius: 6px;
          background: #fff;
          padding: 16px;
          box-shadow: 0 20px 40px -12px rgba(20, 33, 61, 0.3);
        }
        .roomBlock {
          margin-top: 0;
        }
        .roomBlockDivider {
          margin-top: 16px;
          border-top: 1px solid #ede7da;
          padding-top: 16px;
        }
        .roomTitle {
          margin: 0 0 12px;
          font-family: Georgia, serif;
          font-size: 15px;
          color: #14213d;
        }
        .counterRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
        }
        .counterLabel {
          font-size: 14px;
          color: #4a4740;
        }
        .counterControls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .counterBtn {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid #d8d0bc;
          background: #fff;
          color: #14213d;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .counterBtn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .counterValue {
          width: 16px;
          text-align: center;
          font-size: 14px;
        }
        .guestDropdownFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 16px;
          border-top: 1px solid #ede7da;
          padding-top: 16px;
        }
        .addRoomBtn {
          border: none;
          background: transparent;
          color: #c9973b;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .addRoomBtn:hover {
          text-decoration: underline;
        }
        .doneBtn {
          border: none;
          border-radius: 6px;
          background: #14213d;
          color: #fff;
          padding: 6px 16px;
          font-size: 14px;
          cursor: pointer;
        }
        .doneBtn:hover {
          background: #1e3a5f;
        }
        .searchBtn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          border: none;
          border-radius: 6px;
          background: linear-gradient(to right, #c9973b, #b9822b);
          color: #fff;
          padding: 14px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
        }
        .searchBtn:hover {
          filter: brightness(1.05);
        }
        .destinations {
          margin-top: 56px;
        }
        .destinationsTitle {
          margin: 0 0 20px;
          font-family: Georgia, serif;
          font-size: 20px;
          color: #14213d;
        }
        .destinationsRow {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          padding-bottom: 8px;
        }
        .destCard {
          position: relative;
          flex-shrink: 0;
          width: 176px;
          height: 128px;
          border-radius: 6px;
          border: 1px solid #e3dcc9;
          overflow: hidden;
          cursor: pointer;
          padding: 0;
        }
        .destCardOverlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom right, #1e3a5f, #14213d);
          opacity: 0.9;
        }
        .destCard:hover .destCardOverlay {
          opacity: 0.75;
        }
        .destCardLabel {
          position: absolute;
          bottom: 12px;
          left: 12px;
          font-family: Georgia, serif;
          font-size: 15px;
          color: #fff;
        }
        .footer {
          border-top: 1px solid #e3dcc9;
          background: #fff;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          letter-spacing: 0.05em;
          color: #a69b84;
        }
      `}</style>
    </div>
  );
}