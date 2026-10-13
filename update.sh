#!/usr/bin/env bash
# Rebuilds the Docker images and restarts the services with the current source.
#
#   ./update.sh                  rebuild and restart backend + frontend
#   ./update.sh backend          rebuild and restart only the named service(s)
#   ./update.sh --no-cache       rebuild from scratch, ignoring the layer cache
#
# The database container and its data volume are left untouched; the backend
# applies any pending schema changes by itself when it starts.

set -euo pipefail

cd "$(dirname "$0")"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Không tìm thấy Docker Compose. Hãy cài Docker Desktop trước." >&2
  exit 1
fi

BUILD_ARGS=()
SERVICES=()
for arg in "$@"; do
  case "$arg" in
    --no-cache) BUILD_ARGS+=(--no-cache) ;;
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "Tham số không hợp lệ: $arg" >&2
      exit 1
      ;;
    *) SERVICES+=("$arg") ;;
  esac
done

if [ ${#SERVICES[@]} -eq 0 ]; then
  SERVICES=(backend frontend)
fi

echo "==> Build image: ${SERVICES[*]}"
"${COMPOSE[@]}" build "${BUILD_ARGS[@]}" "${SERVICES[@]}"

echo "==> Khởi động lại service"
"${COMPOSE[@]}" up -d "${SERVICES[@]}"

# Read the published ports the same way docker-compose.yml does
if [ -f .env ]; then
  BACKEND_PORT=$(grep -E '^BACKEND_PORT_BIND=' .env | tail -n 1 | cut -d= -f2 | tr -d '\r' || true)
  FRONTEND_PORT=$(grep -E '^FRONTEND_PORT_BIND=' .env | tail -n 1 | cut -d= -f2 | tr -d '\r' || true)
fi
BACKEND_PORT=${BACKEND_PORT:-5088}
FRONTEND_PORT=${FRONTEND_PORT:-3088}

echo "==> Chờ backend sẵn sàng"
ready=false
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done

echo
"${COMPOSE[@]}" ps

echo
if [ "$ready" = true ]; then
  echo "Xong. Frontend: http://localhost:${FRONTEND_PORT}  |  API: http://localhost:${BACKEND_PORT}/api"
else
  echo "Backend chưa phản hồi sau 60 giây. Xem log bằng: ${COMPOSE[*]} logs --tail 50 backend" >&2
  exit 1
fi
