#!/usr/bin/env bash
#
# Идемпотентный деплой приложения на VPS (Tailscale-only).
# Требует уже настроенный сервер (deploy/vps-setup-wizard.sh) и запушенную ветку.
# Секреты берутся из локального .env и попадают в /etc/ai-advent.env (0600);
# значения на экран не выводятся.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="deploy/.env.deploy"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

TAILNET_HOST="${TAILNET_HOST:-}"
KEY="${SSH_KEY:-$HOME/.ssh/ai_advent_ed25519}"
BRANCH="${DEPLOY_BRANCH:-feature/day33}"
REMOTE_DIR="${REMOTE_DIR:-/opt/ai-advent-challenge}"
LOCAL_SUPPORT_DB="${LOCAL_SUPPORT_DB:-$HOME/.ai-advent-challenge/support.sqlite}"

[[ -n "$TAILNET_HOST" ]] || { echo "Задай TAILNET_HOST в $ENV_FILE"; exit 1; }
[[ -f "$KEY" ]] || { echo "Нет SSH-ключа: $KEY"; exit 1; }
[[ -f .env ]] || { echo "Нет локального .env с секретами"; exit 1; }
[[ -f "$LOCAL_SUPPORT_DB" ]] || {
  echo "Нет индекса поддержки: $LOCAL_SUPPORT_DB"
  echo "Сначала: npm run fetch:ozon-corpus && npm run support:index"
  exit 1
}

SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
rsh() { ssh "${SSH_OPTS[@]}" "root@${TAILNET_HOST}" "$@"; }
rsh_script() { ssh "${SSH_OPTS[@]}" "root@${TAILNET_HOST}" 'bash -s'; }
scp_to() { scp "${SSH_OPTS[@]}" "$1" "root@${TAILNET_HOST}:$2" >/dev/null; }

echo "== 1/7 · /etc/ai-advent.env =="
{
  cat .env
  printf '\n'
  printf 'AGENT_DB_PATH=/var/lib/ai-advent\n'
  printf 'JOBS_DB_PATH=/var/lib/ai-advent/jobs.sqlite\n'
  printf 'SUPPORT_DB_PATH=/var/lib/ai-advent/support.sqlite\n'
  printf 'RAG_EMBED_DTYPE=q8\n'
  printf 'RAG_EMBED_CACHE_DIR=/var/lib/ai-advent/hf-cache\n'
  printf 'RAG_RERANK_CACHE_DIR=/var/lib/ai-advent/hf-cache\n'
  printf 'AGENT_MCP_DEMO_ENTRY=%s/dist/server/mcp/mcp-demo.mjs\n' "$REMOTE_DIR"
  printf 'AGENT_MCP_JOBS_ENTRY=%s/dist/server/mcp/mcp-jobs.mjs\n' "$REMOTE_DIR"
  printf 'SUPPORT_MCP_OZON_ENTRY=%s/dist/server/mcp/mcp-support-ozon.mjs\n' "$REMOTE_DIR"
} | rsh 'umask 077; cat > /etc/ai-advent.env && chmod 600 /etc/ai-advent.env && chown root:root /etc/ai-advent.env && echo "env: $(wc -l < /etc/ai-advent.env) lines"'

echo "== 2/7 · git pull ($BRANCH) =="
rsh_script <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
sudo -u aiadvent -H git fetch --all --prune
sudo -u aiadvent -H git checkout "$BRANCH"
sudo -u aiadvent -H git pull --ff-only origin "$BRANCH"
sudo -u aiadvent -H git log --oneline -1
REMOTE

echo "== 3/7 · npm ci + build =="
rsh_script <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
sudo -u aiadvent -H bash -lc 'npm ci --no-audit --no-fund && npm run build'
sudo -u aiadvent -H mkdir -p "$REMOTE_DIR/node_modules/.vite-temp"
test -f dist/server/mcp/mcp-jobs.mjs
test -f dist/server/mcp/mcp-research.mjs
test -f dist/server/mcp/mcp-market.mjs
test -f dist/server/mcp/mcp-support-ozon.mjs
echo "build ok: dist/server/mcp/mcp-{jobs,research,market,support-ozon}.mjs"
REMOTE

echo "== 4/7 · support.sqlite =="
SCP_DB="/tmp/support-seed-$$.sqlite"
scp_to "$LOCAL_SUPPORT_DB" "$SCP_DB"
rsh_script <<REMOTE
set -euo pipefail
systemctl stop ai-advent-support.service 2>/dev/null || true
if [[ -f /var/lib/ai-advent/support.sqlite ]]; then
  cp -p /var/lib/ai-advent/support.sqlite "/var/lib/ai-advent/support.sqlite.pre-deploy-\$(date +%Y%m%d-%H%M%S)"
fi
install -m 600 -o aiadvent -g aiadvent "$SCP_DB" /var/lib/ai-advent/support.sqlite
rm -f "$SCP_DB"
echo "support.sqlite установлена"
REMOTE

echo "== 5/7 · systemd units =="
rsh_script <<REMOTE
set -euo pipefail
install -m 644 "$REMOTE_DIR/deploy/ai-advent.service" /etc/systemd/system/ai-advent.service
install -m 644 "$REMOTE_DIR/deploy/ai-advent-support.service" /etc/systemd/system/ai-advent-support.service
install -d -m 700 -o aiadvent -g aiadvent /var/lib/ai-advent/hf-cache
install -m 644 "$REMOTE_DIR/deploy/ai-advent-tick.service" /etc/systemd/system/ai-advent-tick.service
install -m 644 "$REMOTE_DIR/deploy/ai-advent-tick.timer" /etc/systemd/system/ai-advent-tick.timer
systemctl daemon-reload
systemctl enable --now ai-advent.service ai-advent-support.service ai-advent-tick.timer
systemctl restart ai-advent.service
systemctl start ai-advent-support.service
REMOTE

echo "== 6/7 · tailscale serve и funnel =="
if ! rsh 'timeout 20 tailscale serve --bg --yes --https=8443 3000'; then
  echo "ВНИМАНИЕ: Serve не включён в tailnet. Открой ссылку из вывода выше,"
  echo "включи Serve и повтори, либо пользуйся SSH-туннелем:"
  echo "  ssh -L 3000:127.0.0.1:3000 root@${TAILNET_HOST}"
fi
if ! rsh 'timeout 20 tailscale funnel --bg --yes --https=443 3001'; then
  echo "ВНИМАНИЕ: Funnel не включён. Публичная ссылка /support не поднята."
fi
rsh 'tailscale serve status'
rsh 'tailscale funnel status'

echo "== 7/7 · health =="
sleep 5
rsh_script <<'REMOTE'
set -euo pipefail
systemctl is-active ai-advent.service
systemctl is-active ai-advent-support.service
curl -fsS --max-time 30 http://127.0.0.1:3000/jobs/tick
echo
curl -fsS --max-time 60 http://127.0.0.1:3001/api/support/health
echo
REMOTE

echo "Готово: приложение на 127.0.0.1:3000 (serve 8443), /support на 127.0.0.1:3001 (funnel 443)."
