#!/usr/bin/env bash
set -euo pipefail

# Full rebuild without cache
docker-compose down
exec docker-compose build --no-cache