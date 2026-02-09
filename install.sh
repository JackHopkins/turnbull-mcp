#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Turnbull MCP — Installer
# Sets up the Turnbull credit-risk MCP server + OpenCode web interface
# ─────────────────────────────────────────────────────────────────────────────

# If we're not already in the turnbull-mcp repo, clone it
if [[ ! -f "package.json" ]] || ! grep -q '"turnbull-mcp"' package.json 2>/dev/null; then
  INSTALL_DIR="$HOME/turnbull-mcp"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    git -C "$INSTALL_DIR" pull --quiet
  else
    git clone https://github.com/JackHopkins/turnbull-mcp.git "$INSTALL_DIR"
  fi
  cd "$INSTALL_DIR"
  exec "$INSTALL_DIR/install.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

warn()  { printf "${YELLOW}  ⚠  %s${NC}\n" "$*"; }
err()   { printf "${RED}  ✗  %s${NC}\n" "$*" >&2; }
step()  { printf "${DIM}  •  %s${NC}" "$*"; }
pass()  { printf "\r\033[2K${GREEN}  ✓${NC}  %s\n" "$*"; }

# ── Banner ───────────────────────────────────────────────────────────────────
printf "\n${BOLD}${CYAN}"
cat << 'BANNER'
                  -########## +##     ++  +######+.   .#+     -+   ######+     +##     ++  +##-       ##+
                 ++++++++++++++++   +++# +++++++++++ +++++   +++ +++++++++++ .++++   #+++ ++++.     -++++
                    +++++    ++++   -+++ +++++  ++++ +++++++ +++ .++++   +++  ++++   -+++ ++++.      ++++
                    ++++-    ++++   .+++ +++++ -+++  #++++++++++  ++++ #+++#  ++++    +++ ++++.      ++++
                    ++++-    ++++   .+++ ++++#++++#  #++++++++++  ++++  -++++#++++    +++ ++++.      ++++
                    ++++-    ++++   .+++ +++++ +++++ +++# ++++++  ++++    ++++++++    +++ ++++.      ++++
                    +++++    +++++  #+++.+++++ .+++++++++  #++++  ++++   +++# ++++#  #+++ ++++#     .++++
                    ++++#    #++++++++++ ++++#  ++++ #+++    +++  +++++++++   +++++++++++ +++++++++# +++++++++
                    +++.      .++++++++  +++    -+#  ++.      ++ -++++++#      -+++++++-  +++++++++ .++++++++
BANNER
printf "${NC}\n${BOLD}  MCP Installer${NC}\n\n"

# ═════════════════════════════════════════════════════════════════════════════
# Prerequisites
# ═════════════════════════════════════════════════════════════════════════════

if [[ "$(uname)" != "Darwin" ]]; then
  err "macOS required. Detected: $(uname)"
  exit 1
fi

if ! command -v node &>/dev/null; then
  err "Node.js is not installed. Run: brew install node"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
  err "Node.js >= 18 required. Found: $(node -v). Run: brew upgrade node"
  exit 1
fi

export PATH="$HOME/.opencode/bin:$HOME/.local/bin:$PATH"

if ! command -v opencode &>/dev/null; then
  step "Installing OpenCode..."
  curl -fsSL https://opencode.ai/install | bash &>/dev/null

  for p in "$HOME/.opencode/bin" "$HOME/.local/bin" "/usr/local/bin"; do
    if [[ -x "$p/opencode" ]]; then
      export PATH="$p:$PATH"
      break
    fi
  done

  if ! command -v opencode &>/dev/null; then
    err "OpenCode installation failed. Run manually: curl -fsSL https://opencode.ai/install | bash"
    exit 1
  fi
  pass "OpenCode installed"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Authenticate via webapp
# ═════════════════════════════════════════════════════════════════════════════

AUTH_PORT=$(jot -r 1 49152 65535)
AUTH_TOKEN=$(openssl rand -hex 16)
CREDS_FILE="/tmp/turnbull-mcp-creds-${AUTH_TOKEN}.json"

