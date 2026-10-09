import cors from 'cors';
import express from 'express';
import { randomUUID, randomBytes } from 'crypto';
import { z } from 'zod';

import { PORT, API_PREFIX } from './config.js';
import { authenticatedUserId, requireAuth, optionalAuth } from './auth.js';
import { buildCourseEvaluation, buildExplainability, buildPitch, evaluateCourseWithGemini, generateAIText, generateAIPitch, hybridRecommendCourses, recommendCourses, scoreCourse, COUNTRY_ALIASES, normalizeCountry, ChatFiltersSchema, extractChatFiltersLocally, type PitchPersona } from './recommend.js';
import { courseCatalog } from './data.js';
import { createMagicLink, deleteMagicLink, deleteSession, findCourses, getMagicLinkByToken, getMagicLinkPdfByToken, getMagicLinkPdfChunks, getSessionById, initializeDatabase, listSessions, saveEncryptedPdf, saveSession } from './db.js';
import { deleteMeetingDocument, getMeetingDocumentById, listMeetingDocuments, saveMeetingDocument, updateMeetingDocumentAnalysis } from './db.js';
import { getUserGoogleToken, saveUserGoogleToken, deleteUserGoogleToken } from './db.js';
import { analyzeMeeting, type MeetingDocument, createMeetingDocument, generateGoogleAuthUrl, exchangeGoogleCode } from './meetDocuments.js';
import { decryptSession, encryptSession } from './session.js';
import { chunkAndEncryptPdf, decryptAndAssemblePdf, isPdfBuffer, PDF_CHUNK_SIZE } from './pdfCrypto.js';

const app = express();
const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. server-to-server, curl, mobile)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (
      allowedOrigins.has(origin) ||
      allowedOrigins.has('*') ||
      process.env.CORS_ALLOW_ALL === 'true' ||
      origin.endsWith('.vercel.app')
    ) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));

export function getMagicLinkBaseUrl(req: express.Request): string {
  if (process.env.MAGIC_LINK_BASE_URL) {
    return process.env.MAGIC_LINK_BASE_URL.replace(/\/+$/, '');
  }

  const origin = req.headers.origin;
  if (origin && typeof origin === 'string' && origin.startsWith('http')) {
    return `${origin.replace(/\/+$/, '')}/magic`;
  }

  const referer = req.headers.referer;
  if (referer && typeof referer === 'string' && referer.startsWith('http')) {
    try {
      const parsedUrl = new URL(referer);
      return `${parsedUrl.origin}/magic`;
    } catch {
      // Fall through to default
    }
  }

  return 'http://localhost:5173/magic';
}
app.use(express.json({ limit: '50mb' }));
app.use(API_PREFIX, (req, res, next) => {
  // Allow public / bearer access to magic links (both generating and viewing)
  if (req.path.startsWith('/magic-link')) {
    return optionalAuth(req, res, next);
  }
  // Allow Google OAuth redirect callback without prior session
  if (req.path.startsWith('/auth/google/callback')) {
    return next();
  }
  return requireAuth(req, res, next);
});

void initializeDatabase().catch((error) => {
  console.error('Database initialization failed', error);
});

const StudentProfileSchema = z.object({
  budget: z.number().min(0).max(500000),
  major: z.string().min(2).max(100),
  preferredCountry: z.string().nullish().transform((v) => (v && v.trim() ? v.trim() : undefined)).optional(),
  degreeLevel: z.enum(['bachelor', 'master', 'phd']),
  intakeYear: z.number().int().min(2024).max(2030),
  gpa: z.number().min(0).max(4),
});

const TradeoffSchema = z.object({
  profile: StudentProfileSchema,
  weights: z
    .object({
      budget: z.number().min(0).max(100).optional(),
      rank: z.number().min(0).max(100).optional(),
      location: z.number().min(0).max(100).optional(),
      intake: z.number().min(0).max(100).optional(),
      major: z.number().min(0).max(100).optional(),
      degree: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

const ExplainSchema = z.object({
  profile: StudentProfileSchema,
  courseId: z.number().int().positive().optional(),
  topN: z.number().int().min(1).max(10).optional(),
});

const ChatSchema = z.object({
  query: z.string().trim().min(1).max(500),
});

const PitchSchema = z.object({
  profile: StudentProfileSchema,
  courseId: z.number().int().positive().optional(),
  persona: z.enum(['student', 'parent', 'sponsor']).default('student'),
});

const EvaluationSchema = z.object({
  profile: StudentProfileSchema,
  courseId: z.number().int().positive().optional(),
  topN: z.number().int().min(1).max(10).default(5),
});

const SessionSaveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(80),
  profile: StudentProfileSchema,
  weights: z.object({
    budget: z.number().min(0).max(100).optional(),
    rank: z.number().min(0).max(100).optional(),
    location: z.number().min(0).max(100).optional(),
    intake: z.number().min(0).max(100).optional(),
    major: z.number().min(0).max(100).optional(),
    degree: z.number().min(0).max(100).optional(),
  }).default({ budget: 0, rank: 20, location: 0, intake: 0, major: 0, degree: 0 }),
  results: z.array(z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    university: z.string().min(1),
    country: z.string().min(1),
    feesUsd: z.number().min(0),
    rank: z.number().int().positive(),
    score: z.number().min(0),
    reasons: z.array(z.string()).default([]),
    explanation: z.string().optional(),
    selected: z.boolean().default(false),
  }).passthrough()).default([]),
});

function toRecommendationResponse(student: z.infer<typeof StudentProfileSchema>, results: ReturnType<typeof recommendCourses>) {
  return {
    student,
    resultCount: results.length,
    results: results.map(({ course, score, reasons }) => ({
      id: course.id,
      name: course.name,
      university: course.university,
      country: course.country,
      feesUsd: course.feesUsd,
      rank: course.rank,
      score,
      reasons,
    })),
  };
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gradguide-backend' });
});

