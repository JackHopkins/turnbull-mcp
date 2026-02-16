#Requires -Version 5.1
<#
.SYNOPSIS
    Turnbull MCP — Windows Installer
.DESCRIPTION
    Sets up the Turnbull credit-risk MCP server + OpenCode web interface.
    Mirrors install.sh for Windows users (PowerShell 5.1+).
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─────────────────────────────────────────────────────────────────────────────
# Self-bootstrap — clone repo if not already inside it
# ─────────────────────────────────────────────────────────────────────────────

$InRepo = $false
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw
    if ($pkg -match '"turnbull-mcp"') { $InRepo = $true }
}

if (-not $InRepo) {
    $InstallDir = Join-Path $env:USERPROFILE "turnbull-mcp"
    if (Test-Path (Join-Path $InstallDir ".git")) {
        git -C $InstallDir pull --quiet
    } else {
        git clone https://github.com/JackHopkins/turnbull-mcp.git $InstallDir
    }
    Set-Location $InstallDir
    & "$InstallDir\install.ps1"
    exit $LASTEXITCODE
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ── Colours (ANSI — works in Windows Terminal and PS 5.1+ with VT) ────────
$ESC       = [char]27
$RED       = "$ESC[0;31m"
$GREEN     = "$ESC[0;32m"
$YELLOW    = "$ESC[1;33m"
$BLUE      = "$ESC[0;34m"
$CYAN      = "$ESC[0;36m"
$BOLD      = "$ESC[1m"
$DIM       = "$ESC[2m"
$NC        = "$ESC[0m"

function Warn  { param([string]$msg) Write-Host "${YELLOW}  !  $msg${NC}" }
function Err   { param([string]$msg) Write-Host "${RED}  x  $msg${NC}" -ForegroundColor Red }
function Step  { param([string]$msg) Write-Host "${DIM}  *  $msg${NC}" -NoNewline }
function Pass  { param([string]$msg) Write-Host "`r$(' ' * 80)`r${GREEN}  +${NC}  $msg" }

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "${BOLD}${CYAN}"
Write-Host @"
                  -########## +##     ++  +######+.   .#+     -+   ######+     +##     ++  +##-       ##+
                 ++++++++++++++++   +++# +++++++++++ +++++   +++ +++++++++++ .++++   #+++ ++++.     -++++
                    +++++    ++++   -+++ +++++  ++++ +++++++ +++ .++++   +++  ++++   -+++ ++++.      ++++
                    ++++-    ++++   .+++ +++++ -+++  #++++++++++  ++++ #+++#  ++++    +++ ++++.      ++++
                    ++++-    ++++   .+++ ++++#++++#  #++++++++++  ++++  -++++#++++    +++ ++++.      ++++
                    ++++-    ++++   .+++ +++++ +++++ +++# ++++++  ++++    ++++++++    +++ ++++.      ++++
                    +++++    +++++  #+++.+++++ .+++++++++  #++++  ++++   +++# ++++#  #+++ ++++#     .++++
                    ++++#    #++++++++++ ++++#  ++++ #+++    +++  +++++++++   +++++++++++ +++++++++# +++++++++
                    +++.      .++++++++  +++    -+#  ++.      ++ -++++++#      -+++++++-  +++++++++ .++++++++
"@
Write-Host "${NC}"
Write-Host "${BOLD}  MCP Installer (Windows)${NC}"
Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# Prerequisites
# ═════════════════════════════════════════════════════════════════════════════

# Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Err "Git is not installed. Install with: winget install Git.Git  or  https://git-scm.com"
    exit 1
}

# Node.js >= 18
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Err "Node.js is not installed. Install with: winget install OpenJS.NodeJS.LTS  or  https://nodejs.org/"
    exit 1
}

$NodeVersion = (node -v) -replace '^v', '' -split '\.' | Select-Object -First 1
if ([int]$NodeVersion -lt 18) {
    Err "Node.js >= 18 required. Found: $(node -v). Install from https://nodejs.org/"
    exit 1
}

# OpenCode
$OpenCodePaths = @(
    (Join-Path $env:APPDATA "opencode\bin"),
    (Join-Path $env:USERPROFILE ".opencode\bin"),
    (Join-Path $env:USERPROFILE ".local\bin"),
    (Join-Path $env:LOCALAPPDATA "opencode\bin")
)
foreach ($p in $OpenCodePaths) {
    if (Test-Path (Join-Path $p "opencode.exe")) {
        $env:PATH = "$p;$env:PATH"
        break
    }
    if (Test-Path (Join-Path $p "opencode.cmd")) {
        $env:PATH = "$p;$env:PATH"
        break
    }
}

