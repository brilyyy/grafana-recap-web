#!/bin/bash
set -e

# This script initializes pg_cron extension in PostgreSQL
# It runs automatically when the container starts for the first time

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    GRANT USAGE ON SCHEMA cron TO $POSTGRES_USER;
EOSQL

echo "pg_cron extension initialized successfully"
