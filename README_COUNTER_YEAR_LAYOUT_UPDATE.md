# Counter / Year Dropdown / Timeline Layout Update

ปรับปรุงจากชุด Counter / Dropdown ปี / ปิดคู่มือ โดยคงโครงสร้างระบบเดิมไว้

## สิ่งที่ปรับ

1. เปลี่ยน Visit counter เป็นชุด `jwoy` และ whomania id ใหม่ตามที่กำหนด
2. ซ่อน backlink ที่ไม่เกี่ยวข้องกับระบบ ไม่ให้รบกวนหน้าเว็บ
3. แก้ปีประเมินให้แสดงเป็น Dropdown ชัดเจน
4. ล้าง CSS เดิมที่เคย clip/ซ่อน `<select id="timeline-year">` เพื่อให้ Dropdown เห็นจริงทุกขนาดหน้าจอ
5. ปรับ card แถบ Hotspot ด้านบนใหม่ให้เห็นครบ:
   - ปีประเมิน
   - สถานะสะสม
   - ปุ่มสะสมทุกเดือน
   - เดือน ม.ค.–ธ.ค.
   - ปุ่มล้างการเลือกเดือน
6. ปรับ responsive สำหรับ tablet และ smartphone โดยยังคงแนว map-first

## ไฟล์ที่แก้

- `index.html`
- `css/style.css`

## Commit ที่แนะนำ

```text
Fix visit counter year dropdown visibility and timeline layout
```