if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
    Step "Installing OpenCode..."
    try {
        npm install -g opencode-ai 2>&1 | Out-Null
    } catch {}

    # Re-check common paths
    foreach ($p in $OpenCodePaths) {
        if ((Test-Path (Join-Path $p "opencode.exe")) -or (Test-Path (Join-Path $p "opencode.cmd"))) {
            $env:PATH = "$p;$env:PATH"
            break
        }
    }

    if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
        Err "OpenCode installation failed. Run manually: npm install -g opencode-ai"
        exit 1
    }
    Pass "OpenCode installed"
}

# ═════════════════════════════════════════════════════════════════════════════
# Authenticate via webapp
# ═════════════════════════════════════════════════════════════════════════════

$AuthPort  = Get-Random -Minimum 49152 -Maximum 65535
$AuthToken = -join ((1..16) | ForEach-Object { "{0:x2}" -f (Get-Random -Minimum 0 -Maximum 256) })
$CredsFile = Join-Path $env:TEMP "turnbull-mcp-creds-$AuthToken.json"

# Start callback server as a background job
$CallbackScript = @"
const http = require('http');
const fs   = require('fs');
const PORT  = $AuthPort;
const TOKEN = '$AuthToken';
const CREDS = '$($CredsFile -replace '\\', '\\\\')';
const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, 'http://localhost:' + PORT);
  if (parsed.pathname === '/callback') {
    const data  = parsed.searchParams.get('data');
    const token = parsed.searchParams.get('token');
    if (token !== TOKEN) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Invalid token');
      return;
    }
    try {
      const json = Buffer.from(data, 'base64').toString('utf-8');
      JSON.parse(json);
      fs.writeFileSync(CREDS, json);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Done!</h1><p>You can close this tab.</p></div></body></html>');
      setTimeout(() => process.exit(0), 500);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid data');
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});
server.listen(PORT);
"@

$CallbackJob = Start-Job -ScriptBlock {
    param($script)
    $nodeExe = (Get-Command node).Source
    & $nodeExe -e $script
} -ArgumentList $CallbackScript

Start-Sleep -Milliseconds 500

$SetupUrl = "https://app.paperplane.ai/setup?token=$AuthToken&port=$AuthPort"
Start-Process $SetupUrl

Write-Host "  ${BOLD}Log in and click Authorize:${NC}"
Write-Host "  ${DIM}$SetupUrl${NC}"
Write-Host ""

$Timeout = 300
$Elapsed = 0
while (-not (Test-Path $CredsFile)) {
    Start-Sleep -Seconds 1
    $Elapsed++
    if ($Elapsed -ge $Timeout) {
        Stop-Job $CallbackJob -ErrorAction SilentlyContinue
        Remove-Job $CallbackJob -Force -ErrorAction SilentlyContinue
        Err "Timed out waiting for authentication"
        exit 1
    }
    $jobState = (Get-Job -Id $CallbackJob.Id).State
    if ($jobState -eq "Completed" -or $jobState -eq "Failed") {
        if (-not (Test-Path $CredsFile)) {
            Err "Callback server exited unexpectedly"
            exit 1
        }
    }
}

Stop-Job $CallbackJob -ErrorAction SilentlyContinue
Remove-Job $CallbackJob -Force -ErrorAction SilentlyContinue
Pass "Authenticated"

# ── Parse credentials ────────────────────────────────────────────────────────
$Creds = Get-Content $CredsFile -Raw | ConvertFrom-Json

