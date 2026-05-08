-- CDC creates raw tables in {app_name}_db (e.g., bale_bisnis_db), not in platform_db.
-- Create database first: CREATE DATABASE bale_bisnis_db;
--
-- POSTGRES
CREATE TABLE public.raw_bale_bisnis (
    id SERIAL PRIMARY KEY,
    transaction_date TIMESTAMP NOT NULL,
    transaction_category VARCHAR(255),
    result_code VARCHAR(50) NULL,
    result_code_desc VARCHAR(500) NULL,
    transaction_amount DECIMAL(20,2) NULL,
    admin_fee DECIMAL(20,2) NULL,
    transaction_status INTEGER NULL,
    transaction_state VARCHAR(10) NULL
);

-- MYSQL (run in bale_bisnis_db database)
CREATE TABLE raw_bale_bisnis (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    transaction_date DATETIME NOT NULL,
    transaction_category VARCHAR(255),
    result_code VARCHAR(50) NULL,
    result_code_desc VARCHAR(500) NULL,
    transaction_amount DECIMAL(20,2) NULL,
    admin_fee DECIMAL(20,2) NULL,
    transaction_status INT NULL,
    transaction_state VARCHAR(10) NULL
);