$OutputFolder = "D:\Fox Editz\DEVELOPED APPS\Sales\V1.1"
if (-not (Test-Path $OutputFolder)) { New-Item -ItemType Directory -Path $OutputFolder -Force }
while ($true) {
    npx eas build:list --limit 1 --non-interactive --json | Out-File latest_build.json
    $builds = Get-Content -Encoding Unicode latest_build.json | ConvertFrom-Json
    $build = $builds[0]
    $status = $build.status
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Status: $status"
    if ($status -eq "FINISHED") {
        $url = $build.artifacts.buildUrl
        Write-Host "Build complete! Downloading from: $url"
        Invoke-WebRequest -Uri $url -OutFile "$OutputFolder\SalesFlow-v1.1.apk"
        Write-Host "APK saved to $OutputFolder\SalesFlow-v1.1.apk"
        break
    } elseif ($status -eq "ERRORED" -or $status -eq "CANCELED") {
        Write-Host "Build $status!"
        $build | ConvertTo-Json -Depth 3
        break
    }
    Start-Sleep -Seconds 60
}
