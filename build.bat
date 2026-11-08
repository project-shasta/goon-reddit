@echo off
echo ========================================
echo  GoOn ReDdIt - Build Package
echo ========================================
echo.

echo [0/6] Checking local Electron installation...
if not exist "node_modules\electron\dist\electron.exe" (
    echo.
    echo ERROR: Electron is not installed.
    echo Run "npm install" first, then try again.
    echo.
    echo Press any key to close.
    pause >nul
    exit /b 1
)
echo  OK — found Electron locally.

echo [1/6] Regenerating app icon...
call npm run icon:gen >nul 2>&1

echo [2/6] Stopping any running Electron processes...
taskkill /F /IM "goon-reddit.exe" 2>nul
taskkill /F /IM electron.exe 2>nul
timeout /t 2 /nobreak >nul

echo [3/6] Preserving login session from previous build...
if exist "dist\win-unpacked\data\Partitions\reddit" (
    if not exist ".build-preserve\data\Partitions\reddit" mkdir ".build-preserve\data\Partitions\reddit" 2>nul
    xcopy /E /I /Y "dist\win-unpacked\data\Partitions\reddit" ".build-preserve\data\Partitions\reddit\" 2>nul
)
if exist "dist\win-unpacked\data\Local State" (
    if not exist ".build-preserve\data" mkdir ".build-preserve\data"
    copy /Y "dist\win-unpacked\data\Local State" ".build-preserve\data\Local State" 2>nul
)

echo [5/6] Cleaning old build artifacts...
if exist "dist\*.exe" del /q "dist\*.exe" 2>nul
if exist "dist\*.blockmap" del /q "dist\*.blockmap" 2>nul

echo [6/6] Building...
call npm run build:win

if %errorlevel% equ 0 (
    echo.
    echo Restoring login session...
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
