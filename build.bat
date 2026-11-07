@echo off
echo ========================================
echo  Reddit Downloader — Build Package
echo ========================================
echo.

echo [1/5] Stopping any running Electron processes...
taskkill /F /IM "Reddit Downloader.exe" 2>nul
taskkill /F /IM electron.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Preserving login and settings from previous build...
if exist "dist\win-unpacked\data" (
    if not exist ".build-preserve" mkdir .build-preserve
    xcopy /E /I /Y "dist\win-unpacked\data" ".build-preserve\data\" 2>nul
)

echo [3/5] Cleaning old build artifacts...
if exist "dist\*.exe" del /q "dist\*.exe" 2>nul
if exist "dist\*.blockmap" del /q "dist\*.blockmap" 2>nul

echo [4/5] Building...
call npm run build:win

if %errorlevel% equ 0 (
    echo.
    echo [5/5] Restoring login and settings...
    if exist ".build-preserve\data" (
        if not exist "dist\win-unpacked\data" mkdir "dist\win-unpacked\data"
        xcopy /E /I /Y ".build-preserve\data" "dist\win-unpacked\data\" 2>nul
        rmdir /S /Q ".build-preserve"
    )
    echo.
    echo Build successful!
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
