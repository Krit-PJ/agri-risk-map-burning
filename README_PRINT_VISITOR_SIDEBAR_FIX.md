# Print / Visitor / Sidebar Fix Update

ชุดนี้แก้ปัญหาที่พบหลังอัปเดต Header + Print Layout:

1. แก้โหมดพิมพ์รายงานที่ข้อความแตกเป็นแนวตั้งและเนื้อหาไหลไปหน้า 2
2. ย้ายตัวนับผู้เข้าชมจาก Header ไปไว้ Sidebar ฝั่งซ้ายใต้ส่วนคู่มือ/หลักเกณฑ์
3. เอาคำว่า “สำรอง” ออกจากตัวนับผู้เข้าชม แต่ยังคง fallback ภายในเมื่อ external counter ถูกบล็อก
4. ตัด Card “ชุดข้อมูลปีและเดือนสะสม” ออกจาก Sidebar เพราะซ้ำกับแถบเลือกปี/เดือนด้านบน
5. คงส่วนอื่นของระบบเดิมไว้

Commit แนะนำ:

```text
Fix print layout relocate visitor counter and simplify sidebar dataset card
```
