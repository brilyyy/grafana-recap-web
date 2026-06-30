-- DB Create
CREATE DATABASE qris_n8n_ancol_db

-- public.qris_sync_state definition

-- Drop table

-- DROP TABLE public.qris_sync_state;

CREATE TABLE public.qris_sync_state (
	sync_name text NOT NULL,
	last_watermark timestamptz NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT qris_sync_state_pkey PRIMARY KEY (sync_name)
);

-- public.raw_qris_n8n definition

-- Drop table

-- DROP TABLE public.raw_qris_n8n;

CREATE TABLE public.raw_qris_n8n_ancol (
	elastic_index text NOT NULL,
	elastic_id text NOT NULL,
	trx_timestamp timestamptz NULL,
	response_code varchar(20) NULL,
	feature varchar(100) NULL,
	trx_amount numeric(18, 2) DEFAULT 0 NOT NULL,
	code_description text NULL,
	reference_number varchar(100) NULL,
	sort_value int4 NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	merchant_id text NULL,
	CONSTRAINT raw_qris_n8n_pkey PRIMARY KEY (elastic_index, elastic_id)
);
CREATE INDEX idx_raw_qris_n8n_feature ON public.raw_qris_n8n USING btree (feature);
CREATE INDEX idx_raw_qris_n8n_reference_number ON public.raw_qris_n8n USING btree (reference_number);
CREATE INDEX idx_raw_qris_n8n_response_code ON public.raw_qris_n8n USING btree (response_code);
CREATE INDEX idx_raw_qris_n8n_trx_timestamp ON public.raw_qris_n8n USING btree (trx_timestamp);
