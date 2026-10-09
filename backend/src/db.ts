import pg from 'pg';

import { type Course, courseCatalog } from './data.js';
import { type MeetingDocument } from './meetDocuments.js';
import { normalizeCountry } from './recommend.js';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://gradguide:localdev@localhost:5432/gradguide';

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL || !!process.env.RENDER;
const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  (isProduction && !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')) ||
  databaseUrl.includes('sslmode=require');

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DATABASE_MAX_CONNECTIONS ?? 5),
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

export type MagicLinkRecord = {
  token: string;
  title: string;
  profile: Record<string, unknown>;
  results: Array<Record<string, unknown>>;
  created_at: Date;
  expires_at: Date;
  owner_id: string | null;
};

export type MagicLinkPdfRecord = {
  id: string;
  token: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  chunk_size: number;
  total_chunks: number;
  created_at: Date;
  expires_at: Date;
  owner_id: string | null;
};

export type MagicLinkPdfChunkRecord = {
  id: string;
  pdf_id: string;
  chunk_index: number;
  iv: string;
  auth_tag: string;
  encrypted_data: Buffer;
  created_at: Date;
};

export type UserGoogleTokenRecord = {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expiry_date: number | null;
  updated_at: Date;
};

export type SavedSessionRecord = {
  id: string;
  title: string;
  profile: Record<string, unknown>;
  results: Array<Record<string, unknown>>;
  created_at: Date;
  updated_at: Date;
  encrypted: string;
  owner_id: string;
};

