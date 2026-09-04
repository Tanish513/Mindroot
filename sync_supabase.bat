@echo off
set "PATH=%LOCALAPPDATA%\Git\cmd;%PATH%"
echo =========================================================
echo Pushing Mindroot Schema to Supabase PostgreSQL Database
echo =========================================================
echo.
cd server
echo 1. Generating Prisma client...
call npx prisma generate
echo.
echo 2. Pushing schema directly to Supabase...
call npx prisma db push
echo.
if %ERRORLEVEL% equ 0 (
    echo =========================================================
    echo SUCCESS! Supabase PostgreSQL database is fully synced!
    echo Check your Supabase Table Editor to view all tables.
    echo =========================================================
) else (
    echo.
    echo [ERROR] Could not sync with Supabase. Check error details above.
)
pause
