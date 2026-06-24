# Agri-Risk interactive-year update

## สิ่งที่เปลี่ยน
- เพิ่มขนาดตัวอักษรและ contrast ของ UI
- Card Hotspot, Trend, Top 5, Top 10 และ Risk layer ใช้เฉพาะปี Hotspot ที่เลือก
- Risk layer คำนวณใหม่ทันทีเมื่อเปิด/ปิดปี
- เพิ่มนำเข้า Excel ฝั่ง Browser พร้อมตรวจ Province=กำแพงเพชร, LandType=พื้นที่เกษตร, ช่วง ม.ค.–พ.ค., duplicate hsID, พิกัด และชื่อพื้นที่
- ดาวน์โหลดผลแปลงเป็น GeoJSON ได้
- ไม่มี Data Card ระดับความเสี่ยง

## การนำเข้า Excel
1. ระบุปี พ.ศ. ของข้อมูล
2. เลือกไฟล์ .xlsx/.xls
3. กด “ตรวจสอบและนำเข้า”
4. ตรวจจำนวนในสถานะ
5. กด “ดาวน์โหลด GeoJSON” เพื่อนำไฟล์ไปเก็บถาวรที่ `data/hotspot/hotspot_<ปี>.geojson`

> การนำเข้าจาก Browser อยู่ในหน่วยความจำของหน้าเว็บ หากรีเฟรชจะหาย จึงต้องดาวน์โหลด GeoJSON แล้ว Commit เข้า GitHub เพื่อใช้งานถาวร

## Risk alignment update
- At province scope, the risk map is rendered by district and uses the same district Risk Score as the Top 10 district table.
- After selecting a district, both the map and ranking switch to subdistrict Risk Scores.
- Any Hotspot year selection triggers recalculation of district and subdistrict risk layers.
- Added downloadable guide: `docs/risk-ranking-assessment-guide-kpp.pdf`.
