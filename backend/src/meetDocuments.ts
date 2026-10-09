import process from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'node:fs';
import { OAuth2Client } from 'google-auth-library';
import { authenticate } from '@google-cloud/local-auth';
import { generateAIText } from './recommend.js';

export type TranscriptEntry = {
  text: string;
  participant: string;
  startTime?: string;
  endTime?: string;
};

export type CounselingQuestion = {
  question: string;
  answer: string;
  askedBy: string;
  answeredBy: string;
};

export type CounselingAnalytics = {
  transcriptWordCount: number;
  transcriptDurationSeconds: number;
  questionCount: number;
  answerCount: number;
  averageAnswerWords: number;
  topics: string[];
};

export type MeetingAnalysis = {
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUps: string[];
  source: 'ai' | 'rule-based';
};

export type MeetingDocument = {
  id: string;
  conferenceRecordName: string;
  title: string;
  meetingUri?: string;
  transcript: TranscriptEntry[];
  questions: CounselingQuestion[];
  analytics: CounselingAnalytics;
  analysis: MeetingAnalysis;
  createdAt: string;
};

function fallbackAnalysis(entries: TranscriptEntry[], questions: CounselingQuestion[]): MeetingAnalysis {
  const text = entries.map((entry) => entry.text).join(' ');
  const lower = text.toLowerCase();
  const keyPoints = [
    lower.includes('japan') ? 'Japan was discussed as a study destination.' : '',
    lower.includes('budget') || lower.includes('rupees') ? 'A budget constraint was discussed.' : '',
    lower.includes('computer') ? 'Computer-related study options were discussed.' : '',
  ].filter(Boolean);
  return {
    summary: text.length > 240 ? `${text.slice(0, 237)}...` : text,
    keyPoints: keyPoints.length ? keyPoints : ['The transcript was captured and is ready for counselor review.'],
    recommendations: ['Verify the intended budget, degree level, intake year, and target programs before making a final shortlist.'],
    followUps: questions.length ? [] : ['Clarify the student’s questions and confirm the next counseling steps.'],
    source: 'rule-based',
  };
}

export async function analyzeMeeting(entries: TranscriptEntry[], questions: CounselingQuestion[]): Promise<MeetingAnalysis> {
  const fallback = fallbackAnalysis(entries, questions);
  const result = await generateAIText(`Analyze this counseling meeting transcript. Return only valid JSON with exactly these keys:
summary (string), keyPoints (array of strings), recommendations (array of strings), followUps (array of strings).
Do not invent universities, costs, admissions requirements, or facts not present in the transcript. Treat transcription errors as uncertain and recommend verification.

Transcript:
${entries.map((entry) => `${entry.participant}: ${entry.text}`).join('\n')}

Detected question/reply pairs:
${JSON.stringify(questions)}`);
  if (!result) return fallback;
  try {
    const jsonText = result.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(jsonText) as Partial<Omit<MeetingAnalysis, 'source'>>;
    if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.keyPoints) || !Array.isArray(parsed.recommendations) || !Array.isArray(parsed.followUps)) {
      return fallback;
    }
    return {
      summary: parsed.summary,
      keyPoints: parsed.keyPoints.filter((item): item is string => typeof item === 'string'),
      recommendations: parsed.recommendations.filter((item): item is string => typeof item === 'string'),
      followUps: parsed.followUps.filter((item): item is string => typeof item === 'string'),
      source: 'ai',
    };
  } catch (error) {
    console.warn('Meeting AI analysis returned invalid JSON; using deterministic analysis.', error);
    return fallback;
  }
}

const scopes = ['https://www.googleapis.com/auth/meetings.space.readonly'];

function getResolvedCredentialsPath(): string {
  if (process.env.GOOGLE_MEET_CREDENTIALS_PATH && fs.existsSync(process.env.GOOGLE_MEET_CREDENTIALS_PATH)) {
    return process.env.GOOGLE_MEET_CREDENTIALS_PATH;
  }
  // Render Secret Files location
  if (fs.existsSync('/etc/secrets/credentials.json')) {
    return '/etc/secrets/credentials.json';
  }
  // If credentials JSON is passed directly as environment variable
  if (process.env.GOOGLE_MEET_CREDENTIALS_JSON) {
    const tempPath = '/tmp/credentials.json';
    try {
      fs.writeFileSync(tempPath, process.env.GOOGLE_MEET_CREDENTIALS_JSON, 'utf-8');
      return tempPath;
    } catch {}
  }
  // Local project root
  const localRepoPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../credentials.json');
  if (fs.existsSync(localRepoPath)) {
    return localRepoPath;
  }
  const cwdPath = resolve(process.cwd(), 'credentials.json');
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  return localRepoPath;
}