$DATABASE_URL       = if ($Creds.DATABASE_URL)       { $Creds.DATABASE_URL }       else { "" }
$TARMS_SSH_HOST     = if ($Creds.TARMS_SSH_HOST)     { $Creds.TARMS_SSH_HOST }     else { "" }
$TARMS_SSH_USERNAME = if ($Creds.TARMS_SSH_USERNAME) { $Creds.TARMS_SSH_USERNAME } else { "" }
$TARMS_DB_USERNAME  = if ($Creds.TARMS_DB_USERNAME)  { $Creds.TARMS_DB_USERNAME }  else { "" }
$TARMS_DB_PASSWORD  = if ($Creds.TARMS_DB_PASSWORD)  { $Creds.TARMS_DB_PASSWORD }  else { "" }
$TARMS_DB_NAME      = if ($Creds.TARMS_DB_NAME)      { $Creds.TARMS_DB_NAME }      else { "" }
$MIS_SSH_HOST       = if ($Creds.MIS_SSH_HOST)       { $Creds.MIS_SSH_HOST }       else { "" }
$MIS_SSH_USERNAME   = if ($Creds.MIS_SSH_USERNAME)   { $Creds.MIS_SSH_USERNAME }   else { "" }
$MIS_DB_USERNAME    = if ($Creds.MIS_DB_USERNAME)    { $Creds.MIS_DB_USERNAME }    else { "" }
$MIS_DB_PASSWORD    = if ($Creds.MIS_DB_PASSWORD)    { $Creds.MIS_DB_PASSWORD }    else { "" }
$MIS_DB_NAME        = if ($Creds.MIS_DB_NAME)        { $Creds.MIS_DB_NAME }        else { "" }
$OPENROUTER_API_KEY = if ($Creds.OPENROUTER_API_KEY) { $Creds.OPENROUTER_API_KEY } else { "" }
$BREVO_API_KEY      = if ($Creds.BREVO_API_KEY)      { $Creds.BREVO_API_KEY }      else { "" }
$BREVO_MCP_API_KEY  = if ($Creds.BREVO_MCP_API_KEY)  { $Creds.BREVO_MCP_API_KEY }  else { "" }

Remove-Item $CredsFile -Force -ErrorAction SilentlyContinue

# ── Validate credentials ─────────────────────────────────────────────────────
$HasWarnings = $false

if (-not $DATABASE_URL) {
    Err "DATABASE_URL not received -- PostgreSQL risk database will not work"
    exit 1
}
if (-not $OPENROUTER_API_KEY) {
    Err "OPENROUTER_API_KEY not received -- LLM will not function"
    exit 1
}

# TARMS (Kerridge ERP)
$TarmsMissing = @()
if (-not $TARMS_SSH_HOST)     { $TarmsMissing += "TARMS_SSH_HOST" }
if (-not $TARMS_SSH_USERNAME) { $TarmsMissing += "TARMS_SSH_USERNAME" }
if (-not $TARMS_DB_USERNAME)  { $TarmsMissing += "TARMS_DB_USERNAME" }
if (-not $TARMS_DB_PASSWORD)  { $TarmsMissing += "TARMS_DB_PASSWORD" }
if ($TarmsMissing.Count -gt 0) {
    Warn "TARMS credentials incomplete -- missing: $($TarmsMissing -join ', ')"
    Warn "  TARMS tools (invoices, payments, debtor days) will be unavailable"
    $HasWarnings = $true
}

# MIS (Management Information System)
$MisMissing = @()
if (-not $MIS_SSH_HOST)     { $MisMissing += "MIS_SSH_HOST" }
if (-not $MIS_SSH_USERNAME) { $MisMissing += "MIS_SSH_USERNAME" }
if (-not $MIS_DB_USERNAME)  { $MisMissing += "MIS_DB_USERNAME" }
if (-not $MIS_DB_PASSWORD)  { $MisMissing += "MIS_DB_PASSWORD" }
if ($MisMissing.Count -gt 0) {
    Warn "MIS credentials incomplete -- missing: $($MisMissing -join ', ')"
    Warn "  MIS tools (sales, products, KBB, contracts, events) will be unavailable"
    $HasWarnings = $true
}

# Brevo CRM
if (-not $BREVO_API_KEY) {
    Warn "BREVO_API_KEY not received -- Brevo email/CRM tools will be unavailable"
    $HasWarnings = $true
}
if (-not $BREVO_MCP_API_KEY) {
    Warn "BREVO_MCP_API_KEY not received -- Brevo MCP contacts/deals/campaigns will be unavailable"
    $HasWarnings = $true
}

# ── SSH key (shared by TARMS and MIS) ────────────────────────────────────────
$SshKeyPath = ""

$DefaultSshKey = Join-Path $env:USERPROFILE ".ssh\turnbull"
if (Test-Path $DefaultSshKey) {
    $SshKeyPath = $DefaultSshKey
    Pass "SSH key found at ~\.ssh\turnbull"
}

