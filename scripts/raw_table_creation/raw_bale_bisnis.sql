-- CDC creates raw tables in db_{app_name} (e.g., db_bale), not in platform_db.
-- Create database first: CREATE DATABASE db_bale;
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

-- MYSQL (run in db_bale database)
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