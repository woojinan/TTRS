param(
    [Parameter(Mandatory=$true)]
    [string]$TaskId
)

& (Join-Path $PSScriptRoot "start_codex_task.ps1") -TaskId $TaskId