export async function initializeDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS magic_links (
      token TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      profile JSONB NOT NULL,
      results JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
      ,owner_id TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS magic_links_expires_idx ON magic_links (expires_at);

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      profile JSONB NOT NULL,
      results JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      encrypted TEXT NOT NULL
      ,owner_id TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_updated_idx ON sessions (updated_at DESC);

    CREATE TABLE IF NOT EXISTS meeting_documents (
      id UUID PRIMARY KEY,
      conference_record_name TEXT NOT NULL,
      title TEXT NOT NULL,
      meeting_uri TEXT,
      transcript JSONB NOT NULL,
      questions JSONB NOT NULL,
      analytics JSONB NOT NULL,
      analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      ,owner_id TEXT NOT NULL
    );

    ALTER TABLE meeting_documents ADD COLUMN IF NOT EXISTS analysis JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS owner_id TEXT;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS owner_id TEXT;
    ALTER TABLE meeting_documents ADD COLUMN IF NOT EXISTS owner_id TEXT;
    CREATE INDEX IF NOT EXISTS meeting_documents_created_idx ON meeting_documents (created_at DESC);

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

    CREATE TABLE IF NOT EXISTS user_google_tokens (
      user_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      scope TEXT,
      token_type TEXT,
      expiry_date BIGINT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function saveMeetingDocument(document: MeetingDocument, ownerId: string): Promise<MeetingDocument> {
  const result = await pool.query(`
    INSERT INTO meeting_documents
      (id, conference_record_name, title, meeting_uri, transcript, questions, analytics, analysis, created_at, owner_id)
    VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
    RETURNING id, conference_record_name AS "conferenceRecordName", title, meeting_uri AS "meetingUri",
      transcript, questions, analytics, analysis, created_at AS "createdAt"
  `, [
    document.id,
    document.conferenceRecordName,
    document.title,
    document.meetingUri ?? null,
    JSON.stringify(document.transcript),
    JSON.stringify(document.questions),
    JSON.stringify(document.analytics),
    JSON.stringify(document.analysis),
    document.createdAt,
    ownerId,
  ]);
  return result.rows[0] as MeetingDocument;
}

export async function listMeetingDocuments(ownerId: string): Promise<MeetingDocument[]> {
  const result = await pool.query(`
    SELECT id, conference_record_name AS "conferenceRecordName", title, meeting_uri AS "meetingUri",
      transcript, questions, analytics, analysis, created_at AS "createdAt"
    FROM meeting_documents
    WHERE (owner_id = $1 OR owner_id IS NULL)
    ORDER BY created_at DESC
  `, [ownerId]);
  return result.rows as MeetingDocument[];
}

export async function getMeetingDocumentById(id: string, ownerId: string): Promise<MeetingDocument | null> {
  const result = await pool.query(`
    SELECT id, conference_record_name AS "conferenceRecordName", title, meeting_uri AS "meetingUri",
      transcript, questions, analytics, analysis, created_at AS "createdAt"
    FROM meeting_documents
    WHERE id = $1::uuid AND (owner_id = $2 OR owner_id IS NULL)
  `, [id, ownerId]);
  return (result.rows[0] as MeetingDocument | undefined) ?? null;
}

export async function updateMeetingDocumentAnalysis(id: string, ownerId: string, analysis: MeetingDocument['analysis']): Promise<void> {
  await pool.query(
    'UPDATE meeting_documents SET analysis = $3::jsonb WHERE id = $1::uuid AND (owner_id = $2 OR owner_id IS NULL)',
    [id, ownerId, JSON.stringify(analysis)],
  );
}

export async function deleteMeetingDocument(id: string, ownerId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM meeting_documents WHERE id = $1::uuid AND (owner_id = $2 OR owner_id IS NULL)`,
    [id, ownerId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function createMagicLink(payload: {
  token: string;
  title: string;
  profile: Record<string, unknown>;
  results: Array<Record<string, unknown>>;
  expiresAt: Date;
  ownerId: string;
}): Promise<MagicLinkRecord> {
  const result = await pool.query<MagicLinkRecord>(`
    INSERT INTO magic_links (token, title, profile, results, expires_at, owner_id)
    VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
    RETURNING
      token,
      title,
      profile,
      results,
      created_at AS "created_at",
      expires_at AS "expires_at", owner_id
  `, [payload.token, payload.title, JSON.stringify(payload.profile), JSON.stringify(payload.results), payload.expiresAt, payload.ownerId]);

  return result.rows[0];
}

export async function getMagicLinkByToken(token: string, ownerId?: string): Promise<MagicLinkRecord | null> {
  const query = ownerId
    ? `SELECT token, title, profile, results, created_at AS "created_at", expires_at AS "expires_at", owner_id FROM magic_links WHERE token = $1 AND owner_id = $2`
    : `SELECT token, title, profile, results, created_at AS "created_at", expires_at AS "expires_at", owner_id FROM magic_links WHERE token = $1`;
  const params = ownerId ? [token, ownerId] : [token];
  const result = await pool.query<MagicLinkRecord>(query, params);

  return result.rows[0] ?? null;
}

export async function deleteMagicLink(token: string): Promise<void> {
  await pool.query('DELETE FROM magic_links WHERE token = $1', [token]);
}

export async function saveEncryptedPdf(payload: {
  token: string;
  title: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: Date;
  ownerId: string | null;
  chunks: Array<{
    chunkIndex: number;
    iv: string;
    authTag: string;
    encryptedData: Buffer;
  }>;
}): Promise<MagicLinkPdfRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO magic_links (token, title, profile, results, expires_at, owner_id)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
      ON CONFLICT (token) DO UPDATE SET
        title = EXCLUDED.title,
        profile = EXCLUDED.profile,
        results = EXCLUDED.results,
        expires_at = EXCLUDED.expires_at,
        owner_id = EXCLUDED.owner_id
    `, [
      payload.token,
      payload.title,
      JSON.stringify({
        type: 'pdf_document',
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        totalChunks: payload.totalChunks,
      }),
      JSON.stringify([]),
      payload.expiresAt,
      payload.ownerId,
    ]);

    const pdfRes = await client.query<MagicLinkPdfRecord>(`
      INSERT INTO magic_link_pdfs (token, file_name, file_size, mime_type, chunk_size, total_chunks, expires_at, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (token) DO UPDATE SET
        file_name = EXCLUDED.file_name,
        file_size = EXCLUDED.file_size,
        mime_type = EXCLUDED.mime_type,
        chunk_size = EXCLUDED.chunk_size,
        total_chunks = EXCLUDED.total_chunks,
        expires_at = EXCLUDED.expires_at,
        owner_id = EXCLUDED.owner_id
      RETURNING
        id, token, file_name, file_size, mime_type, chunk_size, total_chunks,
        created_at AS "created_at", expires_at AS "expires_at", owner_id
    `, [
      payload.token,
      payload.fileName,
      payload.fileSize,
      payload.mimeType ?? 'application/pdf',
      payload.chunkSize,
      payload.totalChunks,
      payload.expiresAt,
      payload.ownerId,
    ]);

    const pdfRecord = pdfRes.rows[0];

    await client.query('DELETE FROM magic_link_pdf_chunks WHERE pdf_id = $1', [pdfRecord.id]);

    for (const chunk of payload.chunks) {
      await client.query(`
        INSERT INTO magic_link_pdf_chunks (pdf_id, chunk_index, iv, auth_tag, encrypted_data)
        VALUES ($1, $2, $3, $4, $5)
      `, [pdfRecord.id, chunk.chunkIndex, chunk.iv, chunk.authTag, chunk.encryptedData]);
    }

    await client.query('COMMIT');
    return pdfRecord;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getMagicLinkPdfByToken(token: string): Promise<MagicLinkPdfRecord | null> {
  const result = await pool.query<MagicLinkPdfRecord>(`
    SELECT
      id, token, file_name, file_size, mime_type, chunk_size, total_chunks,
      created_at AS "created_at", expires_at AS "expires_at", owner_id
    FROM magic_link_pdfs
    WHERE token = $1
  `, [token]);
  return result.rows[0] ?? null;
}

export async function getMagicLinkPdfChunks(pdfId: string): Promise<MagicLinkPdfChunkRecord[]> {
  const result = await pool.query<MagicLinkPdfChunkRecord>(`
    SELECT
      id, pdf_id, chunk_index, iv, auth_tag, encrypted_data, created_at AS "created_at"
    FROM magic_link_pdf_chunks
    WHERE pdf_id = $1
    ORDER BY chunk_index ASC
  `, [pdfId]);
  return result.rows;
}


export async function saveSession(payload: {
  id: string;
  title: string;
  profile: Record<string, unknown>;
  results: Array<Record<string, unknown>>;
  encrypted: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}): Promise<SavedSessionRecord> {
  const result = await pool.query<SavedSessionRecord>(`
    INSERT INTO sessions (id, title, profile, results, encrypted, created_at, updated_at, owner_id)
    VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
    ON CONFLICT (id)
    DO UPDATE SET
      title = EXCLUDED.title,
      profile = EXCLUDED.profile,
      results = EXCLUDED.results,
      encrypted = EXCLUDED.encrypted,
      owner_id = EXCLUDED.owner_id,
      updated_at = EXCLUDED.updated_at
    WHERE sessions.owner_id = EXCLUDED.owner_id
    RETURNING
      id,
      title,
      profile,
      results,
      created_at AS "created_at",
      updated_at AS "updated_at",
      encrypted, owner_id
  `, [payload.id, payload.title, JSON.stringify(payload.profile), JSON.stringify(payload.results), payload.encrypted, payload.createdAt, payload.updatedAt, payload.ownerId]);

  if (!result.rows[0]) {
    throw new Error('The session belongs to a different user.');
  }
  return result.rows[0];
}

export async function listSessions(ownerId: string): Promise<SavedSessionRecord[]> {
  const result = await pool.query<SavedSessionRecord>(`
    SELECT
      id,
      title,
      profile,
      results,
      created_at AS "created_at",
      updated_at AS "updated_at",
      encrypted, owner_id
    FROM sessions
    WHERE (owner_id = $1 OR owner_id IS NULL)
    ORDER BY updated_at DESC
  `, [ownerId]);

  return result.rows;
}

export async function getSessionById(id: string, ownerId: string): Promise<SavedSessionRecord | null> {
  const result = await pool.query<SavedSessionRecord>(`
    SELECT
      id,
      title,
      profile,
      results,
      created_at AS "created_at",
      updated_at AS "updated_at",
      encrypted, owner_id
    FROM sessions
    WHERE id = $1::uuid AND (owner_id = $2 OR owner_id IS NULL)
  `, [id, ownerId]);

  return result.rows[0] ?? null;
}

export async function deleteSession(id: string, ownerId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM sessions WHERE id = $1::uuid AND (owner_id = $2 OR owner_id IS NULL)`,
    [id, ownerId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function findCourses(params: {
  major?: string;
  preferredCountry?: string;
  degreeLevel?: Course['degreeRequired'];
  budget?: number;
  keyword?: string;
}): Promise<Course[]> {
  const normCountry = normalizeCountry(params.preferredCountry);
  const searchTerm = (params.keyword || params.major || '').trim().toLowerCase();

  let query = `
    SELECT
      id,
      name,
      university,
      country,
      fees_usd AS "feesUsd",
      intake_months AS "intakeMonths",
      min_gpa::float4 AS "minGpa",
      degree_required AS "degreeRequired",
      field_of_study AS "fieldOfStudy",
      rank
    FROM courses
    WHERE 1=1
  `;
  const values: any[] = [];
  let paramIdx = 1;

  if (params.degreeLevel) {
    query += ` AND degree_required = $${paramIdx++}`;
    values.push(params.degreeLevel);
  }

  if (normCountry) {
    query += ` AND (LOWER(country) = LOWER($${paramIdx}) OR LOWER(country) LIKE '%' || LOWER($${paramIdx}) || '%')`;
    values.push(normCountry);
    paramIdx++;
  }

  if (searchTerm) {
    const tokens = searchTerm.split(/\s+/).filter((t) => t.length >= 2);
    const tokenClauses: string[] = [];

    for (const t of tokens) {
      const isAi = t === 'ai' || t.includes('artificial');
      const isCs = t === 'cs' || t.includes('computer');
      const isMit = t === 'mit';
      const isDs = t === 'ds' || t.includes('data');

      tokenClauses.push(`(
        LOWER(field_of_study) LIKE '%' || $${paramIdx} || '%'
        OR LOWER(name) LIKE '%' || $${paramIdx} || '%'
        OR LOWER(university) LIKE '%' || $${paramIdx} || '%'
        ${isAi ? "OR LOWER(field_of_study) LIKE '%artificial intelligence%' OR LOWER(name) LIKE '%artificial intelligence%'" : ''}
        ${isCs ? "OR LOWER(field_of_study) LIKE '%computer science%' OR LOWER(name) LIKE '%computer science%'" : ''}
        ${isMit ? "OR LOWER(university) LIKE '%massachusetts institute of technology%'" : ''}
        ${isDs ? "OR LOWER(field_of_study) LIKE '%data science%' OR LOWER(name) LIKE '%data science%'" : ''}
      )`);
      values.push(t);
      paramIdx++;
    }

    if (tokenClauses.length > 0) {
      query += ` AND (${tokenClauses.join(' AND ')})`;
    }
  }

  query += ` ORDER BY `;
  if (normCountry) {
    query += `CASE WHEN LOWER(country) = LOWER('${normCountry.replace(/'/g, "''")}') THEN 0 ELSE 1 END, `;
  }
  if (params.budget && params.budget > 0) {
    query += `CASE WHEN fees_usd <= ${Number(params.budget)} THEN 0 WHEN fees_usd <= ${Number(params.budget) * 1.35} THEN 1 ELSE 2 END, `;
  }
  query += `rank ASC, fees_usd ASC LIMIT 50`;

  try {
    const result = await pool.query<Course>(query, values);
    if (result.rows.length > 0) {
      return result.rows;
    }
  } catch (err) {
    console.error('findCourses query error, falling back:', err);
  }

  // Graceful fallback: return courses by degree or rank so recommendations are always available
  try {
    const fallback = await pool.query<Course>(
      `SELECT id, name, university, country, fees_usd AS "feesUsd", intake_months AS "intakeMonths",
              min_gpa::float4 AS "minGpa", degree_required AS "degreeRequired", field_of_study AS "fieldOfStudy", rank
       FROM courses
       WHERE ($1::text IS NULL OR degree_required = $1)
       ORDER BY rank ASC LIMIT 30`,
      [params.degreeLevel ?? null],
    );
    if (fallback.rows.length > 0) {
      return fallback.rows;
    }
  } catch {
    // ignore
  }

  return courseCatalog;
}