type MeetAuthClient = {
  getAccessToken: () => Promise<{ token?: string | null }>;
};
let clientPromise: Promise<MeetAuthClient> | undefined;

async function getMeetClient(): Promise<MeetAuthClient> {
  if (!clientPromise) {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_MEET_REFRESH_TOKEN;
    const credsPath = getResolvedCredentialsPath();

    // 1. Headless Cloud Mode (Render / Railway / Docker with GOOGLE_REFRESH_TOKEN)
    if (refreshToken) {
      let clientId = process.env.GOOGLE_CLIENT_ID;
      let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if ((!clientId || !clientSecret) && fs.existsSync(credsPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
          const keys = parsed.installed || parsed.web || {};
          clientId = clientId || keys.client_id;
          clientSecret = clientSecret || keys.client_secret;
        } catch {}
      }

      if (clientId && clientSecret) {
        const oauth2Client = new OAuth2Client({
          clientId,
          clientSecret,
        });
        oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });
        clientPromise = Promise.resolve(oauth2Client);
        return clientPromise;
      }
    }

    // 2. Interactive desktop OAuth (Local environment)
    const authentication = authenticate({
      scopes,
      keyfilePath: credsPath,
    });

    clientPromise = Promise.race([
      authentication,
      new Promise<MeetAuthClient>((_, reject) => {
        setTimeout(() => reject(new Error(
          'Google OAuth timed out. Complete authorization in browser or configure GOOGLE_REFRESH_TOKEN for headless deployment.',
        )), 120_000);
      }),
    ]).catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}

