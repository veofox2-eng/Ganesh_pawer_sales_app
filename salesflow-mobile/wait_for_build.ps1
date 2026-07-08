$OutputFolder = "D:\Fox Editz\DEVELOPED APPS\Sales\V1.0"
if (-not (Test-Path $OutputFolder)) { New-Item -ItemType Directory -Path $OutputFolder -Force }

while ($true) {
    npx eas build:list --limit 1 --non-interactive --json | Out-File latest_build.json
    $build = (Get-Content -Encoding Unicode latest_build.json | ConvertFrom-Json)[0]
    $status = $build.status
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Current status: $status"
    if ($status -eq "FINISHED") {
        $url = $build.artifacts.buildUrl
        Write-Host "Downloading APK from $url"
        Invoke-WebRequest -Uri $url -OutFile "$OutputFolder\SalesFlow.apk"
        Write-Host "APK downloaded successfully to $OutputFolder\SalesFlow.apk"
        break
    } elseif ($status -eq "ERRORED" -or $status -eq "CANCELED") {
        Write-Host "Build failed or canceled."
        break
    }
    Start-Sleep -Seconds 60
}
