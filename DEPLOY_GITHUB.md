# 🚀 Deploy Agri-Risk Dashboard → GitHub Pages

## ขั้นตอน (ทำครั้งเดียว ~10 นาที)

---

### STEP 1 — สร้าง GitHub Repository

1. ไปที่ https://github.com/new
2. Repository name: `agri-risk-map-burning`
3. ตั้งเป็น **Public** (GitHub Pages ฟรีต้องเป็น Public)
4. **อย่า** ติ๊ก "Initialize with README"
5. คลิก **Create repository**

---

### STEP 2 — ติดตั้ง Git (ถ้ายังไม่มี)

ดาวน์โหลด: https://git-scm.com/download/win  
ติดตั้งด้วยค่า default ทั้งหมด

---

### STEP 3 — Push โค้ดขึ้น GitHub

เปิด **Git Bash** หรือ **Command Prompt** ใน folder โปรเจกต์:

```bash
cd "D:\OneDrive\0. DOAE กลุ่มอารักขาพืช\1.0 ปี 2569\3.2 Burn Scar\3. DOAE Risk Map Burning\2. Risk Map Burning"

# ครั้งแรก
git init
git add .
git commit -m "Initial: Agri-Risk Map Burning Dashboard KPT"

# เปลี่ยน YOUR_USERNAME เป็น GitHub username ของคุณ
git remote add origin https://github.com/YOUR_USERNAME/agri-risk-map-burning.git
git branch -M main
git push -u origin main
```

---

### STEP 4 — เปิด GitHub Pages

1. ไปที่ repository บน GitHub
2. คลิก **Settings** (แถบบนสุด)
3. เลือก **Pages** (เมนูซ้าย)
4. Source: **GitHub Actions**
5. คลิก **Save**

GitHub Actions จะ build และ deploy อัตโนมัติ (~2-3 นาที)

---

### STEP 5 — เปิดเว็บ

URL จะเป็น:
```
https://YOUR_USERNAME.github.io/agri-risk-map-burning/
```

แสดงใน Settings → Pages หลัง deploy เสร็จ

---

## 📋 ก่อน Push — ตรวจสอบไฟล์สำคัญ

```
✅ index.html
✅ css/style.css
✅ js/config.js, map.js, app.js, dashboard.js, risk.js, api.js, geoserver.js
✅ data/boundary/district_kpt.geojson
✅ data/boundary/subdistrict_kpt.geojson
✅ data/hotspot/hotspot_2566.geojson
✅ data/hotspot/hotspot_2567.geojson
✅ data/hotspot/hotspot_2568.geojson
✅ data/burnscar/burnscar_kpt.geojson
✅ data/crop/crop_kpt.geojson
✅ data/risk/risk_kpt.geojson   ← รัน compute_risk_only.py ก่อน
✅ .github/workflows/deploy.yml
```

## ⚡ Risk Score ยังไม่มี?

รันใน QGIS Python Console ก่อน push:
```python
exec(open(r'D:\OneDrive\0. DOAE กลุ่มอารักขาพืช\1.0 ปี 2569\3.2 Burn Scar\3. DOAE Risk Map Burning\2. Risk Map Burning\scripts\compute_risk_only.py').read())
```

---

## 🔄 Update ในอนาคต

```bash
git add .
git commit -m "Update data"
git push
```
GitHub Actions deploy ใหม่อัตโนมัติ
