# Print Map Fit + Report Right Column Update

ปรับปรุงรายงานพิมพ์ A4 แนวนอน

- ไม่ใช้การ capture map เป็นภาพนิ่ง เพราะ basemap จากภายนอกโดยเฉพาะ satellite tile มีความเสี่ยง CORS/tainted canvas ทำให้ภาพว่างหรือ export ไม่ครบ
- ใช้วิธีทำให้ Leaflet map เข้าสู่ layout พิมพ์ก่อน แล้วสั่ง invalidateSize + fitBounds ซ้ำก่อนเปิดหน้าต่างพิมพ์
- ปรับแผนที่ให้เล็กลงและอยู่กึ่งกลาง เพื่อให้เห็นพื้นที่ที่กรองเลือกครบขึ้น
- จัดด้านขวาของรายงานเป็น 3 ส่วนชัดเจน:
  1. ตารางเปรียบเทียบ Hotspot แสดงครบทุกคอลัมน์
  2. Card เกณฑ์ระดับความเสี่ยง 4 ระดับ
  3. Donut chart ระดับความเสี่ยงสะสมอยู่ล่างสุด
- ลดโอกาส chart/table ซ้อนทับกันใน PDF

Commit message: `Improve print map fit and right report column layout`
