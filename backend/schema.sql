CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  university TEXT NOT NULL,
  country TEXT NOT NULL,
  fees_usd INTEGER NOT NULL CHECK (fees_usd >= 0),
  intake_months TEXT[] NOT NULL,
  min_gpa NUMERIC(2, 1) NOT NULL CHECK (min_gpa >= 0 AND min_gpa <= 4),
  degree_required TEXT NOT NULL CHECK (degree_required IN ('bachelor', 'master', 'phd')),
  field_of_study TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank > 0)
);

CREATE INDEX IF NOT EXISTS courses_degree_idx ON courses (degree_required);
CREATE INDEX IF NOT EXISTS courses_country_idx ON courses (country);
CREATE INDEX IF NOT EXISTS courses_field_idx ON courses (field_of_study);

CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  profile JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS magic_links_expires_idx ON magic_links (expires_at);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  profile JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encrypted TEXT NOT NULL,
  owner_id TEXT
);

CREATE INDEX IF NOT EXISTS sessions_updated_idx ON sessions (updated_at DESC);

CREATE TABLE IF NOT EXISTS magic_link_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE REFERENCES magic_links(token) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  chunk_size INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  owner_id TEXT
);

CREATE TABLE IF NOT EXISTS magic_link_pdf_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id UUID NOT NULL REFERENCES magic_link_pdfs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  encrypted_data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT magic_link_pdf_chunks_idx UNIQUE (pdf_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS magic_link_pdfs_token_idx ON magic_link_pdfs (token);
CREATE INDEX IF NOT EXISTS magic_link_pdfs_expires_idx ON magic_link_pdfs (expires_at);
CREATE INDEX IF NOT EXISTS magic_link_pdf_chunks_pdf_idx ON magic_link_pdf_chunks (pdf_id, chunk_index ASC);

