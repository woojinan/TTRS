$ErrorActionPreference = 'Stop'
$configPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
if (Test-Path -LiteralPath $configPath) {
    Write-Host '.env already exists; keeping the existing database password.'
    exit 0
}
$secretBytes = New-Object byte[] 32
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($secretBytes) } finally { $generator.Dispose() }
$password = -join ($secretBytes | ForEach-Object { $_.ToString('x2') })
$content = "POSTGRES_PASSWORD=$password`nTTRS_PORT=1558`nTTRS_BIND=0.0.0.0`nCOOKIE_SECURE=false`n"
[System.IO.File]::WriteAllText($configPath, $content, (New-Object System.Text.UTF8Encoding $false))
Write-Host 'Created .env with a random database password. Keep this file private and backed up.'
