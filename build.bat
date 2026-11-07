@echo off
echo ========================================
echo  Reddit Downloader — Build Package
echo ========================================
echo.

echo [1/4] Stopping any running Electron processes...
taskkill /F /IM "Reddit Downloader.exe" 2>nul
taskkill /F /IM electron.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] Cleaning old build artifacts...
if exist "dist\*.exe" del /q "dist\*.exe" 2>nul
if exist "dist\*.blockmap" del /q "dist\*.blockmap" 2>nul

echo [3/4] Building...
call npm run build:win

if %errorlevel% equ 0 (
    echo.
    echo [4/4] Build successful!
    echo.
    echo Output:
    dir /b "dist\*.zip" 2>nul | findstr /v builder-debug
    echo.
    echo Done. Press any key to close.
    pause >nul
) else (
    echo.
    echo Build failed. Check the errors above.
    echo Press any key to close.
    pause >nul
)
