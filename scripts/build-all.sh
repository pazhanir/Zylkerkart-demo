#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ZylkerKart — Build All Docker Images
# Usage:  ./build-all.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TAG="${IMAGE_TAG:-latest}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUSH_TO_HUB=false
REGISTRY="zylkerkart"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          ZylkerKart — Building All Docker Images            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Ask: local build only or build + push to Docker Hub ──
echo "How would you like to build?"
echo "  1) Build locally only"
echo "  2) Build and push to Docker Hub"
read -rp "Enter choice [1/2]: " BUILD_CHOICE
echo ""

if [ "$BUILD_CHOICE" = "2" ]; then
    PUSH_TO_HUB=true

    # Ask for Docker Hub registry ID (username/org)
    read -rp "🐳 Enter your Docker Hub Registry ID (username/org): " REGISTRY
    if [ -z "$REGISTRY" ]; then
        echo "❌ Docker Hub Registry ID cannot be empty. Aborting."
        exit 1
    fi
    echo ""

    # Docker login
    echo "▶ Logging in to Docker Hub..."
    if ! docker login; then
        echo "❌ Docker login failed. Aborting."
        exit 1
    fi
    echo "  ✅ Docker login successful"
    echo ""
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Registry : ${REGISTRY}"
echo "║  Tag      : ${TAG}"
echo "║  Push     : ${PUSH_TO_HUB}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SERVICES=(
    "db:db"
    "product-service:services/product-service"
    "order-service:services/order-service"
    "search-service:services/search-service"
    "payment-service:services/payment-service"
    "auth-service:services/auth-service"
    "storefront:services/storefront"
    "chaos-dashboard:services/chaos-dashboard"
)

FAILED=()

for entry in "${SERVICES[@]}"; do
    IFS=':' read -r name path <<< "$entry"
    image="${REGISTRY}/${name}:${TAG}"
    echo "────────────────────────────────────────────────────────────────"
    echo "▶ Building ${image} (from ${path})"
    echo "────────────────────────────────────────────────────────────────"

    if docker build -t "${image}" "${ROOT_DIR}/${path}"; then
        echo "✅ ${image} built successfully"
    else
        echo "❌ ${image} FAILED"
        FAILED+=("${name}")
    fi
    echo ""
done

echo "════════════════════════════════════════════════════════════════"
if [ ${#FAILED[@]} -eq 0 ]; then
    echo "✅ All ${#SERVICES[@]} images built successfully!"
else
    echo "❌ ${#FAILED[@]} image(s) failed: ${FAILED[*]}"
    exit 1
fi
echo ""

# ── Push to Docker Hub if requested ──
if [ "$PUSH_TO_HUB" = true ]; then
    echo ""
    echo "▶ Pushing images to Docker Hub (${REGISTRY})..."
    PUSH_FAILED=()
    for entry in "${SERVICES[@]}"; do
        IFS=':' read -r name path <<< "$entry"
        image="${REGISTRY}/${name}:${TAG}"
        echo "  ▶ Pushing ${image}..."
        if docker push "${image}"; then
            echo "  ✅ ${image} pushed"
        else
            echo "  ❌ ${image} push FAILED"
            PUSH_FAILED+=("${name}")
        fi
    done
    echo ""
    if [ ${#PUSH_FAILED[@]} -eq 0 ]; then
        echo "✅ All images pushed to Docker Hub successfully!"
    else
        echo "❌ ${#PUSH_FAILED[@]} image(s) failed to push: ${PUSH_FAILED[*]}"
        exit 1
    fi
fi

echo ""
echo "Images:"
docker images --filter "reference=${REGISTRY}/*:${TAG}" --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}"
