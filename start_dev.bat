@echo off
title Freeroute Dev Server
echo ==========================================
echo   Freeroute - Starting Development Server
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/2] Generating Prisma client...
call npx prisma generate
if %ERRORLEVEL% neq 0 (
    echo ERROR: Prisma generate failed.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting Next.js dev server on port 20129...
echo.
call npm run dev

pause
