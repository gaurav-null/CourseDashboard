import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuth, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { PdfMagicLinkGenerator } from './PdfMagicLinkGenerator';
import { SecurePdfMagicViewer } from './SecurePdfMagicViewer';

type StudentProfile = {
  budget: number;
  major: string;
  preferredCountry: string;
  degreeLevel: string;
  intakeYear: number;
  gpa: number;
};

type ProfileForm = {
  budget: string;
  major: string;
  preferredCountry: string;
  degreeLevel: string;
  intakeYear: string;
  gpa: string;
};

type PitchPersona = 'student' | 'parent' | 'investor';
type ClerkTokenProvider = (options?: any) => Promise<string | null>;

type CourseRecommendation = {
  id: number;
  name: string;
  university: string;
  country: string;
  feesUsd: number;
  rank: number;
  score: number;
  delta?: number;
  explanation?: string;
  reasons: string[];
  selected?: boolean;
};

type TradeoffWeights = {
  budget: number;
  rank: number;
  location: number;
  intake: number;
  major: number;
  degree: number;
};

type PriorityKey = 'budget' | 'major' | 'location' | 'degree' | 'intake';

type MeetingDocument = {
  id: string;
  conferenceRecordName: string;
  title: string;
  transcript: Array<{ text: string; participant: string; startTime?: string; endTime?: string }>;
  questions: Array<{ question: string; answer: string; askedBy: string; answeredBy: string }>;
  analysis: { summary: string; keyPoints: string[]; recommendations: string[]; followUps: string[]; source: 'ai' | 'rule-based' };
  analytics: {
    transcriptWordCount: number;
    transcriptDurationSeconds: number;
    questionCount: number;
    answerCount: number;
    averageAnswerWords: number;
    topics: string[];
  };
  createdAt: string;
};

const initialProfile: ProfileForm = {
  budget: '',
  major: '',
  preferredCountry: '',
  degreeLevel: '',
  intakeYear: '',
  gpa: '',
};

