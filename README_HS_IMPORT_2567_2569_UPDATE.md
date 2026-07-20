# HS Import 2567-2569 Update

อัปเดตข้อมูล Hotspot จากไฟล์ `2569-7-20 รวม 67-69 เขต 6.xlsx` โดยใช้เงื่อนไขมาตรฐานเดียวกับระบบปัจจุบัน

## กติกาการกรอง

1. `Province = กำแพงเพชร`
2. `LandType = พื้นที่เกษตร`
3. ใช้ `PlantType` เป็นชนิดข้อมูลหลัก และ normalize ให้อยู่ในกลุ่มที่ระบบรองรับ:
   - นาข้าว
   - อ้อย
   - ข้าวโพดและไร่หมุนเวียน
   - เกษตรอื่น ๆ
   - พื้นที่ป่า
   - อื่น ๆ
4. ใช้ลำดับพื้นที่จากตารางต้นทาง: `Province → Amphoe → Tambon → BaanN`
5. de-duplicate ด้วย `hsID`
6. ใช้พิกัดจากคอลัมน์ `Maps`

## ผลรวมหลังกรอง

| ปีข้อมูล | ช่วงวันที่ | จำนวนจุด HS |
|---|---:|---:|
| 2567 | 2024-01-01 ถึง 2024-05-19 | 341 |
| 2568 | 2025-01-01 ถึง 2025-05-17 | 273 |
| 2569 | 2026-01-02 ถึง 2026-05-12 | 513 |

## ไฟล์ข้อมูลที่ปรับปรุง

- `data/hotspot/hotspot_2567.geojson`
- `data/hotspot/hotspot_2568.geojson`
- `data/hotspot/hotspot_2569.geojson`
- `data/hotspot/hotspot_2567_qa.json`
- `data/hotspot/hotspot_2568_qa.json`
- `data/hotspot/hotspot_2569_qa.json`
- `data/hotspot/hotspot_all_years_qa.json`
- `data/hotspot/hotspot_day_summary_2567_2569.json`
- `data/hotspot/hotspot_month_summary_2567_2569.json`
- `data/hotspot/hotspot_year_summary_2567_2569.json`

## หมายเหตุ

- โครงสร้างระบบเดิมไม่เปลี่ยน
- ไฟล์ `hotspot_2566.geojson` คงเดิม เพราะไฟล์แนบชุดนี้ครอบคลุมเฉพาะปี 2567-2569
- ระบบยังใช้ตัวเลือกช่วงเดือน/ปีและการเปรียบเทียบช่วงเดียวกันของปีก่อนตาม version ล่าสุด