app.get(`${API_PREFIX}/meeting-documents`, async (req, res) => {
  try {
    return res.json({ documents: await listMeetingDocuments(authenticatedUserId(req)) });
  } catch (error) {
    console.error('Failed to list meeting documents', error);
    return res.status(503).json({ error: 'MEETING_DOCUMENT_STORAGE_FAILED', message: 'Meeting documents are temporarily unavailable.' });
  }
});

app.get(`${API_PREFIX}/meeting-documents/:id`, async (req, res) => {
  const document = await getMeetingDocumentById(req.params.id, authenticatedUserId(req));
  if (!document) return res.status(404).json({ error: 'MEETING_DOCUMENT_NOT_FOUND', message: 'Meeting document was not found.' });
  return res.json({ document });
});

function escapeHtml(value: unknown): string {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '');
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function meetingDocumentHtml(document: MeetingDocument): string {
  const analysis = {
    summary: document.analysis?.summary ?? 'This document has not been analyzed yet.',
    keyPoints: document.analysis?.keyPoints ?? [],
    recommendations: document.analysis?.recommendations ?? [],
    followUps: document.analysis?.followUps ?? [],
    source: document.analysis?.source ?? 'rule-based',
  };
  const list = (items: string[]) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(document.title)}</title>
  <style>body{font-family:Arial,sans-serif;line-height:1.5;color:#132238;max-width:850px;margin:40px auto}h1{color:#214ea8}.meta{color:#596b87}.card{background:#f5f8ff;border:1px solid #dfeafd;border-radius:8px;padding:14px;margin:12px 0}.speaker{font-weight:bold}</style>
  </head><body><h1>${escapeHtml(document.title)}</h1>
  <p class="meta">Conference record: ${escapeHtml(document.conferenceRecordName)}<br>Generated: ${escapeHtml(document.createdAt)}</p>
  <h2>AI analysis (${escapeHtml(analysis.source)})</h2><div class="card"><p>${escapeHtml(analysis.summary)}</p>
  <h3>Key points</h3><ul>${list(analysis.keyPoints)}</ul><h3>Recommendations</h3><ul>${list(analysis.recommendations)}</ul><h3>Follow-ups</h3><ul>${list(analysis.followUps)}</ul></div>
  <h2>Analytics</h2><div class="card">Words: ${document.analytics.transcriptWordCount} · Questions: ${document.analytics.questionCount} · Replies: ${document.analytics.answerCount} · Average reply words: ${document.analytics.averageAnswerWords}</div>
  <h2>Questions and replies</h2>${document.questions.length ? document.questions.map((item) => `<div class="card"><p><b>Q:</b> ${escapeHtml(item.question)}</p><p><b>A:</b> ${escapeHtml(item.answer)}</p></div>`).join('') : '<p>No question-shaped exchanges were detected.</p>'}
  <h2>Transcript</h2>${document.transcript.map((item) => `<p><span class="speaker">${escapeHtml(item.participant)}:</span> ${escapeHtml(item.text)}</p>`).join('')}
  </body></html>`;
}

app.get(`${API_PREFIX}/meeting-documents/:id/download`, async (req, res) => {
  const document = await getMeetingDocumentById(req.params.id, authenticatedUserId(req));
  if (!document) return res.status(404).json({ error: 'MEETING_DOCUMENT_NOT_FOUND', message: 'Meeting document was not found.' });
  res.setHeader('Content-Type', 'application/msword; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="gradguide-meeting-${document.id}.doc"`);
  return res.send(meetingDocumentHtml(document));
});

app.delete(`${API_PREFIX}/meeting-documents/:id`, async (req, res) => {
  const deleted = await deleteMeetingDocument(req.params.id, authenticatedUserId(req));
  if (!deleted) return res.status(404).json({ error: 'MEETING_DOCUMENT_NOT_FOUND', message: 'Meeting document was not found.' });
  return res.json({ success: true, id: req.params.id });
});

app.post(`${API_PREFIX}/meeting-documents/:id/analyze`, async (req, res) => {
  const ownerId = authenticatedUserId(req);
  const document = await getMeetingDocumentById(req.params.id, ownerId);
  if (!document) return res.status(404).json({ error: 'MEETING_DOCUMENT_NOT_FOUND', message: 'Meeting document was not found.' });
  try {
    const analysis = await analyzeMeeting(document.transcript, document.questions);
    await updateMeetingDocumentAnalysis(document.id, ownerId, analysis);
    return res.json({ analysis });
  } catch (error) {
    console.error('Failed to analyze meeting document', error);
    return res.status(503).json({ error: 'MEETING_DOCUMENT_ANALYSIS_FAILED', message: 'AI analysis could not be completed.' });
  }
});

app.post(`${API_PREFIX}/meeting-documents`, async (req, res) => {
  const meeting = typeof req.body?.meeting === 'string' ? req.body.meeting : '';
  if (!meeting.trim()) {
    return res.status(400).json({ error: 'INVALID_MEETING', message: 'Provide a Google Meet URL, meeting code, or conference record name.' });
  }
  try {
    const userId = authenticatedUserId(req);
    const document = await createMeetingDocument(meeting, userId);
    const saved = await saveMeetingDocument({ ...document, id: randomUUID() }, userId);
    return res.status(201).json({ document: saved });
  } catch (error) {
    console.error('Failed to create meeting document', error);
    const message = error instanceof Error ? error.message : 'The transcript document could not be created.';
    return res.status(502).json({ error: 'MEETING_DOCUMENT_CREATION_FAILED', message });
  }
});

