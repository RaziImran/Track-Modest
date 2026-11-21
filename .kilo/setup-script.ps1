$ErrorActionPreference = 'Stop'

$worktreePath = $env:WORKTREE_PATH
if ([string]::IsNullOrWhiteSpace($worktreePath)) {
    throw 'Kilo did not provide WORKTREE_PATH; cannot prepare this worktree.'
}

if (-not (Test-Path -LiteralPath (Join-Path $worktreePath 'pnpm-lock.yaml'))) {
    throw "The worktree at '$worktreePath' does not contain pnpm-lock.yaml."
}

$nodeVersionText = (& node --version).Trim().TrimStart('v')
if ($LASTEXITCODE -ne 0) {
    throw 'Node.js is required. Install Node.js 22 or newer, then retry worktree setup.'
}
$nodeVersion = [version]$nodeVersionText
if ($nodeVersion.Major -lt 22) {
    throw "Node.js 22 or newer is required; found v$nodeVersionText."
}

$pnpmVersion = (& pnpm --version).Trim()
if ($LASTEXITCODE -ne 0) {
    throw 'pnpm is required. Install pnpm 12.21.0, then retry worktree setup.'
}
if ($pnpmVersion -ne '12.21.0') {
    throw "This repository pins pnpm 12.21.0; found $pnpmVersion."
}

Push-Location -LiteralPath $worktreePath
try {
    & pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm install failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
