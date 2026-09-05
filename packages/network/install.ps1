# ==============================================================================
# MYCA Sovereign Edge Node — Windows 1-Line Installer (PowerShell)
# "Her node kendi cihazında çalışır"
# ==============================================================================

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "Ψ MYCA SOVEREIGN NODE INSTALLER — WINDOWS RUNTIME" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js bulunamadi! Lutfen yukleyin: https://nodejs.org" -ForegroundColor Red
    Exit 1
}

$InstallDir = "$env:USERPROFILE\.myca"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

Write-Host "Kurulum klasoru: $InstallDir" -ForegroundColor Green

if (Test-Path "$InstallDir\.git") {
    Set-Location $InstallDir
    git pull
} else {
    Write-Host "MYCA Sovereign Core indiriliyor..." -ForegroundColor Cyan
    git clone --depth 1 https://github.com/myc-network/myc-network.git $InstallDir
}

Set-Location $InstallDir
Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "KURULUM BASARIYLA TAMAMLANDI!" -ForegroundColor Green
Write-Host "Node'unuzu baslatmak icin:" -ForegroundColor White
Write-Host "   node bin\myc-node.js start" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan
