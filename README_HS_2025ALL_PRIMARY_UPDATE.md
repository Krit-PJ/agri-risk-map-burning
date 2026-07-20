# HS 2025All Primary Data Update

ปรับปรุงข้อมูลจุดความร้อนสะสมโดยใช้ไฟล์ `2026_KPI_HS_Anlys.xlsx` เป็นข้อมูลหลัก และใช้ Sheet `2025All` สำหรับชุดข้อมูลปี 2568 เป็นฐานตรวจสอบ/นำเข้าใหม่

## เงื่อนไขการกรอง

- ใช้คอลัมน์ `YYYY-MM-DD`, `Time`, `Province`, `Amphoe`, `Tambon`, `LandType`, `PlantType`
- เลือกเฉพาะ `Province = กำแพงเพชร`
- คงเงื่อนไขมาตรฐานระบบ: `LandType = พื้นที่เกษตร`
- ใช้ `PlantType` เป็นชนิดข้อมูลหลักในการคำนวณ/จำแนก
- ลบข้อมูลซ้ำด้วย `hsID`
- เก็บลำดับพื้นที่ `Province → Amphoe → Tambon → BaanN`

## สรุปผลหลังปรับ

| ชุดข้อมูล | ที่มา | ช่วงวันที่ | จำนวน HS |
|---|---|---:|---:|
| 2567 | ข้อมูลมาตรฐานเดิมที่จัดทำไว้ก่อนหน้า | 2024-01-01 ถึง 2024-05-19 | 341 |
| 2568 | Sheet `2025All` | 2024-10-05 ถึง 2025-09-18 | 437 |
| 2569 | Sheet `2026All` จากไฟล์เดียวกัน เพื่อคงช่วงปีงบประมาณต่อเนื่อง | 2025-10-02 ถึง 2026-05-12 | 585 |

## ไฟล์ที่ปรับ

- `data/hotspot/hotspot_2568.geojson`
- `data/hotspot/hotspot_2569.geojson`
- `data/hotspot/hotspot_2568_qa.json`
- `data/hotspot/hotspot_2569_qa.json`
- `data/hotspot/hotspot_all_years_qa.json`
- `data/hotspot/hotspot_day_summary_2567_2569.json`
- `data/hotspot/hotspot_month_summary_2567_2569.json`
- `data/hotspot/hotspot_year_summary_2567_2569.json`

โครงสร้างหน้าเว็บและฟังก์ชันอื่นคงเดิม
