@echo off
title Signal Board - production
cd /d "%~dp0"

echo ============================================
echo   Signal Board - production
echo ============================================

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo [INFO] Building...
call npm run build
if errorlevel 1 (
    echo [ERROR] build failed.
    pause
    exit /b 1
)

start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"

echo [INFO] Starting on http://localhost:3000  (stop: Ctrl+C)
call npm run start
pause
