#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="grafana-recap-web"
TAG="${1:-latest}"
OUTPUT_DIR="./docker-output"

echo "==> Building image: ${IMAGE_NAME}:${TAG}"
docker build -t "${IMAGE_NAME}:${TAG}" .

mkdir -p "${OUTPUT_DIR}"

FILENAME="${IMAGE_NAME}-${TAG}.tar"
echo "==> Exporting to ${OUTPUT_DIR}/${FILENAME}"
docker save "${IMAGE_NAME}:${TAG}" -o "${OUTPUT_DIR}/${FILENAME}"

SIZE=$(du -h "${OUTPUT_DIR}/${FILENAME}" | cut -f1)
echo "==> Done. Image exported: ${OUTPUT_DIR}/${FILENAME} (${SIZE})"
echo ""
echo "To load on another machine:"
echo "  docker load -i ${FILENAME}"
echo ""
echo "To run:"
echo "  cp .env.example .env  # edit with real values"
echo "  docker compose up -d"
