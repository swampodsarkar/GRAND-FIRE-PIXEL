@echo off
echo ========================================
echo   FIRESTRIKEx Android Setup
echo ========================================
echo.

echo Step 1: Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed!
    echo Make sure Node.js is installed and run as Administrator
    pause
    exit /b 1
)
echo.

echo Step 2: Building React app...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo.

echo Step 3: Adding Android platform...
call npx cap add android
echo.

echo Step 4: Syncing to Android...
call npx cap sync android
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next: Opening Android Studio...
echo Build APK from: Build ^> Build APK(s)
echo.
call npx cap open android

pause
