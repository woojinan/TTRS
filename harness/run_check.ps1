Write-Host "=== TTRS Harness Check ==="

Write-Host "`n[1] Python version"
python --version

Write-Host "`n[2] Pip version"
pip --version

Write-Host "`n[3] Installed packages"
pip list

Write-Host "`n[4] Syntax check"
python -m py_compile main.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "Syntax check failed." -ForegroundColor Red
    exit 1
}

Write-Host "Syntax check passed." -ForegroundColor Green

Write-Host "`n[5] Git status"
git status

Write-Host "`n=== Harness Check Complete ==="