node -e "
const http = require('http');
const fs   = require('fs');
const PORT  = ${AUTH_PORT};
const TOKEN = '${AUTH_TOKEN}';
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
      fs.writeFileSync('/tmp/turnbull-mcp-creds-' + TOKEN + '.json', json);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body style=\"font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0\"><div style=\"text-align:center\"><h1>Done!</h1><p>You can close this tab.</p></div></body></html>');
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
" &
CALLBACK_PID=$!
sleep 0.5

SETUP_URL="https://app.paperplane.ai/setup?token=${AUTH_TOKEN}&port=${AUTH_PORT}"
open "$SETUP_URL" 2>/dev/null || true

printf "  ${BOLD}Log in and click Authorize:${NC}\n"
printf "  ${DIM}%s${NC}\n\n" "$SETUP_URL"

TIMEOUT=300
ELAPSED=0
while [[ ! -f "$CREDS_FILE" ]]; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    kill "$CALLBACK_PID" 2>/dev/null || true
    err "Timed out waiting for authentication"
    exit 1
  fi
  if ! kill -0 "$CALLBACK_PID" 2>/dev/null && [[ ! -f "$CREDS_FILE" ]]; then
    err "Callback server exited unexpectedly"
    exit 1
  fi
done

kill "$CALLBACK_PID" 2>/dev/null || true
wait "$CALLBACK_PID" 2>/dev/null || true
pass "Authenticated"

# ── Parse credentials ────────────────────────────────────────────────────────
read_cred() { node -e "const c=JSON.parse(require('fs').readFileSync('$CREDS_FILE','utf-8'));console.log(c['$1']||'')"; }

DATABASE_URL=$(read_cred DATABASE_URL)
TARMS_SSH_HOST=$(read_cred TARMS_SSH_HOST)
TARMS_SSH_USERNAME=$(read_cred TARMS_SSH_USERNAME)
TARMS_DB_USERNAME=$(read_cred TARMS_DB_USERNAME)
TARMS_DB_PASSWORD=$(read_cred TARMS_DB_PASSWORD)
TARMS_DB_NAME=$(read_cred TARMS_DB_NAME)
OPENROUTER_API_KEY=$(read_cred OPENROUTER_API_KEY)
BREVO_API_KEY=$(read_cred BREVO_API_KEY)
BREVO_MCP_API_KEY=$(read_cred BREVO_MCP_API_KEY)

rm -f "$CREDS_FILE"

if [[ -z "$OPENROUTER_API_KEY" ]]; then
  err "No OPENROUTER_API_KEY received. Ensure it is configured on the server."
  exit 1
fi

# ── SSH key (local path) ─────────────────────────────────────────────────────
TARMS_SSH_KEY_PATH=""
if [[ -f "$HOME/.ssh/turnbull" ]]; then
  TARMS_SSH_KEY_PATH="$HOME/.ssh/turnbull"
fi

if [[ -z "$TARMS_SSH_KEY_PATH" ]]; then
  warn "No SSH key found at ~/.ssh/turnbull — TARMS tunnel will not work"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Build
# ═════════════════════════════════════════════════════════════════════════════

step "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install --silent 2>&1
pass "Dependencies installed"

step "Building MCP server..."
npm run build --silent 2>&1
pass "MCP server built"

# ═════════════════════════════════════════════════════════════════════════════
# Configure
# ═════════════════════════════════════════════════════════════════════════════

ENV_FILE="$SCRIPT_DIR/.env"
{
  echo "# Turnbull MCP — Generated $(date '+%Y-%m-%d %H:%M:%S')"
  echo "DATABASE_URL=\"${DATABASE_URL}\""
  echo "TARMS_SSH_HOST=\"${TARMS_SSH_HOST}\""
  echo "TARMS_SSH_KEY_PATH=\"${TARMS_SSH_KEY_PATH}\""
  echo "TARMS_SSH_USERNAME=\"${TARMS_SSH_USERNAME}\""
  echo "TARMS_DB_USERNAME=\"${TARMS_DB_USERNAME}\""
  echo "TARMS_DB_PASSWORD=\"${TARMS_DB_PASSWORD}\""
  echo "TARMS_DB_NAME=\"${TARMS_DB_NAME}\""
  echo "OPENROUTER_API_KEY=\"${OPENROUTER_API_KEY}\""
  echo "BREVO_API_KEY=\"${BREVO_API_KEY}\""
  echo "BREVO_MCP_API_KEY=\"${BREVO_MCP_API_KEY}\""
} > "$ENV_FILE"