// Initiate Google OAuth flow
app.get(`${API_PREFIX}/auth/google`, async (req, res) => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'You must be signed in to connect Google Meet.' });
  }

  let callerOrigin: string | undefined;
  if (req.headers.origin && typeof req.headers.origin === 'string') {
    callerOrigin = req.headers.origin;
  } else if (req.headers.referer && typeof req.headers.referer === 'string') {
    try {
      callerOrigin = new URL(req.headers.referer).origin;
    } catch {}
  }

  const returnTo = typeof req.query.returnTo === 'string' && req.query.returnTo
    ? req.query.returnTo
    : (callerOrigin || 'https://course-dashboard-livid-eight.vercel.app');

  const authUrl = generateGoogleAuthUrl(userId, returnTo);
  return res.json({ url: authUrl });
});

// OAuth Callback from Google consent screen
app.get([`${API_PREFIX}/auth/google/callback`, '/api/auth/google/callback'], async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const stateStr = typeof req.query.state === 'string' ? req.query.state : null;
  const error = req.query.error;

  let returnTo = 'https://course-dashboard-livid-eight.vercel.app';
  let userId = '';

  if (stateStr) {
    try {
      const decoded = JSON.parse(Buffer.from(stateStr, 'base64url').toString('utf-8'));
      if (decoded.returnTo) returnTo = decoded.returnTo;
      if (decoded.userId) userId = decoded.userId;
    } catch {}
  }

  if (error || !code || !userId) {
    console.error('Google OAuth callback rejected:', error || 'Missing code or userId in state');
    const redirectUrl = new URL(returnTo);
    redirectUrl.searchParams.set('google_auth', 'error');
    if (error) redirectUrl.searchParams.set('google_error', String(error));
    return res.redirect(redirectUrl.toString());
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    await saveUserGoogleToken(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date,
    });

    const redirectUrl = new URL(returnTo);
    redirectUrl.searchParams.set('google_auth', 'success');
    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error('Failed to exchange Google OAuth code:', err);
    const redirectUrl = new URL(returnTo);
    redirectUrl.searchParams.set('google_auth', 'error');
    redirectUrl.searchParams.set('google_error', 'token_exchange_failed');
    return res.redirect(redirectUrl.toString());
  }
});

// Check if user has an authorized Google account connected
app.get(`${API_PREFIX}/auth/google/status`, async (req, res) => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    return res.json({ connected: false });
  }

  const tokenRecord = await getUserGoogleToken(userId);
  const hasGlobalToken = Boolean(process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_MEET_REFRESH_TOKEN);

  return res.json({
    connected: Boolean(tokenRecord?.refresh_token || tokenRecord?.access_token || hasGlobalToken),
    scope: tokenRecord?.scope ?? null,
    updatedAt: tokenRecord?.updated_at ? new Date(tokenRecord.updated_at).toISOString() : null,
  });
});

// Disconnect Google account
app.post(`${API_PREFIX}/auth/google/disconnect`, async (req, res) => {
  const userId = authenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  await deleteUserGoogleToken(userId);
  return res.json({ disconnected: true });
});

function mergeTranscriptSegments(segments: Array<string | undefined | null>): string {
  return segments
    .filter((segment): segment is string => typeof segment === 'string' && segment.trim().length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProfileFromTranscript(transcript: string) {
  const normalized = transcript.toLowerCase();
  const profile: Partial<z.infer<typeof StudentProfileSchema>> = {};
  const detectedFields: string[] = [];

  const budgetMatch = transcript.match(/(?:budget|tuition|fees?|costs?)(?:\s+(?:is|around|about|up to|under|below))?\s*(?:\$|usd)?\s*(\d[\d,]{2,7})/i);
  const underBudgetMatch = transcript.match(/(?:under|below|less than|max(?:imum)?)(?:\s+\$)?\s*(\d[\d,]{2,7})/i);
  const budgetRaw = (budgetMatch?.[1] ?? underBudgetMatch?.[1] ?? '').replace(/,/g, '');
  const budgetValue = Number(budgetRaw || 0);
  if (budgetValue > 0) {
    profile.budget = budgetValue;
    detectedFields.push('budget');
  }

  if (/computer science|cs\b/.test(normalized)) {
    profile.major = 'Computer Science';
    detectedFields.push('major');
  } else if (/data science/.test(normalized)) {
    profile.major = 'Data Science';
    detectedFields.push('major');
  } else if (/ai\b|artificial intelligence/.test(normalized)) {
    profile.major = 'Artificial Intelligence';
    detectedFields.push('major');
  }

  if (/canada|ontario/.test(normalized)) {
    profile.preferredCountry = 'Canada';
    detectedFields.push('country');
  } else if (/united kingdom|uk|britain/.test(normalized)) {
    profile.preferredCountry = 'United Kingdom';
    detectedFields.push('country');
  } else if (/usa|united states|america/.test(normalized)) {
    profile.preferredCountry = 'United States';
    detectedFields.push('country');
  }

  if (/master(?:'s|s)?|msc\b|m\.sc/.test(normalized)) {
    profile.degreeLevel = 'master';
    detectedFields.push('degreeLevel');
  } else if (/phd|doctorate|doctoral/.test(normalized)) {
    profile.degreeLevel = 'phd';
    detectedFields.push('degreeLevel');
  } else if (/bachelor(?:'s|s)?|bs\b|b\.sc/.test(normalized)) {
    profile.degreeLevel = 'bachelor';
    detectedFields.push('degreeLevel');
  }

  const intakeMatch = transcript.match(/(?:intake|start(?:ing)?|semester|session)\s*(?:in|for)?\s*(20\d{2})/i);
  if (intakeMatch?.[1]) {
    profile.intakeYear = Number(intakeMatch[1]);
    detectedFields.push('intakeYear');
  }

  const gpaMatch = transcript.match(/(?:gpa|grade point average)\s*(?:is|around|about)?\s*(\d(?:\.\d)?)/i) ?? transcript.match(/(\d(?:\.\d)?)\s*(?:gpa|grade point average)/i);
  const gpaValue = Number(gpaMatch?.[1] ?? 0);
  if (gpaValue > 0 && gpaValue <= 4) {
    profile.gpa = gpaValue;
    detectedFields.push('gpa');
  }

  return {
    profile,
    detectedFields,
    confidence: Math.min(1, detectedFields.length / 5),
  };
}

async function transcribeAudioWithGemini(audioChunk: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return '';
  }

  const configuredModel = process.env.GEMINI_AUDIO_MODEL ?? process.env.GEMINI_MODEL;
  const model = configuredModel === 'gemini-2.0-flash' || !configuredModel
    ? 'gemini-3.8-flash'
    : configuredModel;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: 'Transcribe this counseling audio exactly. Return only the spoken words. If there is no clear speech, return an empty string. Do not invent or summarize.' },
          { inlineData: { mimeType, data: audioChunk } },
        ],
      }],
      generationConfig: { temperature: 0 },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429) {
      console.warn('[Gemini transcription] Rate limit reached; waiting for the provider quota window.');
      return '';
    }
    throw new Error(`Gemini transcription failed: ${response.status} ${detail}`);
  }

  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const transcript = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
  console.log(`[Gemini transcription] ${transcript || '[empty transcript]'}`);
  return transcript;
}