async function meetRequest<T>(resource: string, params?: Record<string, string | number>): Promise<T> {
  const authClient = await getMeetClient();
  const accessToken = await authClient.getAccessToken();
  if (!accessToken.token) {
    throw new Error('Google Meet authorization did not return an access token.');
  }
  const url = new URL(`https://meet.googleapis.com/v2/${resource}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken.token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Meet API request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return response.json() as Promise<T>;
}

function extractMeetingCode(value: string): string | null {
  const match = value.match(/\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

async function resolveConferenceRecord(value: string): Promise<string> {
  if (value.startsWith('conferenceRecords/')) {
    return value;
  }

  const meetingCode = extractMeetingCode(value);
  if (!meetingCode) {
    throw new Error('Enter a Google Meet URL, meeting code, or conference record name.');
  }

  const response = await meetRequest<{ conferenceRecords?: Array<{ name?: string; startTime?: string }> }>('conferenceRecords', {
    filter: `space.meeting_code = "${meetingCode}"`,
    pageSize: 20,
  });
  const records = (response.conferenceRecords ?? []).filter(
    (record): record is { name: string; startTime?: string } => typeof record.name === 'string' && record.name.length > 0,
  );
  const latest = records.sort((left, right) => String(right.startTime ?? '').localeCompare(String(left.startTime ?? '')))[0];
  if (!latest) {
    throw new Error(
      `No completed conference record was found for meeting code "${meetingCode}". Confirm you are authorized to access that meeting and that it has ended.`,
    );
  }

  return latest.name;
}

function durationSeconds(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const value = (Date.parse(end) - Date.parse(start)) / 1000;
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function buildQuestions(entries: TranscriptEntry[]): CounselingQuestion[] {
  const questions: CounselingQuestion[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const current = entries[index];
    if (!/[?؟]$/.test(current.text.trim()) && !/^(how|what|when|where|which|can|could|would|is|are|do|does|will)\b/i.test(current.text.trim())) {
      continue;
    }

    const answer = entries.slice(index + 1, index + 4).find((entry) => entry.participant !== current.participant);
    questions.push({
      question: current.text,
      answer: answer?.text ?? 'No reply was captured in the transcript.',
      askedBy: current.participant,
      answeredBy: answer?.participant ?? 'Unknown',
    });
  }
  return questions;
}

function createParticipantLabeler(): (participant: string | undefined) => string {
  const labels = new Map<string, string>();
  return (participant) => {
    const key = participant?.trim() || 'unknown-participant';
    const existing = labels.get(key);
    if (existing) return existing;
    const label = `Participant ${labels.size + 1}`;
    labels.set(key, label);
    return label;
  };
}

function buildAnalytics(entries: TranscriptEntry[], questions: CounselingQuestion[]): CounselingAnalytics {
  const transcriptWordCount = entries.reduce((sum, entry) => sum + entry.text.split(/\s+/).filter(Boolean).length, 0);
  const answerWords = questions.map((item) => item.answer.split(/\s+/).filter(Boolean).length);
  const topics = ['budget', 'GPA', 'major', 'country', 'intake', 'application', 'scholarship']
    .filter((topic) => entries.some((entry) => entry.text.toLowerCase().includes(topic.toLowerCase())));
  return {
    transcriptWordCount,
    transcriptDurationSeconds: durationSeconds(entries[0]?.startTime, entries.at(-1)?.endTime),
    questionCount: questions.length,
    answerCount: questions.filter((item) => !item.answer.startsWith('No reply')).length,
    averageAnswerWords: answerWords.length ? Math.round(answerWords.reduce((sum, count) => sum + count, 0) / answerWords.length) : 0,
    topics,
  };
}

export function generateSampleMeetingDocument(): MeetingDocument {
  const entries: TranscriptEntry[] = [
    {
      participant: 'Participant 1',
      text: "Good morning, welcome to today's graduate study advising session. Let's discuss your master's degree plans for 2026.",
      startTime: '2026-10-09T10:00:00.000Z',
      endTime: '2026-10-09T10:00:15.000Z',
    },
    {
      participant: 'Participant 2',
      text: "Hello! I completed my B.Tech in Computer Science with an 8.6 GPA. I am looking to pursue an MS in Artificial Intelligence or Data Science in the US or Germany.",
      startTime: '2026-10-09T10:00:16.000Z',
      endTime: '2026-10-09T10:00:35.000Z',
    },
    {
      participant: 'Participant 1',
      text: "That is a strong GPA. What is your estimated annual budget for tuition and living expenses?",
      startTime: '2026-10-09T10:00:36.000Z',
      endTime: '2026-10-09T10:00:48.000Z',
    },
    {
      participant: 'Participant 2',
      text: "My budget is around $35,000 per year. For German public universities like TUM or RWTH Aachen, tuition is practically zero, which is very appealing, but I would also love US universities if scholarship or TA/RA options exist.",
      startTime: '2026-10-09T10:00:50.000Z',
      endTime: '2026-10-09T10:01:20.000Z',
    },
    {
      participant: 'Participant 1',
      text: "Have you taken the GRE or IELTS yet, or do you plan to waive the GRE?",
      startTime: '2026-10-09T10:01:22.000Z',
      endTime: '2026-10-09T10:01:32.000Z',
    },
    {
      participant: 'Participant 2',
      text: "I scored 7.5 on IELTS. I haven't taken the GRE yet, so universities with GRE waivers or optional submissions would save me several months of preparation.",
      startTime: '2026-10-09T10:01:33.000Z',
      endTime: '2026-10-09T10:01:55.000Z',
    },
    {
      participant: 'Participant 1',
      text: "Understood. Several top institutions like TUM, TU Delft, and select US state flagships waive the GRE. I will shortlist 6 programs balanced across Ambitious, Target, and Safe tiers for your review.",
      startTime: '2026-10-09T10:01:56.000Z',
      endTime: '2026-10-09T10:02:20.000Z',
    },
    {
      participant: 'Participant 2',
      text: "Can we also look into post-study work visa policies for both countries?",
      startTime: '2026-10-09T10:02:22.000Z',
      endTime: '2026-10-09T10:02:35.000Z',
    },
    {
      participant: 'Participant 1',
      text: "Yes, the US offers a 3-year STEM OPT extension, while Germany provides an 18-month job seeker permit after graduation with straightforward pathways to EU Blue Cards.",
      startTime: '2026-10-09T10:02:36.000Z',
      endTime: '2026-10-03:00.000Z',
    },
  ];

  const questions = buildQuestions(entries);
  return {
    id: '',
    conferenceRecordName: 'conferenceRecords/sample-counseling-session',
    title: 'Advising Session: Participant 2 (MS AI/CS)',
    transcript: entries,
    questions,
    analytics: buildAnalytics(entries, questions),
    analysis: {
      source: 'ai',
      summary: 'Advising session with Participant 2 (B.Tech CS, 8.6 GPA, IELTS 7.5) targeting MS in AI / Data Science in USA or Germany with a $35,000 budget and GRE-waived program preferences.',
      keyPoints: [
        'Academic background: B.Tech Computer Science, 8.6 GPA (~3.6/4.0 scale), IELTS 7.5.',
        'Target fields: Master in Artificial Intelligence or Data Science (Fall 2026).',
        'Budget limit: $35,000/year; high interest in tuition-free German universities (TUM, RWTH Aachen).',
        'Standardized testing: IELTS completed; seeking GRE-optional or waived universities.',
        'Career considerations: STEM OPT (USA 3-year) vs. German 18-month post-study work visa.',
      ],
      recommendations: [
        'Shortlist 6 programs balanced across USA (e.g. Purdue, ASU, Northeastern) and Germany (TUM, RWTH Aachen, TU Berlin).',
        'Highlight GRE-waived application deadlines for Fall 2026 priority considerations.',
        'Prepare SOP draft emphasizing AI research projects to qualify for department graduate assistantships (GA/TA).',
      ],
      followUps: [
        'Generate custom GradGuide recommendation shortlist for Participant 2.',
        'Send German blocked account and DAAD scholarship guidance document.',
        'Schedule follow-up review for SOP draft and transcript evaluation.',
      ],
    },
    createdAt: new Date().toISOString(),
  };
}

export async function createMeetingDocument(input: string): Promise<MeetingDocument> {
  const trimmed = input.trim();
  const conferenceRecordName = await resolveConferenceRecord(trimmed);
  const transcriptResponse = await meetRequest<{ transcripts?: Array<{ name?: string; state?: unknown; endTime?: string; startTime?: string }> }>(
    `${conferenceRecordName}/transcripts`,
    { pageSize: 20 },
  );
  const transcript = (transcriptResponse.transcripts ?? [])
    // The API represents transcript readiness as a state object in some
    // responses and an enum string in others. The entries endpoint is the
    // authoritative check that the generated artifact is readable.
    .filter((item) => typeof item.name === 'string' && item.name.length > 0)
    .sort((left, right) => String(right.endTime ?? '').localeCompare(String(left.endTime ?? '')))[0];

  if (!transcript?.name) {
    throw new Error('The meeting has no completed transcript artifact. Confirm transcription was enabled and wait for processing to finish.');
  }

  const entriesResponse = await meetRequest<{ transcriptEntries?: Array<{ text?: string; participant?: string; startTime?: string; endTime?: string }> }>(
    `${transcript.name}/entries`,
    { pageSize: 100 },
  );
  const labelParticipant = createParticipantLabeler();
  const entries: TranscriptEntry[] = (entriesResponse.transcriptEntries ?? [])
    .filter((entry) => typeof entry.text === 'string' && entry.text.trim())
    .map((entry) => ({
      text: entry.text!.trim(),
      participant: labelParticipant(entry.participant),
      startTime: entry.startTime ?? undefined,
      endTime: entry.endTime ?? undefined,
    }));
  if (entries.length === 0) {
    throw new Error('The transcript artifact exists but has no readable entries yet. Wait for Google Meet to finish processing it and try again.');
  }
  const questions = buildQuestions(entries);
  const analysis = await analyzeMeeting(entries, questions);

  return {
    id: '',
    conferenceRecordName,
    title: `Counseling meeting ${new Date().toLocaleDateString()}`,
    transcript: entries,
    questions,
    analytics: buildAnalytics(entries, questions),
    analysis,
    createdAt: new Date().toISOString(),
  };
}
