-- CDC creates raw tables in {app_name}_db (e.g., olob_db), not in platform_db.
-- Create database first: CREATE DATABASE olob_db;
--
-- POSTGRES
CREATE TABLE public.openaccount_syslog (
    id SERIAL PRIMARY KEY,
    log_dt TIMESTAMP NOT NULL,
    log_msg TEXT NOT NULL
);

-- MYSQL (run in olob_db database)
CREATE TABLE openaccount_syslog (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    log_dt DATETIME NOT NULL,
    log_msg TEXT NOT NULL
);