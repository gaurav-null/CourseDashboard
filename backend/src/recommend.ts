import { z } from 'zod';
import { courseCatalog, type Course, type StudentProfile } from './data.js';

export const ChatFiltersSchema = z.object({
  country: z.string().trim().min(1).max(100).optional(),
  budget_max: z.number().finite().positive().max(500000).optional(),
  major: z.string().trim().min(1).max(100).optional(),
  degree_level: z.enum(['bachelor', 'master', 'phd']).optional(),
});

export type ChatFilters = z.infer<typeof ChatFiltersSchema> & { keyword?: string };

export interface RecommendationResult {
  course: Course;
  score: number;
  reasons: string[];
}

export interface CourseEvaluation {
  fitScore: number;
  riskScore: number;
  summary: string;
  strengths: string[];
  concerns: string[];
}

export type PitchPersona = 'student' | 'parent' | 'sponsor';

export interface TradeoffWeights {
  budget: number;
  rank: number;
  intake: number;
  location: number;
  major: number;
  degree: number;
}

const DEFAULT_WEIGHTS: TradeoffWeights = {
  budget: 40,
  rank: 20,
  location: 20,
  intake: 20,
  major: 20,
  degree: 20,
};

export function normalizeTradeoffWeights(weights?: Partial<TradeoffWeights>): TradeoffWeights {
  const next = { ...DEFAULT_WEIGHTS, ...weights };
  const total = next.budget + next.rank + next.location + next.intake + next.major + next.degree;
  if (total <= 0) {
    return { ...DEFAULT_WEIGHTS };
  }

  return {
    budget: next.budget / total,
    rank: next.rank / total,
    location: next.location / total,
    intake: next.intake / total,
    major: next.major / total,
    degree: next.degree / total,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type AITextResponse = {
  text: string;
  provider: 'openrouter' | 'gemini';
};

export async function generateAIText(prompt: string): Promise<AITextResponse | null> {
  const provider = process.env.AI_PROVIDER ?? (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'gemini');

  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return null;
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'http://localhost:5173',
          'X-Title': 'GradGuide',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL ?? 'openrouter/free',
          messages: [
            {
              role: 'system',
              content: 'You are GradGuide, a factual graduate-course counselor. Use only the supplied data and never invent course facts.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 12_000)),
      });

      if (!response.ok) {
        console.warn(`OpenRouter request failed with status ${response.status}: ${await response.text()}`);
        return null;
      }

      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = payload.choices?.[0]?.message?.content?.trim() ?? '';
      return text ? { text, provider: 'openrouter' } : null;
    } catch (error) {
      console.warn('OpenRouter request failed:', error);
      return null;
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const model = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 12_000)),
    });

    if (!response.ok) {
      console.warn(`Gemini request failed with status ${response.status}`);
      return null;
    }

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
    return text ? { text, provider: 'gemini' } : null;
  } catch (error) {
    console.warn('Gemini request failed:', error);
    return null;
  }
}

export const COUNTRY_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'United States', aliases: ['united states', 'usa', 'u.s.a.', 'u.s.', 'us', 'america'] },
  { canonical: 'United Kingdom', aliases: ['united kingdom', 'uk', 'u.k.', 'britain', 'england', 'scotland'] },
  { canonical: 'Canada', aliases: ['canada'] },
  { canonical: 'Germany', aliases: ['germany', 'deutschland'] },
  { canonical: 'Switzerland', aliases: ['switzerland', 'swiss'] },
  { canonical: 'Singapore', aliases: ['singapore'] },
  { canonical: 'Netherlands', aliases: ['netherlands', 'holland', 'dutch'] },
  { canonical: 'France', aliases: ['france'] },
  { canonical: 'Australia', aliases: ['australia', 'oz'] },
  { canonical: 'Japan', aliases: ['japan'] },
  { canonical: 'South Korea', aliases: ['south korea', 'korea'] },
  { canonical: 'Sweden', aliases: ['sweden'] },
  { canonical: 'Ireland', aliases: ['ireland'] },
  { canonical: 'Denmark', aliases: ['denmark'] },
  { canonical: 'Italy', aliases: ['italy'] },
  { canonical: 'Spain', aliases: ['spain'] },
  { canonical: 'Hong Kong', aliases: ['hong kong'] },
  { canonical: 'New Zealand', aliases: ['new zealand', 'nz'] },
];

