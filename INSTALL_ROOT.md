# ติดตั้งชุด Agri-Risk Map Burning ที่ Root Repository

ชุดนี้จัดวางไฟล์แบบ Root-ready ไม่มีโฟลเดอร์โครงการซ้อนภายใน ZIP

## ขั้นตอน
1. ปิด GitHub Desktop ชั่วคราว
2. สำรองโฟลเดอร์ repository เดิม
3. ลบเฉพาะโฟลเดอร์ซ้อน `agri-risk-map-burning/agri-risk-map-burning/` และไฟล์สำรอง `index-0.html`, `index-1.html`, `index-2.html`
4. แตก ZIP นี้
5. คัดลอกไฟล์และโฟลเดอร์ทั้งหมดที่อยู่ภายในไปวางที่ Root ของ repository `agri-risk-map-burning/`
6. เปิด GitHub Desktop ตรวจ Changes
7. Commit แล้ว Push origin

## โครงสร้าง Root ที่ถูกต้อง
- index.html
- assets/
- css/
- js/
- data/
- docs/
- .github/workflows/deploy.yml
- .gitignore
- .gitattributes

ห้ามมีโฟลเดอร์ `agri-risk-map-burning/` ซ้อนอยู่ข้างใน Root อีกชั้นหนึ่ง