export async function saveUserGoogleToken(userId: string, tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
}): Promise<void> {
  await pool.query(`
    INSERT INTO user_google_tokens (user_id, access_token, refresh_token, scope, token_type, expiry_date, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, user_google_tokens.refresh_token),
      scope = COALESCE(EXCLUDED.scope, user_google_tokens.scope),
      token_type = COALESCE(EXCLUDED.token_type, user_google_tokens.token_type),
      expiry_date = COALESCE(EXCLUDED.expiry_date, user_google_tokens.expiry_date),
      updated_at = NOW()
  `, [
    userId,
    tokens.access_token ?? '',
    tokens.refresh_token ?? null,
    tokens.scope ?? null,
    tokens.token_type ?? null,
    tokens.expiry_date ?? null,
  ]);
}

export async function getUserGoogleToken(userId: string): Promise<UserGoogleTokenRecord | null> {
  const result = await pool.query<UserGoogleTokenRecord>(`
    SELECT user_id, access_token, refresh_token, scope, token_type, expiry_date, updated_at
    FROM user_google_tokens
    WHERE user_id = $1
    LIMIT 1
  `, [userId]);
  return result.rows[0] ?? null;
}

export async function deleteUserGoogleToken(userId: string): Promise<void> {
  await pool.query(`DELETE FROM user_google_tokens WHERE user_id = $1`, [userId]);
}

