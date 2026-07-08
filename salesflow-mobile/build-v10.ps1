param (
    [string]$employeeDest = "D:\Fox Editz\DEVELOPED APPS\Sales\2\employee\1\10th ver",
    [string]$adminDest = "D:\Fox Editz\DEVELOPED APPS\Sales\2\admin\1\10th ver"
)

# ─── EMPLOYEE APP BUILD (Indoor Sales + Field) ───────────────────────────────
Write-Host "Starting Employee App Build (Combined)..." -ForegroundColor Cyan
Set-Location android
.\gradlew clean
.\gradlew assembleSalesRelease -PsuppressKotlinVersionCompatibilityCheck=true
Set-Location ..

if (Test-Path "android\app\build\outputs\apk\sales\release\app-sales-arm64-v8a-release.apk") {
    Write-Host "Employee Build successful!" -ForegroundColor Green
    if (!(Test-Path $employeeDest)) { New-Item -ItemType Directory -Force -Path $employeeDest }
    Copy-Item -Path "android\app\build\outputs\apk\sales\release\app-sales-arm64-v8a-release.apk" -Destination "$employeeDest\salesflow-employee-v10.apk" -Force
}

# ─── ADMIN APP BUILD ──────────────────────────────────────────────────────────
Write-Host "Starting Admin App Build..." -ForegroundColor Cyan
Set-Location android
.\gradlew assembleAdminRelease -PsuppressKotlinVersionCompatibilityCheck=true
Set-Location ..

if (Test-Path "android\app\build\outputs\apk\admin\release\app-admin-arm64-v8a-release.apk") {
    Write-Host "Admin Build successful!" -ForegroundColor Green
    if (!(Test-Path $adminDest)) { New-Item -ItemType Directory -Force -Path $adminDest }
    Copy-Item -Path "android\app\build\outputs\apk\admin\release\app-admin-arm64-v8a-release.apk" -Destination "$adminDest\salesflow-admin-v10.apk" -Force
}

Write-Host "All processes completed!" -ForegroundColor Magenta
