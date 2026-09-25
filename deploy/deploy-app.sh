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
BRANCH="${DEPLOY_BRANCH:-feature/day18}"
REMOTE_DIR="${REMOTE_DIR:-/opt/ai-advent-challenge}"

[[ -n "$TAILNET_HOST" ]] || { echo "Задай TAILNET_HOST в $ENV_FILE"; exit 1; }
[[ -f "$KEY" ]] || { echo "Нет SSH-ключа: $KEY"; exit 1; }
[[ -f .env ]] || { echo "Нет локального .env с секретами"; exit 1; }

SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
rsh() { ssh "${SSH_OPTS[@]}" "root@${TAILNET_HOST}" "$@"; }
rsh_script() { ssh "${SSH_OPTS[@]}" "root@${TAILNET_HOST}" 'bash -s'; }

echo "== 1/6 · /etc/ai-advent.env =="
{
  cat .env
  printf '\n'
  printf 'AGENT_DB_PATH=/var/lib/ai-advent\n'
  printf 'JOBS_DB_PATH=/var/lib/ai-advent/jobs.sqlite\n'
  printf 'AGENT_MCP_DEMO_ENTRY=%s/dist/server/mcp/mcp-demo.mjs\n' "$REMOTE_DIR"
  printf 'AGENT_MCP_JOBS_ENTRY=%s/dist/server/mcp/mcp-jobs.mjs\n' "$REMOTE_DIR"
} | rsh 'umask 077; cat > /etc/ai-advent.env && chmod 600 /etc/ai-advent.env && chown root:root /etc/ai-advent.env && echo "env: $(wc -l < /etc/ai-advent.env) lines"'

echo "== 2/6 · git pull ($BRANCH) =="
rsh_script <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
sudo -u aiadvent -H git fetch --all --prune
sudo -u aiadvent -H git checkout "$BRANCH"
sudo -u aiadvent -H git pull --ff-only origin "$BRANCH"
sudo -u aiadvent -H git log --oneline -1
REMOTE

echo "== 3/6 · npm ci + build =="
rsh_script <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
sudo -u aiadvent -H bash -lc 'npm ci --no-audit --no-fund && npm run build'
sudo -u aiadvent -H mkdir -p "$REMOTE_DIR/node_modules/.vite-temp"
test -f dist/server/mcp/mcp-jobs.mjs
echo "build ok: dist/server/mcp/mcp-jobs.mjs"
REMOTE

echo "== 4/6 · systemd units =="
rsh_script <<REMOTE
set -euo pipefail
install -m 644 "$REMOTE_DIR/deploy/ai-advent.service" /etc/systemd/system/ai-advent.service
install -m 644 "$REMOTE_DIR/deploy/ai-advent-tick.service" /etc/systemd/system/ai-advent-tick.service
install -m 644 "$REMOTE_DIR/deploy/ai-advent-tick.timer" /etc/systemd/system/ai-advent-tick.timer
systemctl daemon-reload
systemctl enable --now ai-advent.service ai-advent-tick.timer
systemctl restart ai-advent.service
REMOTE

echo "== 5/6 · tailscale serve =="
if ! rsh 'timeout 20 tailscale serve --bg 3000'; then
  echo "ВНИМАНИЕ: Serve не включён в tailnet. Открой ссылку из вывода выше,"
  echo "включи Serve и повтори, либо пользуйся SSH-туннелем:"
  echo "  ssh -L 3000:127.0.0.1:3000 root@${TAILNET_HOST}"
fi

echo "== 6/6 · health =="
sleep 4
rsh_script <<'REMOTE'
set -euo pipefail
systemctl is-active ai-advent.service
curl -fsS --max-time 30 http://127.0.0.1:3000/jobs/tick
echo
REMOTE

echo "Готово: приложение слушает 127.0.0.1:3000, тик — systemd timer."