if (-not $SshKeyPath) {
    Write-Host ""
    Write-Host "  ${BOLD}SSH Private Key${NC}"
    Write-Host "  ${DIM}An SSH key is required to connect to TARMS and MIS databases.${NC}"
    Write-Host "  ${DIM}You can enter a path to an existing key, or paste the key contents.${NC}"
    Write-Host ""

    $SshInput = Read-Host "  Enter path to SSH private key (or 'paste' to paste contents)"

    if ($SshInput -eq "paste") {
        $SshKeyDir = Join-Path $env:USERPROFILE ".ssh"
        if (-not (Test-Path $SshKeyDir)) { New-Item -ItemType Directory -Path $SshKeyDir -Force | Out-Null }
        $SshKeyPath = Join-Path $SshKeyDir "turnbull"

        Write-Host ""
        Write-Host "  ${DIM}Paste your private key below. Press Enter on an empty line after the key to finish:${NC}"

        $KeyLines = @()
        $FoundEnd = $false
        while ($true) {
            $line = Read-Host
            $KeyLines += $line
            if ($line -match 'END.*PRIVATE KEY') {
                $FoundEnd = $true
            }
            if ($FoundEnd -and $line -eq "") {
                break
            }
        }

        $KeyContents = ($KeyLines | Where-Object { $_ -ne "" }) -join "`n"
        Set-Content -Path $SshKeyPath -Value $KeyContents -NoNewline -Encoding ASCII

        # Set permissions: remove inheritance, grant only current user read access
        icacls $SshKeyPath /inheritance:r /grant:r "${env:USERNAME}:(R)" | Out-Null
        Pass "SSH key saved to $SshKeyPath"
    } elseif ($SshInput) {
        # Expand ~ to home directory
        $SshInput = $SshInput -replace '^~', $env:USERPROFILE
        if (Test-Path $SshInput) {
            $SshKeyPath = $SshInput
            Pass "SSH key found at $SshKeyPath"
        } else {
            Warn "File not found: $SshInput -- TARMS/MIS tunnels will not work"
            $HasWarnings = $true
        }
    } else {
        Warn "No SSH key provided -- TARMS/MIS tunnels will not work"
        $HasWarnings = $true
    }
}

$TARMS_SSH_KEY_PATH = $SshKeyPath
$MIS_SSH_KEY_PATH   = $SshKeyPath

# ── SSH usernames ────────────────────────────────────────────────────────────
$TarmsDefault = if ($TARMS_SSH_USERNAME) { $TARMS_SSH_USERNAME } else { "paperplane" }
$TarmsInput = Read-Host "  TARMS SSH username [$TarmsDefault]"
$TARMS_SSH_USERNAME = if ($TarmsInput) { $TarmsInput } else { $TarmsDefault }

$MisDefault = if ($MIS_SSH_USERNAME) { $MIS_SSH_USERNAME } else { "turnbull" }
$MisInput = Read-Host "  MIS SSH username [$MisDefault]"
$MIS_SSH_USERNAME = if ($MisInput) { $MisInput } else { $MisDefault }

if ($HasWarnings) { Write-Host "" }

# ═════════════════════════════════════════════════════════════════════════════
# Build
# ═════════════════════════════════════════════════════════════════════════════

Step "Installing dependencies..."
Set-Location $ScriptDir
npm install --silent 2>&1 | Out-Null
Pass "Dependencies installed"

Step "Building MCP server..."
npm run build --silent 2>&1 | Out-Null
Pass "MCP server built"

# ═════════════════════════════════════════════════════════════════════════════
# Configure
# ═════════════════════════════════════════════════════════════════════════════