# ── OpenCode configs ─────────────────────────────────────────────────────────
GLOBAL_CONFIG_DIR="$HOME/.config/opencode"
mkdir -p "$GLOBAL_CONFIG_DIR"

# Project-level config
cat > "$SCRIPT_DIR/opencode.json" << OCEOF
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "openrouter/openai/gpt-4.1-mini",
  "share": "disabled",
  "mcp": {
    "turnbull": {
      "type": "local",
      "command": ["node", "$SCRIPT_DIR/dist/index.js"],
      "enabled": true,
      "environment": {
        "DATABASE_URL": "${DATABASE_URL}",
        "TARMS_SSH_HOST": "${TARMS_SSH_HOST}",
        "TARMS_SSH_KEY_PATH": "${TARMS_SSH_KEY_PATH}",
        "TARMS_SSH_USERNAME": "${TARMS_SSH_USERNAME}",
        "TARMS_DB_USERNAME": "${TARMS_DB_USERNAME}",
        "TARMS_DB_PASSWORD": "${TARMS_DB_PASSWORD}",
        "TARMS_DB_NAME": "${TARMS_DB_NAME}",
        "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}",
        "BREVO_API_KEY": "${BREVO_API_KEY}"
      }
    },
    "brevo_contacts": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_contacts/mcp/${BREVO_MCP_API_KEY}"],
      "enabled": true
    },
    "brevo_deals": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_deals/mcp/${BREVO_MCP_API_KEY}"],
      "enabled": true
    },
    "brevo_campaigns": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_email_campaign_management/mcp/${BREVO_MCP_API_KEY}"],
      "enabled": true
    }
  },
  "agent": {
    "credit-risk-analyst": {
      "description": "Senior credit risk analyst for assessing customer risk and reviewing alerts",
      "mode": "all",
      "prompt": "{file:$SCRIPT_DIR/.opencode/agents/credit-risk-analyst.md}"
    },
    "sales-account-manager": {
      "description": "Account manager for tracking customer relationships and transaction patterns",
      "mode": "all",
      "prompt": "{file:$SCRIPT_DIR/.opencode/agents/sales-account-manager.md}"
    }
  },
  "instructions": [
    "$SCRIPT_DIR/.opencode/rules/turnbull-context.md",
    "$SCRIPT_DIR/.opencode/rules/risk-ratings.md",
    "$SCRIPT_DIR/.opencode/rules/workflow-patterns.md"
  ],
  "skills": {
    "paths": ["$SCRIPT_DIR/.opencode/skills"]
  }
}
OCEOF

