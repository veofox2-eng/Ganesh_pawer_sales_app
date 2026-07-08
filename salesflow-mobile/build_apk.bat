@echo off
setlocal
set ANDROID_HOME=C:\Users\saara\AppData\Local\Android\Sdk
echo Clearing old drive mapping...
subst S: /D >nul 2>&1
echo Mapping S: drive to project root...
subst S: "d:\Fox Editz\DEVELOPMENT\SALES APP 2\salesflow-mobile"
if errorlevel 1 (
    echo [ERROR] Failed to map S: drive.
    exit /b 1
)
echo Changing to S: drive and building...
S:
cd android
call gradlew.bat assembleRelease
if errorlevel 1 (
    echo [ERROR] Build failed.
    subst S: /D
    exit /b 1
)
echo [SUCCESS] Build completed.
subst S: /D
exit /b 0
