-- EDC source tables in itm_db. Used by EDC Agen, EDC Merchant, EDC Merchant Ancol (via FDW).
-- Create database first: CREATE DATABASE itm_db;
--
-- PostgreSQL only (run in itm_db database)
-- Table names and columns match AS/400 or source system. Use quoted identifiers for case-sensitive names.

-- Transaction table (ZTRANS0P)
CREATE TABLE IF NOT EXISTS public."ASID160448_ZTRANS0P" (
    "TRXMDT" DATE,
    "TRRSPC" VARCHAR(50),
    "TRTRTY" VARCHAR(10),
    "TRPROD" VARCHAR(50),
    "TRTRN$" DECIMAL(20,2),
    "TRCAID" VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_itm_ztrans_trxmdt ON public."ASID160448_ZTRANS0P" ("TRXMDT");
CREATE INDEX IF NOT EXISTS idx_itm_ztrans_trrspc ON public."ASID160448_ZTRANS0P" ("TRRSPC");
CREATE INDEX IF NOT EXISTS idx_itm_ztrans_trtrty_prod ON public."ASID160448_ZTRANS0P" ("TRTRTY", "TRPROD");
CREATE INDEX IF NOT EXISTS idx_itm_ztrans_trcaid ON public."ASID160448_ZTRANS0P" ("TRCAID");

-- Response code table (ZRSPCD0P)
CREATE TABLE IF NOT EXISTS public."ASID160448_ZRSPCD0P" (
    "RSRSPC" VARCHAR(50),
    "RSSHTD" VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_itm_zrspc_rsrspc ON public."ASID160448_ZRSPCD0P" ("RSRSPC");
