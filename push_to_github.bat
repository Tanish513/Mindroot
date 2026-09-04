@echo off
set "PATH=%LOCALAPPDATA%\Git\cmd;%PATH%"
echo ======================================================
echo Staging and Pushing updates to GitHub...
echo ======================================================
echo.
git add .
git commit -m "Configure production Google OAuth, Supabase database, and cloud deployment"
git push origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo ======================================================
    echo SUCCESS! Repository successfully updated on GitHub!
    echo Vercel will now automatically redeploy the latest code.
    echo ======================================================
) else (
    echo.
    echo If prompted to sign in, please complete the browser login.
)
pause