const initialWeights: TradeoffWeights = {
  budget: 0,
  rank: 20,
  location: 0,
  intake: 0,
  major: 0,
  degree: 0,
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
let clerkToken = '';

function normalizeMeetingDocument(document: MeetingDocument): MeetingDocument {
  const analysis = document?.analysis ?? ({} as any);
  const analytics = document?.analytics ?? ({} as any);
  return {
    ...document,
    analytics: {
      transcriptWordCount: analytics.transcriptWordCount ?? 0,
      transcriptDurationSeconds: analytics.transcriptDurationSeconds ?? 0,
      questionCount: analytics.questionCount ?? 0,
      answerCount: analytics.answerCount ?? 0,
      averageAnswerWords: analytics.averageAnswerWords ?? 0,
      topics: Array.isArray(analytics.topics) ? analytics.topics : [],
    },
    transcript: Array.isArray(document?.transcript) ? document.transcript : [],
    questions: Array.isArray(document?.questions) ? document.questions : [],
    analysis: {
      summary: analysis.summary || 'This document has not been analyzed yet.',
      keyPoints: Array.isArray(analysis.keyPoints) ? analysis.keyPoints : [],
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
      followUps: Array.isArray(analysis.followUps) ? analysis.followUps : [],
      source: analysis.source === 'ai' ? 'ai' : 'rule-based',
    },
  };
}

  async function request<T>(getToken: (options?: any) => Promise<string | null>, path: string, payload: any): Promise<T> {
    let token = await getToken();
    if (!token) {
        throw new Error('Your Clerk session is not ready. Please sign in again.');
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const response = await fetch(`${BASE_URL}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(150_000),
            });
            if (response.status === 401 && attempt === 0) {
                token = await getToken({ skipCache: true });
                if (token)
                    continue;
            }
            if (!response.ok) {
                let message = `Request failed: ${response.status}`;
                try {
                    const body = (await response.json());
                    if (body.message)
                        message = body.message;
                    else if (body.error)
                        message = `${body.error} (${response.status})`;
                }
                catch (error) {
                    console.error('Failed to parse API error response', error);
                }
                throw new Error(message);
            }
            return (await response.json()) as T;
        }
        catch (error: any) {
            if (error instanceof DOMException && error.name === 'TimeoutError') {
                throw new Error('The request timed out. Please retry.');
            }
            if (attempt === 1) throw error;
        }
    }
    throw new Error('Your Clerk session is expired. Please sign in again.');
  }

  async function authenticatedGet<T>(getToken: (options?: any) => Promise<string | null>, path: string): Promise<T> {
    let token = await getToken();
    if (!token)
        throw new Error('Your Clerk session is not ready. Please sign in again.');
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(30_000),
        });
        if (response.status === 401 && attempt === 0) {
            token = await getToken({ skipCache: true });
            if (token)
                continue;
        }
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message ?? `Request failed: ${response.status}`);
        }
        return (await response.json()) as T;
    }
    throw new Error('Your Clerk session is expired. Please sign in again.');
  }

function PriorityCheckbox({ label, checked, disabled, onChange }: any) {
  return (
    <label className={`checkbox-label${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function PriorityField({ label, priorityLabel, checked, disabled, onPriorityChange, children
}: {
  label: string;
  priorityLabel: string;
  checked: boolean;
  disabled: boolean;
  onPriorityChange: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="priority-field">
      <label>
        {label}
        {children}
      </label>
      <PriorityCheckbox label={priorityLabel} checked={checked} disabled={disabled} onChange={onPriorityChange} />
    </div>
  );
}

export default function App() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [profile, setProfile] = useState<ProfileForm>(initialProfile);
  const [results, setResults] = useState<CourseRecommendation[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<number>>(new Set());
  const [tradeoffWeights, setTradeoffWeights] = useState<TradeoffWeights>(initialWeights);
  const [recommendationsGenerated, setRecommendationsGenerated] = useState(false);
  const [persona, setPersona] = useState<PitchPersona>('student');
  const [pitchMap, setPitchMap] = useState<Record<number, string>>({});
  const [selectedCourse, setSelectedCourse] = useState<CourseRecommendation | null>(null);
  const [pitchLoading, setPitchLoading] = useState<Record<number, boolean>>({});
  const [savedSessions, setSavedSessions] = useState<Array<{ id: string; title: string; createdAt: string; updatedAt: string }>>([]);
  const [sessionTitle, setSessionTitle] = useState('Arjun Sharma - Oct 7');
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionSaveSuccess, setSessionSaveSuccess] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [copiedCourseId, setCopiedCourseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [meetingInput, setMeetingInput] = useState('');
  const [meetingDocuments, setMeetingDocuments] = useState<MeetingDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<MeetingDocument | null>(null);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meetingError, setMeetingError] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [appError, setAppError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMatches, setChatMatches] = useState<CourseRecommendation[]>([]);
  const [chatFilters, setChatFilters] = useState<Record<string, unknown> | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const filteredResults = useMemo(() => {
    if (!filterQuery.trim()) return results;
    const q = filterQuery.toLowerCase();
    return results.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.university.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        ((c as any).fieldOfStudy && (c as any).fieldOfStudy.toLowerCase().includes(q))
    );
  }, [results, filterQuery]);

  const [magicToken, setMagicToken] = useState<string | null>(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/magic\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
    const search = new URLSearchParams(window.location.search);
    return search.get('magic');
  });

  useEffect(() => {
    const onPopState = () => {
      const match = window.location.pathname.match(/^\/magic\/([^/?#]+)/);
      if (match) {
        setMagicToken(decodeURIComponent(match[1]));
      } else {
        const search = new URLSearchParams(window.location.search);
        setMagicToken(search.get('magic'));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const getStudentProfile = (): StudentProfile | null => {
    if (!profile.budget || !profile.major.trim() || !profile.degreeLevel || !profile.intakeYear || !profile.gpa) {
      return null;
    }

    return {
      budget: Number(profile.budget),
      major: profile.major.trim(),
      preferredCountry: profile.preferredCountry.trim() || '',
      degreeLevel: profile.degreeLevel,
      intakeYear: Number(profile.intakeYear),
      gpa: Number(profile.gpa),
    };
  };

  const requireStudentProfile = (): StudentProfile | null => {
    const studentProfile = getStudentProfile();
    if (!studentProfile) {
      setAppError('Complete budget, major, degree level, intake year, and GPA before using this action.');
    }
    return studentProfile;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('google_auth');
    if (authStatus === 'success') {
      setGoogleConnected(true);
      setMeetingError('');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (authStatus === 'error') {
      const errDetail = params.get('google_error') || 'Access was not granted.';
      setMeetingError(`Google connection failed: ${errDetail}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkGoogleStatus = async (tokenProvider: ClerkTokenProvider = getToken) => {
    try {
      const payload = await authenticatedGet<{ connected?: boolean }>(tokenProvider, '/api/auth/google/status');
      setGoogleConnected(Boolean(payload.connected));
    } catch {
      // ignore
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setGoogleAuthLoading(true);
      setMeetingError('');
      const token = await getToken();
      const returnTo = window.location.origin;
      const res = await fetch(`${BASE_URL}/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to start Google sign-in.');
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setMeetingError(err instanceof Error ? err.message : 'Failed to connect Google account.');
      setGoogleAuthLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Disconnect your Google account from GradGuide?')) return;
    try {
      setGoogleAuthLoading(true);
      const token = await getToken();
      await fetch(`${BASE_URL}/api/auth/google/disconnect`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setGoogleConnected(false);
    } catch (err) {
      setMeetingError('Failed to disconnect Google account.');
    } finally {
      setGoogleAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      clerkToken = '';
      return;
    }
    void getToken().then((token) => {
      clerkToken = token ?? '';
      if (clerkToken) {
        void refreshSavedSessions(getToken);
        void refreshMeetingDocuments(getToken);
        void checkGoogleStatus(getToken);
      }
    });
  }, [getToken, isLoaded, isSignedIn]);

  const refreshMeetingDocuments = async (tokenProvider: ClerkTokenProvider = getToken) => {
    try {
      const payload = await authenticatedGet<{ documents?: MeetingDocument[] }>(tokenProvider, '/api/meeting-documents');
      setMeetingDocuments((payload.documents ?? []).map(normalizeMeetingDocument));
      void checkGoogleStatus(tokenProvider);
    } catch (error) {
      console.error('Failed to load meeting documents', error);
    }
  };

  const handleCreateMeetingDocument = async () => {
    const value = meetingInput.trim();
    if (!value) return;
    if (!googleConnected) {
      setMeetingError('Please click "Connect Google" above to authorize access to your Google Meet transcripts.');
      return;
    }
    setMeetingLoading(true);
    setMeetingError('');
    try {
      const payload = await request<{ document: MeetingDocument }>(getToken, `/api/meeting-documents`, { meeting: value });
      const document = normalizeMeetingDocument(payload.document);
      setMeetingDocuments((current) => [document, ...current.filter((d) => d.id !== document.id)]);
      setSelectedDocument(document);
      setMeetingInput('');
    } catch (error) {
      console.error('Meeting document creation failed', error);
      const msg = error instanceof Error ? error.message : 'Could not create the meeting document.';
      if (msg.includes('GOOGLE_MEET_NOT_CONNECTED')) {
        setGoogleConnected(false);
        setMeetingError('Please click "Connect Google" above to authorize your Google account.');
      } else {
        setMeetingError(msg);
      }
    } finally {
      setMeetingLoading(false);
    }
  };

  const handleDeleteMeetingDocument = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this meeting transcript document?')) return;
    try {
      let token = await getToken();
      const res = await fetch(`${BASE_URL}/api/meeting-documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMeetingDocuments((prev) => prev.filter((d) => d.id !== id));
        if (selectedDocument?.id === id) {
          setSelectedDocument(null);
        }
      } else {
        const body = await res.json().catch(() => ({}));
        setMeetingError(body.message ?? 'Failed to delete meeting document');
      }
    } catch (e) {
      console.error(e);
      setMeetingError('Failed to delete meeting document');
    }
  };

  const handleDownloadDocument = async () => {
    if (!selectedDocument) return;
    const response = await fetch(`${BASE_URL}/api/meeting-documents/${selectedDocument.id}/download`, {
      headers: { Authorization: `Bearer ${clerkToken}` },
    });
    if (!response.ok) {
      setMeetingError('The document download failed. Please sign in again and retry.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gradguide-meeting-${selectedDocument.id}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeMeetingDocument = async () => {
    if (!selectedDocument) return;
    setAnalysisLoading(true);
    setMeetingError('');
    try {
      const payload = await request<{ analysis: MeetingDocument['analysis'] }>(getToken, `/api/meeting-documents/${selectedDocument.id}/analyze`, {});
      const normalizedAnalysis: MeetingDocument['analysis'] = {
        summary: payload.analysis?.summary || 'Analysis complete.',
        keyPoints: Array.isArray(payload.analysis?.keyPoints) ? payload.analysis.keyPoints : [],
        recommendations: Array.isArray(payload.analysis?.recommendations) ? payload.analysis.recommendations : [],
        followUps: Array.isArray(payload.analysis?.followUps) ? payload.analysis.followUps : [],
        source: payload.analysis?.source === 'ai' ? 'ai' : 'rule-based',
      };
      setSelectedDocument((current) => current ? { ...current, analysis: normalizedAnalysis } : current);
      setMeetingDocuments((current) => current.map((item) => item.id === selectedDocument.id ? { ...item, analysis: normalizedAnalysis } : item));
    } catch (error) {
      setMeetingError(error instanceof Error ? error.message : 'Could not analyze the meeting document.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const explanationMap = useMemo(() => {
    const next = new Map<number, string>();
    for (const item of results) {
      if (item.explanation) {
        next.set(item.id, item.explanation);
      }
    }
    return next;
  }, [results]);

  const refreshSavedSessions = async (tokenProvider: any = getToken) => {
    try {
      const payload = await authenticatedGet<{ sessions: any[] }>(tokenProvider, '/api/sessions');
      setSavedSessions(payload.sessions ?? []);
    } catch (error) {
      console.error('Failed to load saved sessions', error);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handlePriorityChange = async (key: PriorityKey, enabled: boolean) => {
    const studentProfile = requireStudentProfile();
    if (!studentProfile) {
      return;
    }

    const weightKey = key === 'location' ? 'location' : key;
    const nextWeights = { ...tradeoffWeights, [weightKey]: enabled ? 100 : 0 };
    setTradeoffWeights(nextWeights);

    try {
      const payload = await request<{ results: CourseRecommendation[] }>(getToken, `/api/tradeoff`, {
        profile: studentProfile,
        weights: nextWeights,
      });

      setResults(payload.results ?? []);
    } catch (error) {
      console.error('Tradeoff refresh failed', error);
    }
  };

  const handleSubmit = async () => {
    const studentProfile = requireStudentProfile();
    if (!studentProfile) {
      return;
    }

    setLoading(true);
    setAppError('');

    try {
      const payload = await request<{ results: CourseRecommendation[] }>(getToken, `/api/recommend`, studentProfile);
      const explainPayload = await request<{ explanations: Array<{ courseId: number; explanation: string }> }>(getToken, `/api/explain`, {
        profile: studentProfile,
        topN: 5,
      });

      const mergedResults = (payload.results ?? []).map((course) => ({
        ...course,
        explanation: explainPayload.explanations.find((item) => item.courseId === course.id)?.explanation,
      }));

      setResults(mergedResults);
      setRecommendationsGenerated(true);
    } catch (error) {
      console.error(error);
      setAppError(error instanceof Error ? error.message : 'Could not load recommendations.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) {
      setAppError('Enter a natural-language course search first.');
      return;
    }
    setChatLoading(true);
    setAppError('');
    try {
      const payload = await request<{ filters: any; matches: any[]; results?: any[] }>(getToken, `/api/chat`, { query: chatInput });
      setChatFilters(payload.filters);
      const searchResults = payload.results ?? payload.matches ?? [];
      setChatMatches(searchResults);

      if (searchResults.length > 0) {
        setResults(searchResults);
        setRecommendationsGenerated(true);
      }

      // Auto-update student profile from recognized search filters
      if (payload.filters) {
        setProfile((prev) => ({
          ...prev,
          budget: payload.filters.budget_max ? String(payload.filters.budget_max) : prev.budget,
          major: payload.filters.major ? String(payload.filters.major) : prev.major,
          preferredCountry: payload.filters.country ? String(payload.filters.country) : prev.preferredCountry,
          degreeLevel: payload.filters.degree_level ?? prev.degreeLevel,
        }));
      }
    } catch (error: any) {
      setAppError(error instanceof Error ? error.message : 'Could not search courses.');
      setChatMatches([]);
      setChatFilters(null);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGeneratePitch = async (courseId: number) => {
    const studentProfile = getStudentProfile();
    if (!studentProfile) {
      return;
    }
    setPitchLoading((current) => ({ ...current, [courseId]: true }));
    try {
      const payload = await request<{ pitches: any[] }>(getToken, `/api/pitch`, {
        profile: studentProfile,
        courseId,
        persona,
      });
      const nextPitch = payload.pitches?.[0]?.pitch ?? '';
      if (nextPitch) {
        setPitchMap((current) => ({ ...current, [courseId]: nextPitch }));
      }
    } catch (error) {
      console.error('Pitch generation failed', error);
    } finally {
      setPitchLoading((current) => ({ ...current, [courseId]: false }));
    }
  };

  const handleSelectCourse = (courseId: number, selected: boolean) => {
    setSelectedCourseIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(courseId);
      } else {
        next.delete(courseId);
      }
      return next;
    });
  };

  const handleCopyPitch = async (courseId: number) => {
    const text = pitchMap[courseId];
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCourseId(courseId);
      window.setTimeout(() => setCopiedCourseId(null), 1200);
    } catch (error) {
      console.error('Copy failed', error);
    }
  };

  const handleSaveSession = async () => {
    const studentProfile = requireStudentProfile();
    if (!studentProfile) {
      return;
    }

    setSessionSaving(true);
    setAppError('');
    setSessionSaveSuccess('');

    try {
      const payload = await request<{ session: { id: string; title: string } }>(getToken, `/api/session/save`, {
        id: activeSessionId || undefined,
        title: sessionTitle || `${studentProfile.major} Session`,
        profile: studentProfile,
        weights: tradeoffWeights,
        results: (results ?? []).map((course) => ({
          ...course,
          selected: selectedCourseIds.has(course.id),
        })),
      });
      setActiveSessionId(payload.session.id);
      setSessionSaveSuccess(`Saved "${payload.session.title}" successfully!`);
      setTimeout(() => setSessionSaveSuccess(''), 4000);
      await refreshSavedSessions();
    } catch (error) {
      console.error('Session save failed', error);
      setAppError(error instanceof Error ? error.message : 'Could not save the session.');
    } finally {
      setSessionSaving(false);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    setAppError('');
    try {
      const payload = await authenticatedGet<{ session: any }>(getToken, `/api/session/${sessionId}`);
      const session = payload.session;
      if (!session) return;
      setActiveSessionId(session.id);
      if (session.title) {
        setSessionTitle(session.title);
      }

      if (session.profile) {
        setProfile({
          budget: session.profile.budget != null ? String(session.profile.budget) : '',
          major: session.profile.major ?? '',
          preferredCountry: session.profile.preferredCountry ?? '',
          degreeLevel: session.profile.degreeLevel ?? '',
          intakeYear: session.profile.intakeYear != null ? String(session.profile.intakeYear) : '',
          gpa: session.profile.gpa != null ? String(session.profile.gpa) : '',
        });
      }

      if (session.weights) {
        setTradeoffWeights({ ...initialWeights, ...session.weights });
      }

      if (session.results) {
        setResults(session.results);
        setRecommendationsGenerated(session.results.length > 0);
        setSelectedCourseIds(new Set(session.results.filter((course: any) => course.selected).map((course: any) => course.id)));
      }
      setSessionSaveSuccess(`Loaded session "${session.title}"`);
      setTimeout(() => setSessionSaveSuccess(''), 3000);
    } catch (error) {
      console.error('Session load failed', error);
      setAppError(error instanceof Error ? error.message : 'Could not load the saved session.');
    }
  };

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const token = await getToken();
      await fetch(`${BASE_URL}/api/session/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
      await refreshSavedSessions();
    } catch (error) {
      console.error('Failed to delete session', error);
      setAppError('Failed to delete session.');
    }
  };

  const handleNewSession = () => {
    setActiveSessionId(null);
    setSessionTitle(`Client Session - ${new Date().toLocaleDateString()}`);
    setProfile(initialProfile);
    setResults([]);
    setRecommendationsGenerated(false);
    setSelectedCourseIds(new Set());
    setTradeoffWeights(initialWeights);
    setSessionSaveSuccess('Started new session.');
    setTimeout(() => setSessionSaveSuccess(''), 2500);
  };

  if (magicToken) {
    return (
      <SecurePdfMagicViewer
        token={magicToken}
        onExit={() => {
          setMagicToken(null);
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  if (!isLoaded) return <main className="auth-shell">Loading sign-in...</main>;

  return (
    <>
      <SignedOut>
        <main className="auth-shell">
          <h1>GradGuide Counselor Dashboard</h1>
          <p>Sign in to keep your clients, sessions, and meeting documents private.</p>
          <SignInButton mode="modal">
            <button className="primary-button">Sign in with Clerk</button>
          </SignInButton>
        </main>
      </SignedOut>
      <SignedIn>
        <header className="account-bar">
          <div className="account-bar-brand">
            <span className="brand-dot" />
            GradGuide
          </div>
          <span>Private Counselor Workspace</span>
          <UserButton />
        </header>

        {appError ? <div className="global-error" role="alert">{appError}</div> : null}

        <main className="page-shell">
          {/* Panel 1: Profile & Constraints */}
          <section className="panel form-panel">
            <div className="section-header">
              <h2>🎯 Student Profile</h2>
              {recommendationsGenerated ? <span className="chip accent">Active Match</span> : null}
            </div>

            <div className="field-grid">
              <PriorityField
                label="Budget (USD / Year)"
                priorityLabel="Prioritize"
                checked={tradeoffWeights.budget > 0}
                disabled={!recommendationsGenerated}
                onPriorityChange={(enabled) => void handlePriorityChange('budget', enabled)}
              >
                <input
                  name="budget"
                  type="number"
                  value={profile.budget}
                  onChange={handleChange}
                  placeholder="e.g. 40000"
                />
              </PriorityField>

              <PriorityField
                label="Major / Field of Study"
                priorityLabel="Prioritize"
                checked={tradeoffWeights.major > 0}
                disabled={!recommendationsGenerated}
                onPriorityChange={(enabled) => void handlePriorityChange('major', enabled)}
              >
                <input
                  name="major"
                  value={profile.major}
                  onChange={handleChange}
                  placeholder="e.g. Computer Science"
                />
              </PriorityField>

              <PriorityField
                label="Preferred Country"
                priorityLabel="Prioritize"
                checked={tradeoffWeights.location > 0}
                disabled={!recommendationsGenerated}
                onPriorityChange={(enabled) => void handlePriorityChange('location', enabled)}
              >
                <input
                  name="preferredCountry"
                  value={profile.preferredCountry}
                  onChange={handleChange}
                  placeholder="e.g. United Kingdom"
                />
              </PriorityField>

              <PriorityField
                label="Degree Level"
                priorityLabel="Prioritize"
                checked={tradeoffWeights.degree > 0}
                disabled={!recommendationsGenerated}
                onPriorityChange={(enabled) => void handlePriorityChange('degree', enabled)}
              >
                <select name="degreeLevel" value={profile.degreeLevel} onChange={handleChange}>
                  <option value="">Select degree level</option>
                  <option value="bachelor">Bachelor's</option>
                  <option value="master">Master's</option>
                  <option value="phd">PhD</option>
                </select>
              </PriorityField>

              <PriorityField
                label="Intake Year"
                priorityLabel="Prioritize"
                checked={tradeoffWeights.intake > 0}
                disabled={!recommendationsGenerated}
                onPriorityChange={(enabled) => void handlePriorityChange('intake', enabled)}
              >
                <input
                  name="intakeYear"
                  type="number"
                  value={profile.intakeYear}
                  onChange={handleChange}
                  placeholder="e.g. 2025"
                />
              </PriorityField>

              <label>
                GPA (0.0 - 4.0 Scale)
                <input
                  name="gpa"
                  type="number"
                  step="0.1"
                  min="0"
                  max="4"
                  value={profile.gpa}
                  onChange={handleChange}
                  placeholder="e.g. 3.5"
                />
              </label>
            </div>

            <div className="profile-actions">
              <button className="primary-button" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Finding Best Programs...' : '⚡ Get Recommendations'}
              </button>
            </div>
          </section>

          {/* Panel 2: Live Ranked Recommendations */}
          <section className="panel results-panel">
            <div className="section-header">
              <h2>🎓 Recommendations</h2>
              {results.length > 0 ? (
                <span className="chip accent">{filteredResults.length} / {results.length} Ranked</span>
              ) : (
                <span className="chip">Awaiting Input</span>
              )}
            </div>

            {results.length > 0 ? (
              <div style={{ marginBottom: '1rem' }}>
                <input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="🔍 Filter recommendations by university, course, or country..."
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>
            ) : null}

            {results.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📋</span>
                <strong>No recommendations generated yet</strong>
                <span>Fill in student budget, GPA, and major on the left, click "Get Recommendations", or use the NLP Course Search below.</span>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="empty-state">
                <span>No recommendations matched "{filterQuery}". Try a different keyword.</span>
              </div>
            ) : (
              <div className="results-list">
                {filteredResults.map((course) => (
                  <button
                    type="button"
                    className="course-card"
                    key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    aria-label={`View details for ${course.name} at ${course.university}`}
                  >
                    <div className="course-header">
                      <div>
                        <label className="course-select" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedCourseIds.has(course.id)}
                            onChange={(event) => handleSelectCourse(course.id, event.target.checked)}
                            aria-label={`Select ${course.name}`}
                          />
                          <span>Shortlist</span>
                        </label>
                        <h3>{course.name}</h3>
                        <p>{course.university}</p>
                      </div>
                      <div className="score-stack">
                        <span className="score-badge">{course.score.toFixed(2)}</span>
                        {typeof course.delta === 'number' ? (
                          <span className="delta-badge">{course.delta >= 0 ? '+' : ''}{course.delta.toFixed(2)}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="meta-row">
                      <span className="course-pill country-pill">{course.country}</span>
                      <span className="course-pill fee-pill">${course.feesUsd.toLocaleString()}</span>
                      <span className="course-pill rank-pill">Rank #{course.rank}</span>
                    </div>
                    <span className="card-hint">Click card to view detailed fit & AI pitch →</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Panel 3: Natural Language Course Search */}
          <section className="panel chat-panel">
            <div className="section-header">
              <h2>💬 NLP Course Search</h2>
              <span className="chip">Semantic</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Describe program criteria in plain English. Matching programs automatically update your recommendations.
            </p>
            <div className="chat-input-row">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleChat();
                }}
                placeholder="e.g. Data science in UK under £35k or MIT CS"
                aria-label="Natural-language course search"
              />
              <button
                type="button"
                className="primary-button compact"
                onClick={() => void handleChat()}
                disabled={chatLoading}
              >
                {chatLoading ? '...' : 'Search'}
              </button>
            </div>
            {chatFilters ? (
              <p className="chat-summary">
                Filters: {Object.entries(chatFilters).filter(([_, v]) => v != null).map(([key, value]) => `${key.replace('_', ' ')}=${String(value)}`).join(' · ')}
              </p>
            ) : null}
            {chatMatches.length > 0 ? (
              <div className="chat-match-list" style={{ marginTop: '0.75rem', flex: 1, overflowY: 'auto' }}>
                {chatMatches.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    className="course-card"
                    onClick={() => setSelectedCourse(course)}
                    style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
                  >
                    <div className="course-header">
                      <div>
                        <label className="course-select" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedCourseIds.has(course.id)}
                            onChange={(event) => handleSelectCourse(course.id, event.target.checked)}
                            aria-label={`Select ${course.name}`}
                          />
                          <span>Shortlist</span>
                        </label>
                        <h3>{course.name}</h3>
                        <p>{course.university}</p>
                      </div>
                      {typeof course.score === 'number' && course.score > 0 ? (
                        <div className="score-stack">
                          <span className="score-badge">{course.score.toFixed(2)}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="meta-row">
                      <span className="course-pill country-pill">{course.country}</span>
                      <span className="course-pill fee-pill">${course.feesUsd.toLocaleString()}</span>
                      <span className="course-pill rank-pill">Rank #{course.rank}</span>
                    </div>
                    {course.reasons && course.reasons.length > 0 ? (
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-primary)', marginTop: '0.35rem', marginBottom: 0 }}>
                        ✓ {course.reasons[0]}
                      </p>
                    ) : null}
                    <span className="card-hint">Click card to view detailed fit & AI pitch →</span>
                  </button>
                ))}
              </div>
            ) : chatFilters ? (
              <div className="empty-state" style={{ flex: 1 }}>
                <span>No courses matched those filters. Try adjusting your query.</span>
              </div>
            ) : (
              <div className="empty-state" style={{ flex: 1 }}>
                <span className="empty-state-icon">💬</span>
                <strong>Semantic Query Search</strong>
                <span>Search programs by budget, location, or subject in natural language.</span>
              </div>
            )}
          </section>

          {/* Lower Row: Secure PDF Magic Link Generator, Saved Sessions, and Meeting Transcripts next to each other */}
          <div className="bottom-panels-row">
            {/* Panel 4: PDF Magic Link Generator (Chunked + AES-256 + 1-Hour Ephemeral) */}
            <PdfMagicLinkGenerator
              onOpenViewer={(token) => {
                setMagicToken(token);
                window.history.pushState({}, '', `/magic/${token}`);
              }}
              getToken={getToken}
            />

            {/* Panel 5: Saved Counseling Sessions */}
            <section className="panel session-panel">
              <div className="section-header">
                <h2>💾 Saved Sessions</h2>
                <span className="chip">{savedSessions.length} Saved</span>
              </div>

              {activeSessionId ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', background: 'rgba(220, 30, 42, 0.1)', border: '1px solid #333333', padding: '0.4rem 0.75rem', borderRadius: 0 }}>
                  <span style={{ fontSize: '0.78rem', color: '#dc1e2a' }}>● Active Session Loaded</span>
                  <button
                    type="button"
                    className="secondary-button compact"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={handleNewSession}
                  >
                    + New Session
                  </button>
                </div>
              ) : null}

              {sessionSaveSuccess ? (
                <div style={{ padding: '0.4rem 0.75rem', marginBottom: '0.75rem', background: 'rgba(16, 185, 129, 0.12)', color: '#6ee7b7', border: '1px solid #333333', borderRadius: 0, fontSize: '0.8rem' }}>
                  ✓ {sessionSaveSuccess}
                </div>
              ) : null}

              <div className="session-save-row">
                <input
                  value={sessionTitle}
                  onChange={(event) => setSessionTitle(event.target.value)}
                  placeholder="Session client name"
                />
                <button
                  className="primary-button compact"
                  onClick={() => void handleSaveSession()}
                  disabled={sessionSaving}
                >
                  {sessionSaving ? 'Saving...' : activeSessionId ? 'Update' : 'Save'}
                </button>
              </div>

              {savedSessions.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">📁</span>
                  <span>No sessions saved yet.</span>
                </div>
              ) : (
                <div className="session-card-list">
                  {savedSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`bento-card ${activeSessionId === session.id ? 'active' : ''}`}
                      onClick={() => void handleLoadSession(session.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="bento-card-header">
                        <span className="bento-card-title">{session.title}</span>
                        <button
                          type="button"
                          className="bento-delete-btn"
                          title="Delete session"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteSession(session.id, e);
                          }}
                        >
                          🗑
                        </button>
                      </div>

                      <div className="bento-card-body">
                        <div className="bento-card-meta">
                          {activeSessionId === session.id ? (
                            <span className="bento-badge active-badge">● Active Loaded</span>
                          ) : (
                            <span className="bento-badge">🔒 Encrypted Profile</span>
                          )}
                          <span className="bento-badge">Client Dossier</span>
                        </div>
                      </div>

                      <div className="bento-card-footer">
                        <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                        <span style={{ color: activeSessionId === session.id ? '#dc1e2a' : 'inherit', fontWeight: 600 }}>
                          {activeSessionId === session.id ? 'In Workspace ✓' : 'Click to Load →'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Panel 6: Meeting Documents & Google Meet Artifacts */}
            <section className="panel documents-panel">
              <div className="section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2>🎙️ Meeting Transcripts</h2>
                  {googleConnected ? (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '9999px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontWeight: 600,
                      }}
                      title="Google Meet account connected"
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                      Connected
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {googleConnected ? (
                    <button
                      type="button"
                      className="secondary-button compact"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', opacity: 0.8 }}
                      onClick={() => void handleDisconnectGoogle()}
                      disabled={googleAuthLoading}
                      title="Disconnect Google account"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button compact"
                      style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        borderColor: '#4285f4',
                        color: '#4285f4',
                        fontWeight: 500,
                      }}
                      onClick={() => void handleConnectGoogle()}
                      disabled={googleAuthLoading}
                      title="Authorize your Google account to read Meet transcripts"
                    >
                      <span>🔗</span> {googleAuthLoading ? 'Connecting...' : 'Connect Google'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary-button compact"
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                    onClick={() => void refreshMeetingDocuments(getToken)}
                    title="Refresh meeting documents"
                  >
                    🔄
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Generate an analyzed counseling dossier from a completed Meet transcript.
              </p>
              <div className="session-save-row">
                <input
                  value={meetingInput}
                  onChange={(event) => setMeetingInput(event.target.value)}
                  placeholder="Paste Google Meet URL or meeting code"
                  aria-label="Google Meet URL or meeting code"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateMeetingDocument();
                  }}
                />
                <button
                  className="primary-button compact"
                  onClick={() => void handleCreateMeetingDocument()}
                  disabled={meetingLoading}
                >
                  {meetingLoading ? 'Processing...' : 'Generate'}
                </button>
              </div>
              {meetingError ? <p className="error-message">{meetingError}</p> : null}
              {meetingDocuments.length > 0 ? (
                <div className="document-card-list">
                  {meetingDocuments.map((document) => (
                    <div
                      key={document.id}
                      className={`bento-card ${selectedDocument?.id === document.id ? 'active' : ''}`}
                      onClick={() => setSelectedDocument(document)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="bento-card-header">
                        <span className="bento-card-title">{document.title}</span>
                        <button
                          type="button"
                          className="bento-delete-btn"
                          title="Delete meeting transcript"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteMeetingDocument(document.id, e);
                          }}
                        >
                          🗑
                        </button>
                      </div>

                      <div className="bento-card-body">
                        <div className="bento-card-meta">
                          <span className="bento-badge">❓ {document.analytics.questionCount} Questions</span>
                          <span className="bento-badge">📝 {document.analytics.transcriptWordCount} Words</span>
                          {document.analysis?.recommendations?.length ? (
                            <span className="bento-badge">🎯 {document.analysis.recommendations.length} Recommendations</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="bento-card-footer">
                        <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                        <span style={{ color: selectedDocument?.id === document.id ? '#dc1e2a' : 'inherit', fontWeight: 600 }}>
                          {selectedDocument?.id === document.id ? 'Viewing Popup ↗' : 'Inspect Dossier ↗'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-icon">📄</span>
                  <span>No meeting documents generated yet. Enter a Google Meet URL above to analyze.</span>
                </div>
              )}
            </section>
          </div>

          {/* Meeting Document Transcript & Analysis Modal Popup */}
          {selectedDocument && (
            <div className="modal-overlay" onClick={() => setSelectedDocument(null)}>
              <div className="meeting-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <p className="modal-eyebrow">Google Meet Advising Dossier</p>
                    <h2>📑 {selectedDocument.title}</h2>
                    <p className="modal-university">
                      Recorded {new Date(selectedDocument.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setSelectedDocument(null)}
                    aria-label="Close transcript modal"
                  >
                    ✕
                  </button>
                </div>

                <div className="analytics-grid">
                  <span><strong>{selectedDocument.analytics?.questionCount ?? 0}</strong> Questions Asked</span>
                  <span><strong>{selectedDocument.analytics?.answerCount ?? 0}</strong> Replies Given</span>
                  <span><strong>{selectedDocument.analytics?.transcriptWordCount ?? 0}</strong> Word Count</span>
                  <span><strong>{selectedDocument.analytics?.averageAnswerWords ?? 0}</strong> Avg Reply Words</span>
                </div>

                <div className="document-analysis">
                  <div className="section-header">
                    <h3>AI Meeting Analysis</h3>
                    <span className="chip accent">
                      {selectedDocument.analysis?.source === 'ai' ? '✨ Gemini AI' : 'Rule-based'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="secondary-button compact"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => void handleAnalyzeMeetingDocument()}
                    disabled={analysisLoading}
                  >
                    {analysisLoading ? 'Analyzing...' : '⚡ Re-run AI Analysis'}
                  </button>
                  <p>{selectedDocument.analysis?.summary ?? 'No summary available.'}</p>
                  <h4>Key Action Points</h4>
                  <ul>{(selectedDocument.analysis?.keyPoints ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                  <h4>Counselor Recommendations</h4>
                  <ul>{(selectedDocument.analysis?.recommendations ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                  <h4>Suggested Follow-ups</h4>
                  <ul>{(selectedDocument.analysis?.followUps ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => void handleDownloadDocument()}
                  >
                    📥 Download Word Document (.doc)
                  </button>
                  {(selectedDocument.analytics?.topics ?? []).length > 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Identified Topics: <strong>{(selectedDocument.analytics?.topics ?? []).join(' · ')}</strong>
                    </span>
                  ) : null}
                </div>

                <div className="meeting-modal-section">
                  <h3>Questions & Responses</h3>
                  {(selectedDocument.questions ?? []).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem' }}>
                      {(selectedDocument.questions ?? []).map((item, index) => (
                        <article className="question-card" key={`${item.question}-${index}`}>
                          <strong style={{ color: 'var(--color-primary)' }}>Q: {item.question}</strong>
                          <p style={{ marginTop: '0.25rem' }}>A: {item.answer}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">No question-shaped exchanges were detected in this transcript.</p>
                  )}
                </div>

                <div className="meeting-modal-section">
                  <h3>Raw Transcript</h3>
                  <div className="transcript-box" style={{ marginTop: '0.4rem', maxHeight: '220px' }}>
                    {(selectedDocument.transcript ?? []).map((entry, index) => (
                      <p key={`${entry.participant}-${index}`}>
                        <strong>{entry.participant}:</strong> {entry.text}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Course Details & Persona Pitch Modal */}
          {selectedCourse && (
            <div className="modal-overlay" onClick={() => setSelectedCourse(null)}>
              <div className="course-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <p className="modal-eyebrow">Program Details & AI Pitch</p>
                    <h2>{selectedCourse.name}</h2>
                    <p className="modal-university">{selectedCourse.university} • {selectedCourse.country}</p>
                  </div>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setSelectedCourse(null)}
                    aria-label="Close modal"
                  >
                    ✕
                  </button>
                </div>

                <div className="modal-meta">
                  <span className="course-pill country-pill">🌍 {selectedCourse.country}</span>
                  <span className="course-pill fee-pill">Tuition: ${selectedCourse.feesUsd.toLocaleString()}</span>
                  <span className="course-pill rank-pill">Rank #{selectedCourse.rank}</span>
                  <span className="course-pill score-pill">Fit Score: {selectedCourse.score.toFixed(2)}</span>
                </div>

                <div className="modal-details">
                  <h3>Match Analysis</h3>
                  <ul>
                    {selectedCourse.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                  {selectedCourse.explanation && (
                    <p className="explanation">{selectedCourse.explanation}</p>
                  )}
                </div>

                <div className="modal-persona">
                  <span className="modal-label">Generate Tailored Pitch for:</span>
                  <div className="persona-row">
                    {(['student', 'parent', 'investor'] as PitchPersona[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`persona-btn ${persona === p ? 'active' : ''}`}
                        onClick={() => setPersona(p)}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={pitchLoading[selectedCourse.id]}
                    onClick={() => void handleGeneratePitch(selectedCourse.id)}
                  >
                    {pitchLoading[selectedCourse.id] ? 'Generating Pitch with Gemini...' : `✨ Generate ${persona} Pitch`}
                  </button>
                </div>

                {pitchMap[selectedCourse.id] && (
                  <div className="pitch-box">
                    <p>{pitchMap[selectedCourse.id]}</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="secondary-button compact"
                        onClick={() => void handleCopyPitch(selectedCourse.id)}
                      >
                        {copiedCourseId === selectedCourse.id ? '✓ Copied to Clipboard!' : '📋 Copy Pitch'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </SignedIn>
    </>
  );
}
