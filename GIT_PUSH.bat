@echo off
chcp 65001 >nul
title GitHub Push — Agri-Risk Map Burning

echo ============================================
echo  Agri-Risk: Push to GitHub Pages
echo  Repo: Krit-PJ/agri-risk-map-burning
echo ============================================
echo.

cd /d "%~dp0"
echo [DIR] %CD%
echo.

:: Check git
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git ไม่ได้ติดตั้ง
    echo ดาวน์โหลดที่: https://git-scm.com/download/win
    pause & exit /b 1
)

:: Init repo if needed
if not exist ".git" (
    echo [1] git init...
    git init
    git branch -M main
)

:: Stage all files
echo [2] git add...
git add .

:: Commit
echo [3] git commit...
git commit -m "Agri-Risk Map Burning Dashboard — KPT Data" 2>nul || (
    echo (no changes to commit — skipping)
)

:: Add remote if needed
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [4] git remote add...
    git remote add origin https://github.com/Krit-PJ/agri-risk-map-burning.git
) else (
    echo [4] remote already set
)

:: Push
echo.
echo [5] git push... (อาจขอ login GitHub)
git push -u origin main

if errorlevel 1 (
    echo.
    echo หาก error "repository not found":
    echo   1. ไปสร้าง repo ที่ https://github.com/new
    echo   2. ชื่อ: agri-risk-map-burning
    echo   3. Public, ไม่ต้อง initialize
    echo   4. กลับมา double-click GIT_PUSH.bat อีกครั้ง
    pause & exit /b 1
)

echo.
echo ============================================
echo  Push สำเร็จ!
echo.
echo  ขั้นต่อไป — เปิด GitHub Pages:
echo  1. ไปที่ github.com/Krit-PJ/agri-risk-map-burning
echo  2. Settings > Pages > Source: GitHub Actions
echo  3. Save
echo.
echo  URL (ใช้ได้ใน ~3 นาที):
echo  https://Krit-PJ.github.io/agri-risk-map-burning/
echo ============================================
pause
