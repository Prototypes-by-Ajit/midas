#!/usr/bin/env bash
set -euo pipefail

# Bring up the full local stack
exec docker-compose up -d --build