# ── .env ──────────────────────────────────────────────────────────────────────
$EnvFile = Join-Path $ScriptDir ".env"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$EnvContent = @"
# Turnbull MCP — Generated $Timestamp
DATABASE_URL='$DATABASE_URL'
TARMS_SSH_HOST='$TARMS_SSH_HOST'
TARMS_SSH_KEY_PATH='$TARMS_SSH_KEY_PATH'
TARMS_SSH_USERNAME='$TARMS_SSH_USERNAME'
TARMS_DB_USERNAME='$TARMS_DB_USERNAME'
TARMS_DB_PASSWORD='$TARMS_DB_PASSWORD'
TARMS_DB_NAME='$TARMS_DB_NAME'
MIS_SSH_HOST='$MIS_SSH_HOST'
MIS_SSH_KEY_PATH='$MIS_SSH_KEY_PATH'
MIS_SSH_USERNAME='$MIS_SSH_USERNAME'
MIS_DB_USERNAME='$MIS_DB_USERNAME'
MIS_DB_PASSWORD='$MIS_DB_PASSWORD'
MIS_DB_NAME='$MIS_DB_NAME'
OPENROUTER_API_KEY='$OPENROUTER_API_KEY'
BREVO_API_KEY='$BREVO_API_KEY'
BREVO_MCP_API_KEY='$BREVO_MCP_API_KEY'
"@
Set-Content -Path $EnvFile -Value $EnvContent -Encoding UTF8

# ── Helper: escape backslashes for JSON ───────────────────────────────────────
$ScriptDirJson  = $ScriptDir -replace '\\', '\\\\'
$SshKeyPathJson = $TARMS_SSH_KEY_PATH -replace '\\', '\\\\'

# ── OpenCode configs ─────────────────────────────────────────────────────────
$GlobalConfigDir = Join-Path $env:USERPROFILE ".config\opencode"
if (-not (Test-Path $GlobalConfigDir)) { New-Item -ItemType Directory -Path $GlobalConfigDir -Force | Out-Null }

$GlobalConfigDirJson = $GlobalConfigDir -replace '\\', '\\\\'

# Project-level config
$ProjectConfig = @"
{
  "`$schema": "https://opencode.ai/config.json",
  "model": "openrouter/openai/gpt-4.1-mini",
  "share": "disabled",
  "plugin": ["opencode-scheduler@1.2.0", "opencode-agent-memory@0.1.0"],
  "mcp": {
    "turnbull": {
      "type": "local",
      "command": ["node", "$ScriptDirJson\\dist\\index.js"],
      "enabled": true,
      "environment": {
        "DATABASE_URL": "$DATABASE_URL",
        "TARMS_SSH_HOST": "$TARMS_SSH_HOST",
        "TARMS_SSH_KEY_PATH": "$SshKeyPathJson",
        "TARMS_SSH_USERNAME": "$TARMS_SSH_USERNAME",
        "TARMS_DB_USERNAME": "$TARMS_DB_USERNAME",
        "TARMS_DB_PASSWORD": "$TARMS_DB_PASSWORD",
        "TARMS_DB_NAME": "$TARMS_DB_NAME",
        "MIS_SSH_HOST": "$MIS_SSH_HOST",
        "MIS_SSH_KEY_PATH": "$SshKeyPathJson",
        "MIS_SSH_USERNAME": "$MIS_SSH_USERNAME",
        "MIS_DB_USERNAME": "$MIS_DB_USERNAME",
        "MIS_DB_PASSWORD": "$MIS_DB_PASSWORD",
        "MIS_DB_NAME": "$MIS_DB_NAME",
        "OPENROUTER_API_KEY": "$OPENROUTER_API_KEY",
        "BREVO_API_KEY": "$BREVO_API_KEY"
      }
    },
    "brevo_contacts": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_contacts/mcp/$BREVO_MCP_API_KEY"],
      "enabled": true
    },
    "brevo_deals": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_deals/mcp/$BREVO_MCP_API_KEY"],
      "enabled": true
    },
    "brevo_campaigns": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_email_campaign_management/mcp/$BREVO_MCP_API_KEY"],
      "enabled": true
    }
  },
  "agent": {
    "credit-risk-analyst": {
      "description": "Senior credit risk analyst for assessing customer risk and reviewing alerts",
      "mode": "all",
      "prompt": "{file:$ScriptDirJson\\.opencode\\agents\\credit-risk-analyst.md}"
    },
    "sales-account-manager": {
      "description": "Account manager for tracking customer relationships and transaction patterns",
      "mode": "all",
      "prompt": "{file:$ScriptDirJson\\.opencode\\agents\\sales-account-manager.md}"
    },
    "kbb-manager": {
      "description": "Kitchen & Bathroom design sales manager for pipeline, designer performance, and lead analysis",
      "mode": "all",
      "prompt": "{file:$ScriptDirJson\\.opencode\\agents\\kbb-manager.md}"
    },
    "branch-manager": {
      "description": "Branch operations manager for performance tracking, staff management, and customer portfolios",
      "mode": "all",
      "prompt": "{file:$ScriptDirJson\\.opencode\\agents\\branch-manager.md}"
    },
    "pricing-manager": {
      "description": "Contract pricing and margin optimization specialist",
      "mode": "all",
      "prompt": "{file:$ScriptDirJson\\.opencode\\agents\\pricing-manager.md}"
    },
    "marketing-manager": {
      "description": "Events, rewards, and CRM integration manager",
      "mode": "all",
      "prompt": "{file:$ScriptDirJson\\.opencode\\agents\\marketing-manager.md}"
    }
  },
  "instructions": [
    "$ScriptDirJson\\.opencode\\rules\\turnbull-context.md",
    "$ScriptDirJson\\.opencode\\rules\\risk-ratings.md",
    "$ScriptDirJson\\.opencode\\rules\\workflow-patterns.md"
  ],
  "skills": {
    "paths": ["$ScriptDirJson\\.opencode\\skills"]
  }
}
"@
Set-Content -Path (Join-Path $ScriptDir "opencode.json") -Value $ProjectConfig -Encoding UTF8

