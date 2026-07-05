-- Auth + BetterAuth + audit/rate-limit tables. Idempotent.
-- BetterAuth columns on "users" (name, email_verified, image) are added by the
-- engine reconciliation pass (MANAGED_COLUMNS) for pre-existing installs.

-- ── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    name VARCHAR(255),
    email_verified INTEGER DEFAULT 0,
    image VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
DROP TRIGGER IF EXISTS upd_users_updated_at ON users;
CREATE TRIGGER upd_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

-- ── audit_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
    username VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255),
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ── rate_limit_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    blocked_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ── pending_user_requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_user_requests (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    requested_role requested_role NOT NULL,
    requested_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
    status request_status NOT NULL DEFAULT 'pending',
    approved_role user_role,
    approved_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
    rejected_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
DROP TRIGGER IF EXISTS upd_pur_updated_at ON pending_user_requests;
CREATE TRIGGER upd_pur_updated_at
BEFORE UPDATE ON pending_user_requests
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

-- ── BetterAuth: session ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session (
    id VARCHAR(255) PRIMARY KEY,
    expires_at TIMESTAMP NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    ip_address VARCHAR(255),
    user_agent TEXT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE
);

-- ── BetterAuth: account ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account (
    id VARCHAR(255) PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMP,
    refresh_token_expires_at TIMESTAMP,
    scope TEXT,
    password TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ── BetterAuth: verification ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verification (
    id VARCHAR(255) PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
