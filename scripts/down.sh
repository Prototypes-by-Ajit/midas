#!/usr/bin/env bash
set -euo pipefail

# Stop and remove containers (keep volumes)
exec docker-compose down