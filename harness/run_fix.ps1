param(
    [Parameter(Mandatory=$true)]
    [string]$TaskId,
    [Parameter(Mandatory=$true)]
    [int]$Round
)

$projectRoot   = Split-Path -Parent $PSScriptRoot

$fixPromptFile = Join-Path $projectRoot "ai\requests\fix_${TaskId}_R${Round}.md"
$logFile       = Join-Path $projectRoot "ai\logs\fix_${TaskId}_R${Round}.log"
$lastFile      = Join-Path $projectRoot "ai\logs\fix_${TaskId}_R${Round}.last.md"
$statusFile    = Join-Path $projectRoot "ai\status\task_${TaskId}.json"
$statusDir     = Join-Path $projectRoot "ai\status"

Write-Host "=== TTRS Fix Runner ===" -ForegroundColor Cyan
Write-Host "Task  : $TaskId"
Write-Host "Round : $Round"

if (-not (Test-Path $fixPromptFile)) {
    Write-Host "[ERROR] Fix prompt not found: $fixPromptFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $statusDir)) {
    New-Item -ItemType Directory -Path $statusDir -Force | Out-Null
}

# Run Codex on fix prompt via stdin
Write-Host ""
Write-Host "[Codex] Running fix R$Round..." -ForegroundColor Cyan
$codexOutput = Get-Content $fixPromptFile -Raw -Encoding UTF8 | codex exec - --output-last-message $lastFile 2>&1
$codexExit   = $LASTEXITCODE

$fullLog = $codexOutput -join "`n"
[System.IO.File]::WriteAllText($logFile, $fullLog, [System.Text.Encoding]::UTF8)
Write-Host "[Codex] Log  : $logFile"
Write-Host "[Codex] Last : $lastFile"

if ($codexExit -ne 0) {
    Write-Host "[Codex] FAILED (exit: $codexExit)" -ForegroundColor Red
    exit 1
}
Write-Host "[Codex] SUCCESS" -ForegroundColor Green

# Verification
Write-Host ""
Write-Host "[Verify] Running run_check.ps1..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "run_check.ps1")
$checkExit = $LASTEXITCODE

if ($checkExit -ne 0) {
    Write-Host "[Verify] FAILED - stopping." -ForegroundColor Red
    exit 1
}
Write-Host "[Verify] PASSED" -ForegroundColor Green

# Write status: fix_done
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$statusJson = "{`"task_id`":`"$TaskId`",`"status`":`"fix_done`",`"round`":$Round,`"timestamp`":`"$timestamp`"}"
[System.IO.File]::WriteAllText($statusFile, $statusJson, [System.Text.Encoding]::UTF8)
Write-Host "[Status] fix_done → $statusFile"

# Git status
Write-Host ""
Write-Host "[Git Status]" -ForegroundColor Cyan
git status

Write-Host ""
Write-Host "=== Fix R$Round Complete ===" -ForegroundColor Cyan
