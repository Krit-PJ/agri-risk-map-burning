# Performance and Chart Stability Fix

ปรับแก้ปัญหา Hotspot รายปี (Trend) ขยายกราฟต่อเนื่องและอาการ Refresh/ค้างช่วงเปิดหน้าเว็บ

## การแก้ไขหลัก
- เปลี่ยน Chart.js เป็น `maintainAspectRatio:false` และกำหนดความสูง canvas คงที่
- เพิ่ม `animation:false` และ `resizeDelay` ลดการคำนวณซ้ำ
- เพิ่ม `queueRefresh()` ด้วย `requestAnimationFrame()` เพื่อรวมคำสั่ง refresh หลายรอบให้เหลือรอบเดียว
- ทำลาย chart instance เดิมก่อนสร้างใหม่ ป้องกัน canvas ถูก bind ซ้ำ
- เพิ่ม CSS lock ขนาด chart container สำหรับ Trend, Top 5 และ Risk
- เปิด `chunkedLoading` ให้ MarkerCluster เพื่อลดอาการค้างตอนเพิ่มจุด Hotspot จำนวนมาก

## ไฟล์ที่แก้
- `js/dashboard.js`
- `js/map.js`
- `css/style.css`
