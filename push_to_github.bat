@echo off
set "PATH=%LOCALAPPDATA%\Git\cmd;%PATH%"
echo ======================================================
echo Staging and Pushing updates to GitHub...
echo ======================================================
echo.
set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=feat: make recommended peer match and community champions dynamic"

git add .
git commit -m "%COMMIT_MSG%"
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
