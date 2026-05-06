#!/usr/bin/env bash
set -euo pipefail

CLAUDE_DIR="/workspaces/dnd-planner/.claude"
STAGING="${CLAUDE_HOST_CONFIG_STAGING:-/mnt/claude-host-config}"

mkdir -p "${CLAUDE_DIR}"
ln -sf "${CLAUDE_DIR}" /home/vscode/.claude

# Copy settings from host staging on first run only (do not overwrite)
if [[ -f "${STAGING}/settings.json" && ! -f "${CLAUDE_DIR}/settings.json" ]]; then
  cp "${STAGING}/settings.json" "${CLAUDE_DIR}/settings.json"
fi

if [[ -f "${STAGING}/settings.local.json" && ! -f "${CLAUDE_DIR}/settings.local.json" ]]; then
  cp "${STAGING}/settings.local.json" "${CLAUDE_DIR}/settings.local.json"
fi

if [[ -f "${STAGING}/credentials.json" && ! -f "${CLAUDE_DIR}/credentials.json" ]]; then
  cp "${STAGING}/credentials.json" "${CLAUDE_DIR}/credentials.json"
fi

if [[ -f "${STAGING}/keybindings.json" && ! -f "${CLAUDE_DIR}/keybindings.json" ]]; then
  cp "${STAGING}/keybindings.json" "${CLAUDE_DIR}/keybindings.json"
fi

# Ensure subdirectories exist
mkdir -p "${CLAUDE_DIR}/projects"
mkdir -p "${CLAUDE_DIR}/session-env"

# Build gitconfig from host (first run only)
HOST_GITCONFIG="${HOST_GITCONFIG:-/mnt/host-gitconfig}"
if [[ -f "${HOST_GITCONFIG}" && ! -f /home/vscode/.gitconfig ]]; then
  cp "${HOST_GITCONFIG}" /home/vscode/.gitconfig
fi

# Override SSH signing program for the container (host uses 1Password, unavailable here)
if [[ -f /home/vscode/.gitconfig ]]; then
  git config --file /home/vscode/.gitconfig gpg.ssh.program /usr/bin/ssh-keygen
fi

jq '.tools.shell.allow = ["*"] | .tools.shell.enabled = true' /workspaces/dnd-planner/.claude/settings.json > /tmp/$$.json && mv /tmp/$$.json /workspaces/dnd-planner/.claude/settings.json
