param (
    [string]$employeeDest = "D:\Fox Editz\DEVELOPED APPS\Sales\2\employee\1\8th ver",
    [string]$adminDest = "D:\Fox Editz\DEVELOPED APPS\Sales\2\admin\1\8th ver"
)

Write-Host "Starting Employee Build..." -ForegroundColor Cyan
(Get-Content android\app\build.gradle) -replace 'applicationId "com\.veofox\.salesflowadmin"', 'applicationId "com.veofox.salesflow"' | Set-Content android\app\build.gradle

Set-Location android
.\gradlew clean
.\gradlew assembleRelease
Set-Location ..

If (Test-Path "android\app\build\outputs\apk\release\app-release.apk") {
    Write-Host "Employee Build successful! Copying..." -ForegroundColor Green
    if (!(Test-Path $employeeDest)) { New-Item -ItemType Directory -Force -Path $employeeDest }
    Copy-Item -Path "android\app\build\outputs\apk\release\app-release.apk" -Destination "$employeeDest\salesflow-employee-v8.apk" -Force
} Else {
    Write-Host "Employee Build failed." -ForegroundColor Red
}

Write-Host "Starting Admin Build..." -ForegroundColor Cyan
(Get-Content android\app\build.gradle) -replace 'applicationId "com\.veofox\.salesflow"', 'applicationId "com.veofox.salesflowadmin"' | Set-Content android\app\build.gradle

Set-Location android
.\gradlew clean
.\gradlew assembleRelease
Set-Location ..

If (Test-Path "android\app\build\outputs\apk\release\app-release.apk") {
    Write-Host "Admin Build successful! Copying..." -ForegroundColor Green
    if (!(Test-Path $adminDest)) { New-Item -ItemType Directory -Force -Path $adminDest }
    Copy-Item -Path "android\app\build\outputs\apk\release\app-release.apk" -Destination "$adminDest\salesflow-admin-v8.apk" -Force
} Else {
    Write-Host "Admin Build failed." -ForegroundColor Red
}

Write-Host "All done!" -ForegroundColor Magenta
