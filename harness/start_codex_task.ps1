param(
    [Parameter(Mandatory=$true)]
    [string]$TaskId
)

$projectRoot  = Split-Path -Parent $PSScriptRoot

$taskFile     = Join-Path $projectRoot "ai\tasks\task_$TaskId.md"
$requestsDir  = Join-Path $projectRoot "ai\requests"
$logsDir      = Join-Path $projectRoot "ai\logs"
$reviewsDir   = Join-Path $projectRoot "ai\reviews"
$promptFile   = Join-Path $requestsDir "codex_auto_$TaskId.md"
$logFile      = Join-Path $logsDir     "codex_$TaskId.log"
$lastFile     = Join-Path $logsDir     "codex_$TaskId.last.md"
$reviewerFile = Join-Path $requestsDir "reviewer_auto_$TaskId.md"
$statusDir    = Join-Path $projectRoot "ai\status"
$statusFile   = Join-Path $statusDir   "task_$TaskId.json"

Write-Host "=== TTRS Codex Task Runner ===" -ForegroundColor Cyan
Write-Host "Task ID : $TaskId"
Write-Host "Task    : $taskFile"

if (-not (Test-Path $taskFile)) {
    Write-Host "[ERROR] Task file not found: $taskFile" -ForegroundColor Red
    exit 1
}

foreach ($dir in @($requestsDir, $logsDir, $reviewsDir, $statusDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created : $dir" -ForegroundColor DarkGray
    }
}

# Extract ## Codex Prompt section; fall back to full task content
$taskContent = [System.IO.File]::ReadAllText($taskFile, [System.Text.Encoding]::UTF8)
$match = [regex]::Match($taskContent, '(?s)## Codex Prompt\s*\r?\n```[^\r\n]*\r?\n(.*?)\r?\n```')

if ($match.Success) {
    $codexPrompt = $match.Groups[1].Value
    Write-Host "Prompt  : extracted from ## Codex Prompt section"
} else {
    $codexPrompt = $taskContent
    Write-Host "Prompt  : ## Codex Prompt not found, using full task content" -ForegroundColor Yellow
}

[System.IO.File]::WriteAllText($promptFile, $codexPrompt, [System.Text.Encoding]::UTF8)
Write-Host "Saved   : $promptFile" -ForegroundColor Green

# Run Codex (stdin으로 프롬프트 파일을 전달, 마지막 응답은 --output-last-message로 저장)
Write-Host ""
Write-Host "[Codex] Starting..." -ForegroundColor Cyan
$codexOutput = Get-Content $promptFile -Raw -Encoding UTF8 | codex exec - --output-last-message $lastFile 2>&1
$codexExit   = $LASTEXITCODE

# Save full log
$fullLog = $codexOutput -join "`n"
[System.IO.File]::WriteAllText($logFile, $fullLog, [System.Text.Encoding]::UTF8)
Write-Host "[Codex] Log      : $logFile"
Write-Host "[Codex] Last     : $lastFile"

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

# Create reviewer request file
$lastLines = if (Test-Path $lastFile) {
    [System.IO.File]::ReadAllText($lastFile, [System.Text.Encoding]::UTF8)
} else {
    "(Codex 마지막 응답 없음)"
}
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$reviewerContent = @"
# Reviewer Auto Request - Task $TaskId

Generated: $timestamp

## Task Reference
- Task  : ai/tasks/task_$TaskId.md
- Log   : ai/logs/codex_$TaskId.log
- Last  : ai/logs/codex_$TaskId.last.md

## Review Instructions
Codex가 task_$TaskId 를 구현했습니다.
아래 항목을 검토해 주세요.

- [ ] 요구사항 전체 충족 여부
- [ ] 기존 코드 구조 및 메서드 시그니처 유지 여부
- [ ] Out of Scope 항목 미구현 확인
- [ ] 문법 오류 없음 (run_check.ps1 통과 확인)

## Codex Last Response

$lastLines
"@

[System.IO.File]::WriteAllText($reviewerFile, $reviewerContent, [System.Text.Encoding]::UTF8)
Write-Host "[Review] Saved   : $reviewerFile" -ForegroundColor Green

# Write status: codex_done (Claude 리뷰 대기)
$statusJson = "{`"task_id`":`"$TaskId`",`"status`":`"codex_done`",`"round`":0,`"timestamp`":`"$timestamp`"}"
[System.IO.File]::WriteAllText($statusFile, $statusJson, [System.Text.Encoding]::UTF8)
Write-Host "[Status] codex_done → $statusFile"

# Final git status
Write-Host ""
Write-Host "[Git Status]" -ForegroundColor Cyan
git status

Write-Host ""
Write-Host "=== Task $TaskId Complete ===" -ForegroundColor Cyan
