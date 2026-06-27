# Agri-Risk Map Burning — Clean System Rebuild

ชุดนี้เขียนส่วนหน้าเว็บใหม่ให้เรียบและเสถียร โดยใช้ข้อมูลเดิมทั้งหมด ได้แก่ boundary, hotspot, crop, burnscar, docs และ assets

## จุดปรับปรุงหลัก

1. ใช้ปีประเมินหลักเพียงชุดเดียวบน Timeline
2. เลือกเดือนสะสมได้หลายเดือน พร้อม preset ม.ค.–พ.ค., ช่วงห้ามเผา, ทั้งปี, ล้าง
3. ตารางเปรียบเทียบ Hotspot แสดงแถวรวมจังหวัด/รวมอำเภอไว้ด้านบน
4. ตารางเปรียบเทียบเรียงปีจากปีเก่าไปปีใหม่ เช่น ปี 2568 → ปี 2569 → เพิ่ม/ลด
5. Smartphone ใช้ Map-first และซ่อน/แสดง panel ด้วยปุ่มลอย
6. ปรับโทนสีเป็น Light Agri Dashboard
7. พิมพ์รายงาน A4 แนวนอน 1 หน้า

## วิธีติดตั้ง

แตกไฟล์ ZIP แล้วคัดลอกไฟล์ทั้งหมดไปวางทับที่ Root ของ repository ที่มี index.html อยู่ทันที

Commit ที่แนะนำ:

```text
Rebuild clean UX system for multi-month hotspot filtering
```
