#!/bin/bash
# =============================================================================
# ZylkerKart - Database Seed Shell Wrapper
# Runs after 01-schema.sql to populate data from CSV.
# This script is placed in /docker-entrypoint-initdb.d/ and only runs on
# first MySQL initialization (when data directory is empty).
# =============================================================================

set -e

echo "[SEED-WRAPPER] Starting seed process..."

# Check if data already exists
RESULT=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM db_product.products;" 2>/dev/null || echo "0")

if [ "$RESULT" -gt "0" ]; then
    echo "[SEED-WRAPPER] Database already seeded with $RESULT products. Skipping."
    exit 0
fi

echo "[SEED-WRAPPER] Running Python seed loader..."
python3 /seed/seed_loader.py

echo "[SEED-WRAPPER] Seed process completed."
