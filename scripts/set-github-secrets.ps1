<#
This PowerShell script sets repository secrets using the GitHub CLI `gh`.
It will prompt for the secrets if they're not passed as arguments or environment variables.

Usage:
  - Join your repo directory and run:
    $Env:VERCEL_TOKEN = "<token>"; $Env:VERCEL_ORG_ID = "<org>"; $Env:VERCEL_PROJECT_ID = "<proj>"; ./set-github-secrets.ps1

  - or run without args and follow prompts:
    ./set-github-secrets.ps1

Prerequisites:
  - gh (GitHub CLI) installed and logged in: gh auth login
  - You must have permission to write repo secrets
#>

param(
    [Parameter(Mandatory = $false)][string]$VERCEL_TOKEN,
    [Parameter(Mandatory = $false)][string]$VERCEL_ORG_ID,
    [Parameter(Mandatory = $false)][string]$VERCEL_PROJECT_ID
)

# Support env variables too
if (-not $VERCEL_TOKEN) { $VERCEL_TOKEN = $Env:VERCEL_TOKEN }
if (-not $VERCEL_ORG_ID) { $VERCEL_ORG_ID = $Env:VERCEL_ORG_ID }
if (-not $VERCEL_PROJECT_ID) { $VERCEL_PROJECT_ID = $Env:VERCEL_PROJECT_ID }

# Prompt if empty
if (-not $VERCEL_TOKEN) { $VERCEL_TOKEN = Read-Host -AsSecureString "Enter VERCEL_TOKEN (will be converted to plaintext for setting)"; $VERCEL_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($VERCEL_TOKEN)) }
if (-not $VERCEL_ORG_ID) { $VERCEL_ORG_ID = Read-Host "Enter VERCEL_ORG_ID" }
if (-not $VERCEL_PROJECT_ID) { $VERCEL_PROJECT_ID = Read-Host "Enter VERCEL_PROJECT_ID" }

Write-Host "Setting repository secrets via gh..."

# Ensure `gh` is installed
$ghCheck = (Get-Command gh -ErrorAction SilentlyContinue)
if (-not $ghCheck) { Write-Error "gh CLI not found. Install from https://cli.github.com/ and run 'gh auth login' first."; exit 1 }

function SafeSetSecret($name, $value) {
    if (-not $value) { Write-Warning "Skipping $name (no value provided)"; return }
    Write-Host "Setting secret: $name"
    gh secret set $name --body "$value"
}

SafeSetSecret -name "VERCEL_TOKEN" -value $VERCEL_TOKEN
SafeSetSecret -name "VERCEL_ORG_ID" -value $VERCEL_ORG_ID
SafeSetSecret -name "VERCEL_PROJECT_ID" -value $VERCEL_PROJECT_ID

Write-Host "Done: Repo secrets updated. Please re-run the GH Action or push to main to trigger deploy (if needed)."