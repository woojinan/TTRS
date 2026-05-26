<#
.SYNOPSIS
    ai/requests, ai/logs, ai/status 의 자동 생성 파일을 삭제합니다.
    ai/tasks, ai/reviews, ai/rules 는 건드리지 않습니다.

.PARAMETER Dry
    -Dry 플래그를 붙이면 실제 삭제 없이 삭제 대상 목록만 출력합니다.

.EXAMPLE
    .\harness\clean.ps1        # 실제 삭제
    .\harness\clean.ps1 -Dry   # 미리 보기
#>
param(
    [switch]$Dry
)

$projectRoot = Split-Path -Parent $PSScriptRoot

$targets = @(
    (Join-Path $projectRoot "ai\requests"),
    (Join-Path $projectRoot "ai\logs"),
    (Join-Path $projectRoot "ai\status")
)

$totalFiles = 0

foreach ($dir in $targets) {
    if (-not (Test-Path $dir)) { continue }

    $files = Get-ChildItem $dir -File -Recurse | Where-Object { $_.Name -ne ".gitkeep" }
    if ($files.Count -eq 0) { continue }

    Write-Host "[$dir]" -ForegroundColor Yellow
    foreach ($f in $files) {
        $rel = $f.FullName.Replace($projectRoot + "\", "")
        Write-Host "  $rel"
        $totalFiles++
        if (-not $Dry) { Remove-Item $f.FullName -Force }
    }
}

if ($totalFiles -eq 0) {
    Write-Host "정리할 파일이 없습니다." -ForegroundColor Green
    exit 0
}

if ($Dry) {
    Write-Host ""
    Write-Host "총 $totalFiles 개 파일 (미리 보기 — 실제 삭제 안 됨)" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "총 $totalFiles 개 파일 삭제 완료." -ForegroundColor Green
}
