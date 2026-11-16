@echo off
title Freeroute Build & Run
echo ============================================
echo   Freeroute - Production Build and Start
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Generating Prisma client...
call npx prisma generate
if %ERRORLEVEL% neq 0 (
    echo ERROR: Prisma generate failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Running production build...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed. Fix the errors above and try again.
    pause
    exit /b 1
)

echo.
echo [3/3] Starting production server on port 20129...
echo.
call npm start

pause
