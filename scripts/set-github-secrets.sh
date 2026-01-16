#!/usr/bin/env bash
# Set GitHub repository secrets with `gh` CLI.
# Requires: gh CLI installed and logged in (gh auth login)

set -euo pipefail

echo "Verifying gh CLI is installed..."
if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install from https://cli.github.com/" >&2
  exit 1
fi

# Use env vars if present
VERCEL_TOKEN=${VERCEL_TOKEN:-""}
VERCEL_ORG_ID=${VERCEL_ORG_ID:-""}
VERCEL_PROJECT_ID=${VERCEL_PROJECT_ID:-""}

if [ -z "$VERCEL_TOKEN" ]; then
  printf "Enter VERCEL_TOKEN (secret will not be echoed): "
  # Prefer read -s if bash supports it, otherwise fallback to stty
  if read -s TEST >/dev/null 2>&1; then
    # read -s available and does not echo
    read -r -s VERCEL_TOKEN
    printf "\n"
  elif command -v stty >/dev/null 2>&1; then
    stty -echo
    read -r VERCEL_TOKEN
    stty echo
    printf "\n"
  else
    # No echo disabling available; fall back to visible prompt
    read -r VERCEL_TOKEN
  fi
fi

if [ -z "$VERCEL_ORG_ID" ]; then
  read -p "Enter VERCEL_ORG_ID: " VERCEL_ORG_ID
fi

if [ -z "$VERCEL_PROJECT_ID" ]; then
  read -p "Enter VERCEL_PROJECT_ID: " VERCEL_PROJECT_ID
fi

if [ -n "$VERCEL_TOKEN" ]; then
  echo "$VERCEL_TOKEN" | gh secret set VERCEL_TOKEN --body -
fi

if [ -n "$VERCEL_ORG_ID" ]; then
  echo "$VERCEL_ORG_ID" | gh secret set VERCEL_ORG_ID --body -
fi

if [ -n "$VERCEL_PROJECT_ID" ]; then
  echo "$VERCEL_PROJECT_ID" | gh secret set VERCEL_PROJECT_ID --body -
fi

echo "Done: Repo secrets updated. Push or trigger GitHub Action to deploy (if configured)."