export function normalizeCountry(input?: string): string | undefined {
  if (!input) return undefined;
  const clean = input.trim().toLowerCase();
  for (const item of COUNTRY_ALIASES) {
    if (item.canonical.toLowerCase() === clean || item.aliases.includes(clean)) {
      return item.canonical;
    }
  }
  return input.trim();
}

export function countriesMatch(c1?: string, c2?: string): boolean {
  if (!c1 || !c2) return false;
  const n1 = normalizeCountry(c1)?.toLowerCase();
  const n2 = normalizeCountry(c2)?.toLowerCase();
  if (!n1 || !n2) return false;
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

export function extractChatFiltersLocally(query: string): ChatFilters {
  let cleaned = query.toLowerCase();
  const filters: ChatFilters = {};

  for (const c of COUNTRY_ALIASES) {
    for (const alias of c.aliases) {
      const regex = new RegExp(`\\b${alias.replace('.', '\\.')}\\b`, 'i');
      if (regex.test(cleaned)) {
        filters.country = c.canonical;
        cleaned = cleaned.replace(regex, ' ');
        break;
      }
    }
    if (filters.country) break;
  }

  if (/\b(phd|doctorate|doctoral|dphil|ph\.d\.)\b/i.test(cleaned)) {
    filters.degree_level = 'phd';
    cleaned = cleaned.replace(/\b(phd|doctorate|doctoral|dphil|ph\.d\.)\b/ig, ' ');
  } else if (/\b(master(?:'s|s)?|msc|ms|mba|graduate|m\.sc|m\.s\.)\b/i.test(cleaned)) {
    filters.degree_level = 'master';
    cleaned = cleaned.replace(/\b(master(?:'s|s)?|msc|ms|mba|graduate|m\.sc|m\.s\.)\b/ig, ' ');
  } else if (/\b(bachelor(?:'s|s)?|undergraduate|bsc|ba|bs|b\.sc|b\.s\.)\b/i.test(cleaned)) {
    filters.degree_level = 'bachelor';
    cleaned = cleaned.replace(/\b(bachelor(?:'s|s)?|undergraduate|bsc|ba|bs|b\.sc|b\.s\.)\b/ig, ' ');
  }

  const budgetMatch = query.match(/(?:under|below|less than|max(?:imum)?|within|budget of?)\s*(?:[$£€]\s*)?(\d+(?:\.\d+)?)\s*(k|m)?\s*(gbp|pounds?|usd|dollars?|eur|euros?|cad)?/i)
    ?? query.match(/(?:[$£€])\s*(\d+(?:\.\d+)?)\s*(k|m)?/i);
  if (budgetMatch) {
    const amount = Number(budgetMatch[1]) * (budgetMatch[2]?.toLowerCase() === 'k' ? 1_000 : budgetMatch[2]?.toLowerCase() === 'm' ? 1_000_000 : 1);
    const currency = budgetMatch[3]?.toLowerCase() ?? (query.includes('£') ? 'gbp' : query.includes('€') ? 'eur' : 'usd');
    const conversion = currency.startsWith('gbp') || currency.startsWith('pound') ? 1.27
      : currency.startsWith('eur') || currency.startsWith('euro') ? 1.09
        : currency.startsWith('cad') ? 0.74
          : 1;
    filters.budget_max = Number((amount * conversion).toFixed(2));
    cleaned = cleaned.replace(budgetMatch[0].toLowerCase(), ' ');
  }

  cleaned = cleaned.replace(/\b(show me|find|looking for|search|programs?|courses?|degrees?|in|at|under|below|with|for|study|studying|best|top|give me|recommend)\b/ig, ' ');
  cleaned = cleaned.replace(/[^a-z0-9&+#]/gi, ' ').replace(/\s+/g, ' ').trim();

  if (cleaned.length >= 2) {
    filters.major = cleaned;
    filters.keyword = cleaned;
  }

  return filters;
}

export function expandAcronyms(text: string): string {
  return text
    .replace(/\bcs\b/gi, 'computer science')
    .replace(/\bai\b/gi, 'artificial intelligence')
    .replace(/\bml\b/gi, 'machine learning')
    .replace(/\bds\b/gi, 'data science')
    .replace(/\bfintech\b/gi, 'financial technology')
    .replace(/\bmit\b/gi, 'massachusetts institute of technology')
    .replace(/\bucl\b/gi, 'university college london')
    .replace(/\beth\b/gi, 'eth zurich')
    .replace(/\btum\b/gi, 'technical university of munich')
    .replace(/\bnus\b/gi, 'national university of singapore');
}

export function scoreCourse(
  course: Course,
  student: StudentProfile,
  weights: Partial<TradeoffWeights> = DEFAULT_WEIGHTS,
): RecommendationResult {
  const normalized = normalizeTradeoffWeights(weights);
  const gpaFit = student.gpa >= course.minGpa ? 1 : clamp(student.gpa / course.minGpa, 0, 1);
  const budgetFit = student.budget ? (course.feesUsd <= student.budget ? 1 : clamp(student.budget / course.feesUsd, 0, 1)) : 0.8;
  const rankNormalized = 1 - clamp(course.rank / 1000, 0, 1);
  const intakeMatch = 0.85;
  const locationMatch = !student.preferredCountry || countriesMatch(course.country, student.preferredCountry) ? 1 : 0.35;
  const majorMatch = textSimilarity(student.major, `${course.name} ${course.fieldOfStudy}`);
  const degreeMatch = !student.degreeLevel || course.degreeRequired === student.degreeLevel ? 1 : 0.4;

  const score =
    gpaFit * 0.3 * normalized.budget * 1.333 +
    budgetFit * 0.4 * normalized.budget * 1.333 +
    rankNormalized * 0.2 * normalized.rank * 1.667 +
    intakeMatch * 0.1 * normalized.intake * 1.667 +
    locationMatch * 0.2 * normalized.location * 1.5 +
    majorMatch * 0.3 * normalized.major +
    degreeMatch * 0.1 * normalized.degree;

  const reasons: string[] = [];
  if (gpaFit >= 0.95) reasons.push('Your GPA clears the admission threshold.');
  if (budgetFit >= 0.9) reasons.push('The tuition fits comfortably within your budget.');
  if (countriesMatch(course.country, student.preferredCountry)) reasons.push('This option is in your preferred country.');
  if (majorMatch >= 0.25 || course.fieldOfStudy.toLowerCase().includes(student.major.toLowerCase())) {
    reasons.push('The course aligns with your chosen field of study.');
  }
  if (course.rank <= 50) reasons.push(`Ranked #${course.rank} globally in university standings.`);

  return {
    course,
    score: Number(score.toFixed(4)),
    reasons: reasons.length > 0 ? reasons : ['This program provides a solid alternative based on your profile.'],
  };
}

function computeRetrievalFit(student: StudentProfile, course: Course): number {
  const countryBias = !student.preferredCountry || countriesMatch(course.country, student.preferredCountry) ? 1 : 0.35;
  const gpaFit = student.gpa >= course.minGpa ? 1 : clamp(student.gpa / course.minGpa, 0, 1);
  const budgetFit = student.budget ? (course.feesUsd <= student.budget ? 1 : clamp(student.budget / course.feesUsd, 0, 1)) : 0.8;
  const semanticSignal = textSimilarity(student.major, `${course.name} ${course.fieldOfStudy}`);
  return Number((semanticSignal * 0.5 + gpaFit * 0.2 + budgetFit * 0.2 + countryBias * 0.1).toFixed(4));
}

function textSimilarity(left: string, right: string): number {
  const expandedLeft = expandAcronyms(left);
  const expandedRight = expandAcronyms(right);
  const leftTokens = normalizeToken(expandedLeft).split(' ').filter(Boolean);
  const rightTokens = normalizeToken(expandedRight).split(' ').filter(Boolean);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const overlap = [...leftSet].filter((token) => rightSet.has(token)).length;
  const directMatch = normalizeToken(left).includes(normalizeToken(right)) || normalizeToken(right).includes(normalizeToken(left)) ? 0.3 : 0;
  return Math.min(1, Number(((overlap / Math.max(leftSet.size, rightSet.size)) + directMatch).toFixed(4)));
}

export function hybridRecommendCourses(
  student: StudentProfile,
  catalog: Course[] = courseCatalog,
  weights: Partial<TradeoffWeights> = DEFAULT_WEIGHTS,
): RecommendationResult[] {
  const sourceCatalog = catalog && catalog.length > 0 ? catalog : courseCatalog;
  let candidates = student.degreeLevel
    ? sourceCatalog.filter((course) => course.degreeRequired === student.degreeLevel)
    : sourceCatalog;

  if (candidates.length === 0) {
    candidates = sourceCatalog;
  }

  const scored = candidates
    .map((course) => {
      const base = scoreCourse(course, student, weights);
      const retrievalBoost = computeRetrievalFit(student, course) * 0.35;
      const meetsHardConstraints = (student.budget ? course.feesUsd <= student.budget * 1.35 : true) || student.gpa >= course.minGpa * 0.9;
      const boostedScore = meetsHardConstraints ? base.score + retrievalBoost : base.score * 0.7;
      return {
        ...base,
        score: Number(Math.max(0.1, boostedScore).toFixed(4)),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);

  return scored;
}

export function recommendCourses(student: StudentProfile, weights: Partial<TradeoffWeights> = DEFAULT_WEIGHTS): RecommendationResult[] {
  return hybridRecommendCourses(student, courseCatalog, weights);
}

function studentMatches(student: StudentProfile, weights: Partial<TradeoffWeights>) {
  return courseCatalogFilter(student).map((course) => scoreCourse(course, student, weights));
}

function normalizeToken(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean).join(' '); }

function majorSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeToken(left).split(' '));
  const rightTokens = new Set(normalizeToken(right).split(' '));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function courseCatalogFilter(student: StudentProfile): Course[] {
  const byDegree = courseCatalog.filter((course) => course.degreeRequired === student.degreeLevel);

  const exactMatches = byDegree.filter((course) => {
    const majorMatch =
      course.fieldOfStudy.toLowerCase().includes(student.major.toLowerCase()) ||
      student.major.toLowerCase().includes(course.fieldOfStudy.toLowerCase()) ||
      majorSimilarity(student.major, course.fieldOfStudy) >= 0.4;

    const countryMatch = !student.preferredCountry || course.country === student.preferredCountry;
    const meetsGpa = student.gpa >= course.minGpa * 0.95;
    const withinBudget = course.feesUsd <= student.budget * 1.15;

    return majorMatch && countryMatch && degreeMatch(student, course, meetsGpa, withinBudget);
  });

  if (exactMatches.length >= 5) {
    return exactMatches;
  }

  const fallback = byDegree.filter((course) => {
    const majorMatch =
      course.fieldOfStudy.toLowerCase().includes(student.major.toLowerCase()) ||
      student.major.toLowerCase().includes(course.fieldOfStudy.toLowerCase()) ||
      majorSimilarity(student.major, course.fieldOfStudy) >= 0.2;

    const countryMatch = !student.preferredCountry || course.country === student.preferredCountry || course.feesUsd <= student.budget * 1.2;
    const meetsGpa = student.gpa >= course.minGpa * 0.9;
    const withinBudget = course.feesUsd <= student.budget * 1.35;

    return degreeMatch(student, course, meetsGpa, withinBudget) && (majorMatch || countryMatch);
  });

  return [...new Map([...exactMatches, ...fallback].map((course) => [course.id, course])).values()]
    .sort((left, right) => {
      const leftPreferred = !student.preferredCountry || left.country === student.preferredCountry ? 1 : 0;
      const rightPreferred = !student.preferredCountry || right.country === student.preferredCountry ? 1 : 0;
      if (leftPreferred !== rightPreferred) return rightPreferred - leftPreferred;
      if (left.feesUsd !== right.feesUsd) return left.feesUsd - right.feesUsd;
      return left.rank - right.rank;
    })
    .slice(0, 10);
}

function degreeMatch(student: StudentProfile, course: Course, meetsGpa: boolean, withinBudget: boolean): boolean {
  return course.degreeRequired === student.degreeLevel && (meetsGpa || withinBudget);
}

export function buildExplainability(student: StudentProfile, course: Course): string {
  const preferred = student.preferredCountry ? ` and your preferred country is ${student.preferredCountry}` : '';
  return `${course.name} at ${course.university} is a strong fit because your GPA of ${student.gpa.toFixed(1)} clears the ${course.minGpa.toFixed(1)} minimum, while the annual fee of $${course.feesUsd.toLocaleString()} is within your budget of $${student.budget.toLocaleString()}. The course ranks #${course.rank} globally${preferred}, and its ${course.intakeMonths.join(', ')} intake lines up well with your ${student.intakeYear} application cycle.`;
}

export function buildCourseEvaluation(student: StudentProfile, course: Course): CourseEvaluation {
  const gpaFit = student.gpa >= course.minGpa ? 1 : clamp(student.gpa / course.minGpa, 0, 1);
  const budgetFit = course.feesUsd <= student.budget ? 1 : clamp(student.budget / course.feesUsd, 0, 1);
  const rankFit = 1 - clamp(course.rank / 1000, 0, 1);
  const countryFit = !student.preferredCountry || course.country === student.preferredCountry ? 1 : 0.35;
  const fitScore = Math.round((gpaFit * 0.35 + budgetFit * 0.3 + rankFit * 0.2 + countryFit * 0.15) * 100);
  const riskScore = Math.max(0, 100 - fitScore);
  const strengths: string[] = [];
  const concerns: string[] = [];

  if (gpaFit >= 0.9) strengths.push('Academic profile is comfortably above the grade threshold.');
  else concerns.push('Your GPA is close to the minimum, so admissions risk is moderate.');

  if (budgetFit >= 0.9) strengths.push('Tuition stays within the planned budget.');
  else concerns.push('The program is expensive relative to your current budget.');

  if (course.country === student.preferredCountry) strengths.push('The location matches your preferred study destination.');
  else if (student.preferredCountry) concerns.push('This option is outside your preferred country.');

  if (course.rank <= 50) strengths.push('The university has a strong global ranking for this field.');
  else concerns.push('The ranking is respectable but not top-tier in the current shortlist.');

  return {
    fitScore,
    riskScore,
    summary: `${course.name} at ${course.university} is a ${fitScore >= 75 ? 'strong' : fitScore >= 60 ? 'reasonable' : 'higher-risk'} fit for ${student.major}, with a ${fitScore}% short-list fit score and a ${riskScore}% risk profile.`,
    strengths: strengths.length > 0 ? strengths : ['The program remains a viable backup option based on the broader shortlist.'],
    concerns: concerns.length > 0 ? concerns : ['No critical concerns flagged from the deterministic fit profile.'],
  };
}

export async function evaluateCourseWithGemini(student: StudentProfile, course: Course): Promise<CourseEvaluation | null> {
  try {
    const result = await generateAIText(`Return only valid JSON with keys fitScore, riskScore, summary, strengths, concerns. Evaluate this study recommendation for a student. Use numeric values 0-100 for fitScore and riskScore. Keep strengths and concerns as arrays of strings.\n\nStudent profile: ${JSON.stringify(student)}\nCourse: ${JSON.stringify({ name: course.name, university: course.university, country: course.country, feesUsd: course.feesUsd, minGpa: course.minGpa, fieldOfStudy: course.fieldOfStudy, rank: course.rank, intakeMonths: course.intakeMonths })}`);
    const rawText = result?.text ?? '';
    if (!rawText.trim()) {
      return null;
    }

    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<CourseEvaluation>;
    if (typeof parsed.fitScore !== 'number' || typeof parsed.riskScore !== 'number') {
      return null;
    }

    return {
      fitScore: Number(parsed.fitScore),
      riskScore: Number(parsed.riskScore),
      summary: typeof parsed.summary === 'string' ? parsed.summary : buildCourseEvaluation(student, course).summary,
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths.filter((value): value is string => typeof value === 'string') : buildCourseEvaluation(student, course).strengths,
      concerns: Array.isArray(parsed.concerns) && parsed.concerns.length > 0 ? parsed.concerns.filter((value): value is string => typeof value === 'string') : buildCourseEvaluation(student, course).concerns,
    };
  } catch {
    return null;
  }
}

export async function generateAIPitch(student: StudentProfile, course: Course, persona: PitchPersona = 'student'): Promise<string> {
  try {
    const result = await generateAIText(`Write a persuasive ${persona} pitch for this course recommendation. Return only the pitch text, with no headings, labels, safety checks, moderation notes, metadata, JSON, or commentary about these instructions. Do not include phrases such as "User Safety" or "Safety".\n\nStudent profile: ${JSON.stringify(student)}\nCourse: ${JSON.stringify({ name: course.name, university: course.university, country: course.country, feesUsd: course.feesUsd, fieldOfStudy: course.fieldOfStudy, rank: course.rank, intakeMonths: course.intakeMonths })}`);
    const pitch = result?.text
      ?.split(/\r?\n/)
      .filter((line) => !/^\s*(user\s+)?safety\s*:/i.test(line) && !/^\s*(safety|moderation)\s+(check|status)\s*:/i.test(line))
      .join('\n')
      .trim();
    return pitch || buildPitch(student, course, persona);
  } catch {
    return buildPitch(student, course, persona);
  }
}

export function buildPitch(student: StudentProfile, course: Course, persona: PitchPersona = 'student'): string {
  const feeLabel = `$${course.feesUsd.toLocaleString()}`;
  const budgetLabel = `$${student.budget.toLocaleString()}`;
  const countryPlan = student.preferredCountry ? ` and it sits in ${student.preferredCountry}` : '';

  if (persona === 'parent') {
    return `As a parent, this is a practical and credible option for ${student.major}: ${course.name} at ${course.university} offers a strong academic profile, with a tuition of ${feeLabel}, a ${course.intakeMonths.join(', ')} intake timeline, and a realistic fit for your child's GPA of ${student.gpa.toFixed(1)}${countryPlan}. It balances affordability, academic quality, and an application path that is achievable without overextending the family budget.`;
  }

  if (persona === 'sponsor') {
    return `From a sponsor perspective, ${course.name} at ${course.university} is a high-value investment because it aligns closely with ${student.major}, remains within a budget of ${budgetLabel}, and is positioned well for a ${student.intakeYear} start${countryPlan}. The program's rank and fit profile make it a credible choice for long-term academic and career returns.`;
  }

  return `This is a strong fit for you: ${course.name} at ${course.university} matches your ${student.major} interest, sits within your budget at ${feeLabel}, and keeps your GPA and intake plans in a realistic range for ${student.intakeYear}${countryPlan}. It is a smart option because it combines affordability, academic quality, and a clear application path.`;
}
