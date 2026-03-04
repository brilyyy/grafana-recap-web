-- CDC creates raw tables in db_{app_name} (e.g., db_bale), not in platform_db.
-- Create database first: CREATE DATABASE db_olob;
--
-- POSTGRES
CREATE TABLE public.openaccount_syslog (
    id SERIAL PRIMARY KEY,
    log_dt TIMESTAMP NOT NULL,
    log_msg TEXT NOT NULL
);

-- MYSQL (run in db_olob database)
CREATE TABLE openaccount_syslog (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    log_dt DATETIME NOT NULL,
    log_msg TEXT NOT NULL
);