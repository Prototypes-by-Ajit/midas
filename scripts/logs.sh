#!/usr/bin/env bash
set -euo pipefail

# Follow logs for all services
exec docker-compose logs -f --tail=200