# Global config (works from any directory)
$GlobalConfig = @"
{
  "`$schema": "https://opencode.ai/config.json",
  "model": "openrouter/openai/gpt-4.1-mini",
  "share": "disabled",
  "plugin": ["opencode-scheduler@1.2.0", "opencode-agent-memory@0.1.0"],
  "mcp": {
    "turnbull": {
      "type": "local",
      "command": ["node", "$ScriptDirJson\\dist\\index.js"],
      "enabled": true,
      "environment": {
        "DATABASE_URL": "$DATABASE_URL",
        "TARMS_SSH_HOST": "$TARMS_SSH_HOST",
        "TARMS_SSH_KEY_PATH": "$SshKeyPathJson",
        "TARMS_SSH_USERNAME": "$TARMS_SSH_USERNAME",
        "TARMS_DB_USERNAME": "$TARMS_DB_USERNAME",
        "TARMS_DB_PASSWORD": "$TARMS_DB_PASSWORD",
        "TARMS_DB_NAME": "$TARMS_DB_NAME",
        "MIS_SSH_HOST": "$MIS_SSH_HOST",
        "MIS_SSH_KEY_PATH": "$SshKeyPathJson",
        "MIS_SSH_USERNAME": "$MIS_SSH_USERNAME",
        "MIS_DB_USERNAME": "$MIS_DB_USERNAME",
        "MIS_DB_PASSWORD": "$MIS_DB_PASSWORD",
        "MIS_DB_NAME": "$MIS_DB_NAME",
        "OPENROUTER_API_KEY": "$OPENROUTER_API_KEY",
        "BREVO_API_KEY": "$BREVO_API_KEY"
      }
    },
    "brevo_contacts": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_contacts/mcp/$BREVO_MCP_API_KEY"],
      "enabled": true
    },
    "brevo_deals": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_deals/mcp/$BREVO_MCP_API_KEY"],
      "enabled": true
    },
    "brevo_campaigns": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_email_campaign_management/mcp/$BREVO_MCP_API_KEY"],
      "enabled": true
    }
  },
  "agent": {
    "credit-risk-analyst": {
      "description": "Senior credit risk analyst for assessing customer risk and reviewing alerts",
      "mode": "all",
      "prompt": "{file:$GlobalConfigDirJson\\.opencode\\agents\\credit-risk-analyst.md}"
    },
    "sales-account-manager": {
      "description": "Account manager for tracking customer relationships and transaction patterns",
      "mode": "all",
      "prompt": "{file:$GlobalConfigDirJson\\.opencode\\agents\\sales-account-manager.md}"
    },
    "kbb-manager": {
      "description": "Kitchen & Bathroom design sales manager for pipeline, designer performance, and lead analysis",
      "mode": "all",
      "prompt": "{file:$GlobalConfigDirJson\\.opencode\\agents\\kbb-manager.md}"
    },
    "branch-manager": {
      "description": "Branch operations manager for performance tracking, staff management, and customer portfolios",
      "mode": "all",
      "prompt": "{file:$GlobalConfigDirJson\\.opencode\\agents\\branch-manager.md}"
    },
    "pricing-manager": {
      "description": "Contract pricing and margin optimization specialist",
      "mode": "all",
      "prompt": "{file:$GlobalConfigDirJson\\.opencode\\agents\\pricing-manager.md}"
    },
    "marketing-manager": {
      "description": "Events, rewards, and CRM integration manager",
      "mode": "all",
      "prompt": "{file:$GlobalConfigDirJson\\.opencode\\agents\\marketing-manager.md}"
    }
  },
  "instructions": [
    "$GlobalConfigDirJson\\.opencode\\rules\\turnbull-context.md",
    "$GlobalConfigDirJson\\.opencode\\rules\\risk-ratings.md",
    "$GlobalConfigDirJson\\.opencode\\rules\\workflow-patterns.md"
  ],
  "skills": {
    "paths": ["$GlobalConfigDirJson\\.opencode\\skills"]
  }
}
"@
Set-Content -Path (Join-Path $GlobalConfigDir "opencode.json") -Value $GlobalConfig -Encoding UTF8

