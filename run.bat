@echo off
title Mindroot Launcher
echo ===================================================
echo             Launching Mindroot Platform
echo ===================================================
echo.

echo [1/3] Starting Express backend with WebRTC Signaling...
start "Mindroot Backend" /min cmd /c "cd server && npx tsx watch src/index.ts"

echo [2/3] Starting Vite React frontend dev server...
start "Mindroot Frontend" /min cmd /c "npm run dev"

echo.
echo [3/3] Waiting for servers to initialize (5 seconds)...
timeout /t 5 /nobreak >nul

echo.
echo Launching browser to http://localhost:5173...
start http://localhost:5173

echo.
echo.
echo ===================================================
echo   Mindroot is Live!
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  echo   [+] On this laptop:        http://localhost:5173
  echo   [+] For OTHER laptops/devices: http:%%a:5173
  goto :done
)
:done
echo ===================================================
echo Keep this window open or minimize it.
echo The servers are running in the background.
echo ===================================================
pause
