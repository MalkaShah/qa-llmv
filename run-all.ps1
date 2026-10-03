# run-all.ps1
# Runs every LLMV suite in order, then builds the HTML bug report.
#
# Usage:
#   .\run-all.ps1              runs API, UI, DB, E2E  (no credits consumed)
#   .\run-all.ps1 -Costly      also runs the billing chain (~5 UC)
#
# Requirements: Twingate connected, LLMV_TOKEN current in .env.db

param([switch]$Costly)

$ErrorActionPreference = "Continue"
$start = Get-Date

function Show-Step($n, $total, $name) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    Write-Host "  [$n/$total]  $name" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    Write-Host ""
}

$total = if ($Costly) { 5 } else { 4 }

Show-Step 1 $total "API suite"
npx playwright test tests/api --project=api

Show-Step 2 $total "UI suite"
npx playwright test tests/ui --project=ui

Show-Step 3 $total "Database suite"
npx playwright test tests/db --project=db

Show-Step 4 $total "E2E suite"
npx playwright test tests/e2e --project=e2e --grep-invert "@costly"

if ($Costly) {
    Show-Step 5 $total "Billing chain (consumes credits)"
    npx playwright test tests/e2e --project=e2e --grep "@costly"
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host "  Building HTML report" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host ""

node build-html-report.mjs

$elapsed = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)
Write-Host ""
Write-Host "All suites finished in $elapsed minutes." -ForegroundColor Green
Write-Host ""

if (Test-Path "qa-report.html") {
    Write-Host "Opening qa-report.html ..." -ForegroundColor Green
    Start-Process "qa-report.html"
} else {
    Write-Host "qa-report.html was not created - check the output above." -ForegroundColor Yellow
}