# Global config (works from any directory)
cat > "$GLOBAL_CONFIG_DIR/opencode.json" << GCEOF
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "openrouter/openai/gpt-4.1-mini",
  "share": "disabled",
  "mcp": {
    "turnbull": {
      "type": "local",
      "command": ["node", "$SCRIPT_DIR/dist/index.js"],
      "enabled": true,
      "environment": {
        "DATABASE_URL": "${DATABASE_URL}",
        "TARMS_SSH_HOST": "${TARMS_SSH_HOST}",
        "TARMS_SSH_KEY_PATH": "${TARMS_SSH_KEY_PATH}",
        "TARMS_SSH_USERNAME": "${TARMS_SSH_USERNAME}",
        "TARMS_DB_USERNAME": "${TARMS_DB_USERNAME}",
        "TARMS_DB_PASSWORD": "${TARMS_DB_PASSWORD}",
        "TARMS_DB_NAME": "${TARMS_DB_NAME}",
        "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}",
        "BREVO_API_KEY": "${BREVO_API_KEY}"
      }
    },
    "brevo_contacts": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_contacts/mcp/${BREVO_MCP_API_KEY}"],
      "enabled": true
    },
    "brevo_deals": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_deals/mcp/${BREVO_MCP_API_KEY}"],
      "enabled": true
    },
    "brevo_campaigns": {
      "type": "local",
      "command": ["npx", "-y", "mcp-remote", "https://mcp.brevo.com/v1/brevo_email_campaign_management/mcp/${BREVO_MCP_API_KEY}"],
      "enabled": true
    }
  },
  "agent": {
    "credit-risk-analyst": {
      "description": "Senior credit risk analyst for assessing customer risk and reviewing alerts",
      "mode": "all",
      "prompt": "{file:$GLOBAL_CONFIG_DIR/.opencode/agents/credit-risk-analyst.md}"
    },
    "sales-account-manager": {
      "description": "Account manager for tracking customer relationships and transaction patterns",
      "mode": "all",
      "prompt": "{file:$GLOBAL_CONFIG_DIR/.opencode/agents/sales-account-manager.md}"
    }
  },
  "instructions": [
    "$GLOBAL_CONFIG_DIR/.opencode/rules/turnbull-context.md",
    "$GLOBAL_CONFIG_DIR/.opencode/rules/risk-ratings.md",
    "$GLOBAL_CONFIG_DIR/.opencode/rules/workflow-patterns.md"
  ],
  "skills": {
    "paths": ["$GLOBAL_CONFIG_DIR/.opencode/skills"]
  }
}
GCEOF

# ── OpenRouter auth ──────────────────────────────────────────────────────────
AUTH_DIR="$HOME/.local/share/opencode"
AUTH_FILE="$AUTH_DIR/auth.json"
mkdir -p "$AUTH_DIR"

if [[ -f "$AUTH_FILE" ]]; then
  OPENROUTER_API_KEY="$OPENROUTER_API_KEY" node -e "
    const fs = require('fs');
    const auth = JSON.parse(fs.readFileSync('$AUTH_FILE', 'utf8'));
    auth.openrouter = { type: 'api', key: process.env.OPENROUTER_API_KEY };
    fs.writeFileSync('$AUTH_FILE', JSON.stringify(auth, null, 2) + '\n');
  "
else
  OPENROUTER_API_KEY="$OPENROUTER_API_KEY" node -e "
    const fs = require('fs');
    const auth = { openrouter: { type: 'api', key: process.env.OPENROUTER_API_KEY } };
    fs.writeFileSync('$AUTH_FILE', JSON.stringify(auth, null, 2) + '\n');
  "
fi

# ── Copy agents, rules, skills ──────────────────────────────────────────────
DIST_DIR="$SCRIPT_DIR/opencode-dist"

for TARGET_DIR in "$SCRIPT_DIR/.opencode" "$GLOBAL_CONFIG_DIR/.opencode"; do
  mkdir -p "$TARGET_DIR/agents" "$TARGET_DIR/rules"
  cp "$DIST_DIR/agents/"*.md "$TARGET_DIR/agents/"
  cp "$DIST_DIR/rules/"*.md "$TARGET_DIR/rules/"

  for skill_dir in "$DIST_DIR/skills"/*/; do
    skill_name=$(basename "$skill_dir")
    mkdir -p "$TARGET_DIR/skills/$skill_name"
    cp "$skill_dir"SKILL.md "$TARGET_DIR/skills/$skill_name/SKILL.md"
  done
done

pass "Configured"

# ═════════════════════════════════════════════════════════════════════════════
# Launch
# ═════════════════════════════════════════════════════════════════════════════

if lsof -ti:3111 &>/dev/null; then
  kill $(lsof -ti:3111) 2>/dev/null
  sleep 1
fi

set -a
source "$ENV_FILE"
set +a

printf "\n${GREEN}${BOLD}  ✓ Setup complete${NC}\n"
printf "  ${DIM}Launching OpenCode at${NC} ${BOLD}http://localhost:3111${NC}\n\n"

exec opencode web --port 3111