# ── OpenRouter auth ──────────────────────────────────────────────────────────
$AuthDir  = Join-Path $env:LOCALAPPDATA "opencode"
$AuthFile = Join-Path $AuthDir "auth.json"
if (-not (Test-Path $AuthDir)) { New-Item -ItemType Directory -Path $AuthDir -Force | Out-Null }

if (Test-Path $AuthFile) {
    $AuthJson = Get-Content $AuthFile -Raw | ConvertFrom-Json
    $AuthJson | Add-Member -NotePropertyName "openrouter" -NotePropertyValue ([PSCustomObject]@{ type = "api"; key = $OPENROUTER_API_KEY }) -Force
    $AuthJson | ConvertTo-Json -Depth 10 | Set-Content -Path $AuthFile -Encoding UTF8
} else {
    $AuthJson = [PSCustomObject]@{
        openrouter = [PSCustomObject]@{ type = "api"; key = $OPENROUTER_API_KEY }
    }
    $AuthJson | ConvertTo-Json -Depth 10 | Set-Content -Path $AuthFile -Encoding UTF8
}

# ── Copy agents, rules, skills ──────────────────────────────────────────────
$DistDir = Join-Path $ScriptDir "opencode-dist"

foreach ($TargetDir in @((Join-Path $ScriptDir ".opencode"), (Join-Path $GlobalConfigDir ".opencode"))) {
    $AgentsDir = Join-Path $TargetDir "agents"
    $RulesDir  = Join-Path $TargetDir "rules"
    if (-not (Test-Path $AgentsDir)) { New-Item -ItemType Directory -Path $AgentsDir -Force | Out-Null }
    if (-not (Test-Path $RulesDir))  { New-Item -ItemType Directory -Path $RulesDir -Force | Out-Null }

    Copy-Item (Join-Path $DistDir "agents\*.md") -Destination $AgentsDir -Force
    Copy-Item (Join-Path $DistDir "rules\*.md")  -Destination $RulesDir -Force

    $SkillsSrc = Join-Path $DistDir "skills"
    foreach ($SkillDir in (Get-ChildItem -Path $SkillsSrc -Directory)) {
        $SkillName = $SkillDir.Name
        $SkillDest = Join-Path $TargetDir "skills\$SkillName"
        if (-not (Test-Path $SkillDest)) { New-Item -ItemType Directory -Path $SkillDest -Force | Out-Null }
        Copy-Item (Join-Path $SkillDir.FullName "SKILL.md") -Destination $SkillDest -Force
    }
}

Pass "Configured"

# ═════════════════════════════════════════════════════════════════════════════
# Launch
# ═════════════════════════════════════════════════════════════════════════════

# Kill anything on port 3111
try {
    Get-NetTCPConnection -LocalPort 3111 -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
} catch {}

# Load .env into current process environment
Get-Content $EnvFile | ForEach-Object {
    $_ = $_.Trim()
    if ($_ -and -not $_.StartsWith("#")) {
        if ($_ -match "^([^=]+)='(.*)'$") {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
        } elseif ($_ -match "^([^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
        }
    }
}

Write-Host ""
Write-Host "${GREEN}${BOLD}  + Setup complete${NC}"
Write-Host "  ${DIM}Launching OpenCode at${NC} ${BOLD}http://localhost:3111${NC}"
Write-Host ""

opencode web --port 3111
