-- Shared trigger function + enum types. 
-- Must run before any table/trigger below.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN 
    CREATE TYPE "USER_ROLE" AS ENUM ('superadmin', 'admin', 'user'); 
EXCEPTION 
    WHEN duplicate_object THEN NULL; 
END $$;

DO $$ 
BEGIN 
    CREATE TYPE "REQUESTED_ROLE" AS ENUM ('admin', 'user'); 
EXCEPTION 
    WHEN duplicate_object THEN NULL; 
END $$;

DO $$ 
BEGIN 
    CREATE TYPE "REQUEST_STATUS" AS ENUM ('pending', 'approved', 'rejected'); 
EXCEPTION 
    WHEN duplicate_object THEN NULL; 
END $$;

DO $$ 
BEGIN 
    CREATE TYPE "ERROR_TYPE_ENUM" AS ENUM ('S', 'N', 'Sukses'); 
EXCEPTION 
    WHEN duplicate_object THEN NULL; 
END $$;

DO $$ 
BEGIN 
    CREATE TYPE "PROC_STATUS_ENUM" AS ENUM ('running', 'success', 'failed'); 
EXCEPTION 
    WHEN duplicate_object THEN NULL; 
END $$;