async function transcribeAudioChunk(audioChunk: string | undefined, mimeType = 'audio/webm'): Promise<string> {
  if (!audioChunk || Buffer.from(audioChunk, 'base64').length === 0) {
    return '';
  }

  if (process.env.GEMINI_API_KEY) {
    return transcribeAudioWithGemini(audioChunk, mimeType);
  }

  if (!audioChunk || !process.env.GROQ_API_KEY) {
    return '';
  }

  const binary = Buffer.from(audioChunk, 'base64');
  if (binary.length === 0) {
    return '';
  }

  const form = new FormData();
  form.append('file', new Blob([binary], { type: mimeType }), 'student-audio.webm');
  form.append('model', process.env.GROQ_MODEL ?? 'whisper-large-v3-turbo');
  form.append('language', 'en');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq transcription failed: ${response.status} ${detail}`);
  }

  const payload = await response.json() as { text?: string };
  const transcript = typeof payload.text === 'string' ? payload.text.trim() : '';
  console.log(`[Groq transcription] ${transcript || '[empty transcript]'}`);
  return transcript;
}

function coerceGeminiProfile(candidate: unknown): Partial<z.infer<typeof StudentProfileSchema>> {
  if (!candidate || typeof candidate !== 'object') {
    return {};
  }

  const parsed = candidate as Record<string, unknown>;
  const profile: Partial<z.infer<typeof StudentProfileSchema>> = {};

  const budget = typeof parsed.budget === 'number' ? parsed.budget : Number(parsed.budget ?? 0);
  if (budget > 0) {
    profile.budget = budget;
  }

  const major = typeof parsed.major === 'string' ? parsed.major : typeof parsed.field_of_study === 'string' ? parsed.field_of_study : undefined;
  if (major) {
    profile.major = major;
  }

  const preferredCountry = typeof parsed.preferredCountry === 'string'
    ? parsed.preferredCountry
    : typeof parsed.country === 'string'
      ? parsed.country
      : undefined;
  if (preferredCountry) {
    profile.preferredCountry = preferredCountry;
  }

  const degree = typeof parsed.degreeLevel === 'string' ? parsed.degreeLevel : typeof parsed.degree === 'string' ? parsed.degree : undefined;
  if (degree) {
    const normalizedDegree = degree.toLowerCase();
    if (normalizedDegree.includes('phd') || normalizedDegree.includes('doctorate')) {
      profile.degreeLevel = 'phd';
    } else if (normalizedDegree.includes('master') || normalizedDegree.includes('msc')) {
      profile.degreeLevel = 'master';
    } else if (normalizedDegree.includes('bachelor') || normalizedDegree.includes('bs')) {
      profile.degreeLevel = 'bachelor';
    }
  }

  const intakeYear = typeof parsed.intakeYear === 'number' ? parsed.intakeYear : Number(parsed.intake_year ?? 0);
  if (intakeYear >= 2024 && intakeYear <= 2030) {
    profile.intakeYear = intakeYear;
  }

  const gpa = typeof parsed.gpa === 'number' ? parsed.gpa : Number(parsed.gpa ?? 0);
  if (gpa > 0 && gpa <= 4) {
    profile.gpa = gpa;
  }

  return profile;
}

async function extractProfileWithGemini(transcript: string): Promise<Partial<z.infer<typeof StudentProfileSchema>>> {
  if (!process.env.GEMINI_API_KEY || !transcript.trim()) {
    return {};
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Extract a JSON object from the following student counseling transcript. Return ONLY valid JSON with keys: budget, major, preferredCountry, degreeLevel, intakeYear, gpa. Use plain English values or numeric values. If a field is missing, omit it.\n\nTranscript:\n${transcript}`,
        }],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini extraction failed: ${response.status}`);
  }

  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  };

  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  if (!rawText.trim()) {
    return {};
  }

  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return coerceGeminiProfile(JSON.parse(cleaned));
  } catch (error) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw error;
    }

    return coerceGeminiProfile(JSON.parse(match[0]));
  }
}

app.post(`${API_PREFIX}/transcribe`, async (req, res) => {
  const requestBody = typeof req.body === 'object' && req.body ? req.body as Record<string, unknown> : {};
  const segments = Array.isArray(requestBody.segments) ? requestBody.segments : [];
  const transcript = typeof requestBody.transcript === 'string' ? requestBody.transcript : '';
  const audioChunk = typeof requestBody.audioChunk === 'string' ? requestBody.audioChunk : typeof requestBody.audio === 'string' ? requestBody.audio : undefined;
  const audioChunks = Array.isArray(requestBody.audioChunks) ? requestBody.audioChunks.filter((value): value is string => typeof value === 'string') : [];
  const mimeType = typeof requestBody.mimeType === 'string' ? requestBody.mimeType : 'audio/webm';
  const mergedTranscript = mergeTranscriptSegments([transcript, ...segments]);
  const audioCount = audioChunks.length > 0 ? audioChunks.length : audioChunk ? 1 : 0;
  console.log(`[Transcription request] audioChunks=${audioCount} bytes=${audioChunk ? Buffer.from(audioChunk, 'base64').length : 0} mimeType=${mimeType} provider=${process.env.GEMINI_API_KEY ? 'gemini' : process.env.GROQ_API_KEY ? 'groq' : 'none'}`);

  if (!mergedTranscript && !audioChunk && audioChunks.length === 0) {
    return res.status(400).json({
      error: 'INVALID_TRANSCRIPT',
      message: 'A transcript string or audio chunk is required.',
    });
  }

  let finalTranscript = mergedTranscript;
  let source: 'gemini' | 'groq' | 'groq+gemini' | 'heuristic' = 'heuristic';

  try {
    const audioSegments: string[] = [];
    if (audioChunks.length > 0) {
      for (const chunk of audioChunks) {
        const chunkText = await transcribeAudioChunk(chunk, mimeType);
        if (chunkText.trim()) {
          audioSegments.push(chunkText);
        }
      }
    } else if (audioChunk) {
      const chunkText = await transcribeAudioChunk(audioChunk, mimeType);
      if (chunkText.trim()) {
        audioSegments.push(chunkText);
      }
    }

    if (audioSegments.length > 0) {
      finalTranscript = mergeTranscriptSegments([finalTranscript, ...audioSegments]);
      source = process.env.GEMINI_API_KEY ? 'gemini' : 'groq';
    }
  } catch (error) {
    console.warn(`${process.env.GEMINI_API_KEY ? 'Gemini' : 'Groq'} transcription failed, falling back to heuristic extraction:`, error);
  }

  if (!finalTranscript.trim()) {
    return res.status(400).json({
      error: 'INVALID_TRANSCRIPT',
      message: 'No transcript content could be extracted from the provided input.',
    });
  }

  let extracted = extractProfileFromTranscript(finalTranscript);

  try {
    if (process.env.GEMINI_API_KEY) {
      const geminiProfile = await extractProfileWithGemini(finalTranscript);
      if (Object.keys(geminiProfile).length > 0) {
        extracted = {
          profile: {
            ...extracted.profile,
            ...geminiProfile,
          },
          detectedFields: Array.from(new Set([...(extracted.detectedFields ?? []), ...Object.keys(geminiProfile)])),
          confidence: 0.96,
        };
        source = source === 'gemini' ? 'gemini' : 'groq+gemini';
      }
    }
  } catch (error) {
    console.warn('Gemini extraction failed, using heuristic profile fallback:', error);
  }

  return res.json({
    transcript: finalTranscript,
    autoFilled: Object.keys(extracted.profile).length > 0,
    confidence: Number(extracted.confidence.toFixed(2)),
    detectedFields: extracted.detectedFields,
    profile: extracted.profile,
    source,
  });
});

app.post(`${API_PREFIX}/recommend`, async (req, res) => {
  const parsed = StudentProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_PROFILE',
      message: 'Student profile is invalid.',
      details: parsed.error.flatten(),
    });
  }

  const profileData = {
    ...parsed.data,
    preferredCountry: normalizeCountry(parsed.data.preferredCountry),
  };

  try {
    const courses = await findCourses({
      major: profileData.major,
      preferredCountry: profileData.preferredCountry,
      degreeLevel: profileData.degreeLevel,
      budget: profileData.budget,
    });
    const results = hybridRecommendCourses(profileData, courses).slice(0, 10);

    return res.json({
      ...toRecommendationResponse(profileData, results),
      retrieval: 'hybrid',
      source: 'semantic+rule-based',
    });
  } catch (error: unknown) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'recommendation_query_failed',
      message: error instanceof Error ? error.message : 'Unknown database error',
    }));
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Recommendations are temporarily unavailable.',
    });
  }
});

app.post(`${API_PREFIX}/tradeoff`, async (req, res) => {
  const parsed = TradeoffSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_TRADEOFF',
      message: 'Tradeoff payload is invalid.',
      details: parsed.error.flatten(),
    });
  }

  const { profile, weights } = parsed.data;
  let catalog;
  try {
    catalog = await findCourses({
      major: profile.major,
      preferredCountry: normalizeCountry(profile.preferredCountry),
      degreeLevel: profile.degreeLevel,
      budget: profile.budget,
    });
  } catch (error: unknown) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'tradeoff_query_failed',
      message: error instanceof Error ? error.message : 'Unknown database error',
    }));
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Tradeoff recommendations are temporarily unavailable.',
    });
  }

  const results = hybridRecommendCourses(profile, catalog, weights ?? {});
  const ranked = results.map((result) => {
    const delta = Number((result.score - scoreCourse(result.course, profile).score).toFixed(4));
    return {
      ...result,
      delta,
      explanation: buildExplainability(profile, result.course),
    };
  });

  return res.json({
    student: profile,
    weights: weights ?? {},
    resultCount: ranked.length,
    results: ranked.map((item) => ({
      id: item.course.id,
      name: item.course.name,
      university: item.course.university,
      country: item.course.country,
      feesUsd: item.course.feesUsd,
      rank: item.course.rank,
      score: item.score,
      delta: item.delta,
      reasons: item.reasons,
      explanation: item.explanation,
    })),
  });
});

app.post(`${API_PREFIX}/explain`, (req, res) => {
  const parsed = ExplainSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_EXPLAIN_REQUEST',
      message: 'Explain payload is invalid.',
      details: parsed.error.flatten(),
    });
  }

  const { profile, courseId, topN = 5 } = parsed.data;
  const matches = hybridRecommendCourses(profile, courseCatalog, {}).slice(0, topN);
  const courseList = courseId
    ? matches.filter((item) => item.course.id === courseId)
    : matches;

  const explanations = courseList.map((item) => ({
    courseId: item.course.id,
    courseName: item.course.name,
    university: item.course.university,
    explanation: buildExplainability(profile, item.course),
  }));

  return res.json({
    student: profile,
    count: explanations.length,
    explanations,
  });
});

app.post(`${API_PREFIX}/chat`, async (req, res) => {
  const parsedRequest = ChatSchema.safeParse(req.body);
  if (!parsedRequest.success) {
    return res.status(400).json({
      error: 'INVALID_CHAT_REQUEST',
      message: 'Enter a natural-language course search.',
      details: parsedRequest.error.flatten(),
    });
  }

  const { query } = parsedRequest.data;
  let filters: z.infer<typeof ChatFiltersSchema> & { keyword?: string } = {};
  let source: 'openrouter' | 'gemini' | 'local-fallback' = 'local-fallback';

  const aiResult = await generateAIText(
    `Extract course search filters from this counselor query. Return ONLY one valid JSON object with exactly these optional keys: country (string), budget_max (number in USD), major (string), degree_level ("bachelor"|"master"|"phd"). Omit fields that are not stated or confidently implied. Convert currencies to USD when the currency is explicitly stated; if no currency is stated, use the number as USD. Do not include markdown or explanation.\n\nQuery: ${query}`,
  );

  try {
    if (!aiResult) {
      filters = extractChatFiltersLocally(query);
    } else {
      const cleaned = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      filters = ChatFiltersSchema.parse(JSON.parse(cleaned));
      source = aiResult.provider;
    }
  } catch (error) {
    console.warn('Chat filter extraction returned invalid JSON; using local parser:', error);
    filters = extractChatFiltersLocally(query);
  }

  const local = extractChatFiltersLocally(query);
  const normalizedCountry = normalizeCountry(filters.country ?? local.country);
  const finalDegree = filters.degree_level ?? local.degree_level;
  const finalBudget = filters.budget_max ?? local.budget_max;
  const finalMajor = filters.major ?? local.major;
  const finalKeyword = local.keyword ?? finalMajor;

  filters.country = normalizedCountry;
  filters.degree_level = finalDegree;
  filters.budget_max = finalBudget;
  filters.major = finalMajor;
  filters.keyword = finalKeyword;

  const courses = await findCourses({
    major: finalMajor,
    keyword: finalKeyword,
    preferredCountry: normalizedCountry,
    degreeLevel: finalDegree,
    budget: finalBudget,
  });

  const searchProfile = {
    budget: finalBudget ?? 50000,
    major: finalMajor || 'Computer Science',
    preferredCountry: normalizedCountry,
    degreeLevel: finalDegree ?? 'master',
    intakeYear: 2025,
    gpa: 3.5,
  };

  const scoredMatches = hybridRecommendCourses(searchProfile, courses).map((item) => ({
    id: item.course.id,
    name: item.course.name,
    university: item.course.university,
    country: item.course.country,
    feesUsd: item.course.feesUsd,
    rank: item.course.rank,
    score: item.score,
    reasons: item.reasons,
    explanation: buildExplainability(searchProfile, item.course),
  }));

  return res.json({
    query,
    filters,
    matches: scoredMatches,
    results: scoredMatches,
    recommendations: scoredMatches,
    source,
  });
});

app.post(`${API_PREFIX}/pitch`, async (req, res) => {
  const parsed = PitchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_PITCH_REQUEST',
      message: 'Pitch payload is invalid.',
      details: parsed.error.flatten(),
    });
  }

  const { profile, courseId, persona } = parsed.data;
  const matches = hybridRecommendCourses(profile, courseCatalog, {}).slice(0, 5);
  const courseList = courseId ? matches.filter((item) => item.course.id === courseId) : matches;

  const pitches = await Promise.all(courseList.map(async (item) => {
      const aiConfigured = process.env.AI_PROVIDER === 'openrouter'
        ? Boolean(process.env.OPENROUTER_API_KEY)
        : Boolean(process.env.GEMINI_API_KEY);
      const aiPitch = aiConfigured ? await generateAIPitch(profile, item.course, persona as PitchPersona) : buildPitch(profile, item.course, persona as PitchPersona);
    return {
      courseId: item.course.id,
      name: item.course.name,
      university: item.course.university,
      persona,
      pitch: aiPitch,
      source: aiConfigured
        ? (process.env.AI_PROVIDER === 'openrouter' ? 'openrouter' : 'gemini')
        : 'rule-based',
    };
  }));

  return res.json({
    student: profile,
    persona,
    count: pitches.length,
    pitches,
  });
});

app.post(`${API_PREFIX}/evaluate`, async (req, res) => {
  const parsed = EvaluationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_EVALUATION_REQUEST',
      message: 'Evaluation payload is invalid.',
      details: parsed.error.flatten(),
    });
  }

  const { profile, courseId, topN } = parsed.data;
  const matches = hybridRecommendCourses(profile, courseCatalog, {}).slice(0, topN);
  const courseList = courseId ? matches.filter((item) => item.course.id === courseId) : matches;

  const evaluations = await Promise.all(courseList.map(async (item) => {
    const fallback = buildCourseEvaluation(profile, item.course);
    const aiConfigured = process.env.AI_PROVIDER === 'openrouter'
      ? Boolean(process.env.OPENROUTER_API_KEY)
      : Boolean(process.env.GEMINI_API_KEY);
    const aiEvaluation = aiConfigured ? await evaluateCourseWithGemini(profile, item.course) : null;
    return {
      courseId: item.course.id,
      courseName: item.course.name,
      university: item.course.university,
      evaluation: aiEvaluation ?? fallback,
      source: aiEvaluation
        ? (process.env.AI_PROVIDER === 'openrouter' ? 'openrouter' : 'gemini')
        : 'rule-based',
    };
  }));

  return res.json({
    student: profile,
    count: evaluations.length,
    evaluations,
  });
});

app.get(`${API_PREFIX}/sessions`, async (req, res) => {
  const sessions = await listSessions(authenticatedUserId(req));

  return res.json({
    sessions: sessions.map(({ id, title, profile, results, created_at, updated_at }) => ({
      id,
      title,
      profile,
      results,
      createdAt: new Date(created_at).toISOString(),
      updatedAt: new Date(updated_at).toISOString(),
      encrypted: true,
    })),
  });
});

app.post(`${API_PREFIX}/session/save`, async (req, res) => {
  const parsed = SessionSaveSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_SESSION_REQUEST',
      message: 'Session payload is invalid.',
      details: parsed.error.flatten(),
    });
  }

  const sessionId = parsed.data.id || randomUUID();
  const ownerId = authenticatedUserId(req);
  const now = new Date();
  const payload = {
    id: sessionId,
    title: parsed.data.title,
    profile: parsed.data.profile,
    weights: parsed.data.weights,
    results: parsed.data.results,
    createdAt: now,
    updatedAt: now,
    ownerId,
  };

  const encrypted = encryptSession(payload);
  await saveSession({
    id: sessionId,
    title: parsed.data.title,
    profile: parsed.data.profile as Record<string, unknown>,
    results: parsed.data.results as Array<Record<string, unknown>>,
    encrypted,
    createdAt: now,
    updatedAt: now,
    ownerId,
  });

  return res.status(201).json({
    session: {
      id: sessionId,
      title: parsed.data.title,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      encrypted: true,
    },
  });
});

const handleLoadSessionRoute = async (req: express.Request, res: express.Response) => {
  const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await getSessionById(paramId, authenticatedUserId(req));

  if (!session) {
    return res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      message: 'Saved session was not found.',
    });
  }

  try {
    const decrypted = decryptSession(session.encrypted) as {
      id?: string;
      title?: string;
      profile?: z.infer<typeof StudentProfileSchema>;
      weights?: { budget: number; rank: number; location: number; intake: number; major: number; degree: number };
      results?: Array<{ id: number; name: string; university: string; country: string; feesUsd: number; rank: number; score: number; reasons: string[]; explanation?: string; }>;
      createdAt?: string;
      updatedAt?: string;
    };

    return res.json({
      session: {
        id: decrypted.id || session.id,
        title: decrypted.title || session.title,
        profile: decrypted.profile || session.profile,
        weights: decrypted.weights,
        results: decrypted.results || session.results,
        createdAt: decrypted.createdAt || new Date(session.created_at).toISOString(),
        updatedAt: decrypted.updatedAt || new Date(session.updated_at).toISOString(),
        encrypted: true,
      },
    });
  } catch (error) {
    console.warn('Failed to decrypt session, returning raw DB fields:', error);
    return res.json({
      session: {
        id: session.id,
        title: session.title,
        profile: session.profile,
        results: session.results,
        createdAt: new Date(session.created_at).toISOString(),
        updatedAt: new Date(session.updated_at).toISOString(),
        encrypted: false,
      },
    });
  }
};

app.get(`${API_PREFIX}/session/:id`, handleLoadSessionRoute);
app.get(`${API_PREFIX}/session/load/:id`, handleLoadSessionRoute);

app.delete(`${API_PREFIX}/session/:id`, async (req, res) => {
  const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = await deleteSession(paramId, authenticatedUserId(req));
  if (!deleted) {
    return res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      message: 'Session was not found or could not be deleted.',
    });
  }
  return res.json({ success: true, id: req.params.id });
});

const MagicLinkSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  profile: StudentProfileSchema,
  results: z.array(z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    university: z.string().min(1),
    country: z.string().min(1),
    feesUsd: z.number().min(0),
    rank: z.number().int().positive(),
    score: z.number().min(0),
    reasons: z.array(z.string()),
    explanation: z.string().optional(),
  })).default([]),
  expiresInHours: z.number().int().min(1).max(72).default(24),
});

const MagicLinkPdfUploadSchema = z.object({
  title: z.string().max(120).optional(),
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
  expiresInHours: z.number().int().min(1).max(1).default(1),
});

app.post(`${API_PREFIX}/magic-link/pdf`, async (req, res) => {
  const parsed = MagicLinkPdfUploadSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_PDF_UPLOAD_REQUEST',
      message: 'A valid PDF file and file name are required.',
      details: parsed.error.flatten(),
    });
  }

  const { fileName, fileBase64, title } = parsed.data;
  const cleanBase64 = fileBase64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:[^;]+;base64,/, '');
  const pdfBuffer = Buffer.from(cleanBase64, 'base64');

  if (!isPdfBuffer(pdfBuffer)) {
    return res.status(400).json({
      error: 'INVALID_PDF_FORMAT',
      message: 'The uploaded file does not have a valid PDF header (%PDF-).',
    });
  }

  if (pdfBuffer.length > 30 * 1024 * 1024) {
    return res.status(400).json({
      error: 'PDF_TOO_LARGE',
      message: 'Uploaded PDF exceeds maximum allowed limit of 30MB.',
    });
  }

  // Token for the magic link (cryptographically secure URL-safe base64)
  const token = randomBytes(24).toString('base64url');
  // Exactly 1 hour expiration as required
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  try {
    // Chunk PDF and encrypt each chunk using AES-256-GCM
    const { chunks, totalChunks, fileSize } = chunkAndEncryptPdf(pdfBuffer, token);
    const documentTitle = title?.trim() || fileName.replace(/\.[^/.]+$/, '');
    const ownerId = req.userId ?? null;

    await saveEncryptedPdf({
      token,
      title: documentTitle,
      fileName,
      fileSize,
      chunkSize: PDF_CHUNK_SIZE,
      totalChunks,
      expiresAt,
      ownerId,
      chunks,
    });

    const baseUrl = getMagicLinkBaseUrl(req);

    return res.status(201).json({
      token,
      title: documentTitle,
      fileName,
      fileSize,
      totalChunks,
      chunkSize: PDF_CHUNK_SIZE,
      encryption: 'AES-256-GCM',
      expiresAt: expiresAt.toISOString(),
      url: `${baseUrl}/${token}`,
      link: `${baseUrl}/${token}`,
    });
  } catch (error) {
    console.error('Failed to process and store encrypted PDF', error);
    return res.status(500).json({
      error: 'PDF_PROCESSING_FAILED',
      message: 'The PDF chunks could not be encrypted and stored in PostgreSQL.',
    });
  }
});

app.post(`${API_PREFIX}/magic-link`, async (req, res) => {
  const parsed = MagicLinkSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_MAGIC_LINK_REQUEST',
      message: 'Magic link payload is invalid.',
      details: parsed.error.flatten(),
    });
  }

  const { profile, results, expiresInHours, title } = parsed.data;
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  try {
    await createMagicLink({
      token,
      title: title ?? 'Graduate shortlist',
      profile: profile as Record<string, unknown>,
      results: results as Array<Record<string, unknown>>,
      expiresAt,
      ownerId: authenticatedUserId(req),
    });

    const baseUrl = getMagicLinkBaseUrl(req);

    return res.status(201).json({
      token,
      expiresAt: expiresAt.toISOString(),
      url: `${baseUrl}/${token}`,
      link: `${baseUrl}/${token}`,
    });
  } catch (error) {
    console.error('Failed to create magic link', error);
    return res.status(503).json({
      error: 'MAGIC_LINK_STORAGE_FAILED',
      message: 'The magic link could not be saved.',
    });
  }
});

app.get(`${API_PREFIX}/magic-link/:token`, async (req, res) => {
  const token = req.params.token;
  const link = await getMagicLinkByToken(token);

  if (!link) {
    return res.status(404).json({
      error: 'MAGIC_LINK_NOT_FOUND',
      message: 'That magic link could not be found or has expired.',
    });
  }

  if (new Date(link.expires_at).getTime() <= Date.now()) {
    await deleteMagicLink(token);
    return res.status(410).json({
      error: 'MAGIC_LINK_EXPIRED',
      message: 'This magic link has expired.',
    });
  }

  const pdf = await getMagicLinkPdfByToken(token);
  const remainingSeconds = Math.max(0, Math.floor((new Date(link.expires_at).getTime() - Date.now()) / 1000));

  return res.json({
    token: link.token,
    title: link.title,
    profile: link.profile,
    results: link.results,
    hasPdf: Boolean(pdf),
    pdf: pdf ? {
      fileName: pdf.file_name,
      fileSize: pdf.file_size,
      totalChunks: pdf.total_chunks,
      chunkSize: pdf.chunk_size,
      encryption: 'AES-256-GCM',
    } : null,
    createdAt: new Date(link.created_at).toISOString(),
    expiresAt: new Date(link.expires_at).toISOString(),
    remainingSeconds,
  });
});

app.get(`${API_PREFIX}/magic-link/:token/pdf`, async (req, res) => {
  const token = req.params.token;
  const pdf = await getMagicLinkPdfByToken(token);

  if (!pdf) {
    return res.status(404).json({
      error: 'PDF_NOT_FOUND',
      message: 'No encrypted PDF was found for this magic link token.',
    });
  }

  if (new Date(pdf.expires_at).getTime() <= Date.now()) {
    await deleteMagicLink(token);
    return res.status(410).json({
      error: 'MAGIC_LINK_EXPIRED',
      message: 'This magic link has expired.',
    });
  }

  try {
    const chunks = await getMagicLinkPdfChunks(pdf.id);
    if (!chunks || chunks.length === 0 || chunks.length !== pdf.total_chunks) {
      return res.status(500).json({
        error: 'CORRUPTED_PDF_STORAGE',
        message: 'Could not retrieve all encrypted chunks from database.',
      });
    }

    const decryptedBuffer = decryptAndAssemblePdf(chunks, token);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline; filename="protected.pdf"');

    return res.end(decryptedBuffer);
  } catch (error) {
    console.error('Failed to decrypt and assemble PDF', error);
    return res.status(500).json({
      error: 'PDF_DECRYPTION_FAILED',
      message: 'Failed to decrypt PDF document chunks.',
    });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`GradGuide backend listening on http://localhost:${PORT}`);
  });
}

export { app };
export default app;
