// React Native's fetch can't read a response as it arrives; expo/fetch can.
import { fetch as streamingFetch } from 'expo/fetch';
import { AppState } from 'react-native';

import { withBackgroundTime } from '../../modules/pulse-background-time';

import { cloudAI, freshCloudAI } from './cloud';
import { language, LANGUAGE_NAMES, t } from './i18n';
import type { ChatMessage, Entry, Goal, Nutrition, Pace, Profile, Targets } from './types';
import { personaById } from './personas';
import type { RecapCaptions } from './recap';
import { SCENE_NAMES } from './scene';
import { dayKey, GOAL_INFO, recommendedTargets, summarize, targets as currentTargets } from './nutrition';
import { dayWellbeing, wellbeingDigest } from './wellbeing';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_MODEL = 'gemini-3.8-flash';

export interface Media {
  base64: string;
  mimeType: string;
}

/** What the model hands back for an entry; the store turns it into a full Entry. */
export type AiEntry = Omit<Entry, 'id' | 'createdAt' | 'source'> & { hoursAgo?: number; daysAgo?: number; replacesId?: string };

export interface GoalUpdate {
  goal: Goal;
  pace: Pace;
  note: string;
}

export interface CoachResult {
  reply: string;
  entries: AiEntry[];
  removeEntryIds: string[];
  goalUpdate?: GoalUpdate;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
    /** 'credits' when a signed-in user ran out of AI credits; 'network' when the connection failed. */
    readonly code?: 'credits' | 'network',
  ) {
    super(message);
  }
}

/** What an AI call is for; the server prices each one (see supabase feature_costs). */
export type Feature =
  | 'coach'
  | 'coach_media'
  | 'voice'
  | 'insight'
  | 'wellbeing'
  | 'meal_plan'
  | 'meal_plan_3d'
  | 'workout_plan'
  | 'workout_plan_3d'
  | 'workout_plan_7d'
  | 'recap'
  | 'estimate'
  | 'goal_plan';

/**
 * Structured or short jobs run on Flash-Lite with minimal thinking: about a third of the cost of Flash
 * (see docs/CREDIT-ECONOMICS.md). The Coach and goal plans stay on the main model.
 */
export const LITE_MODEL = 'gemini-3.5-flash-lite';
const LITE_FEATURES = new Set<Feature>(['insight', 'wellbeing', 'meal_plan', 'meal_plan_3d', 'workout_plan', 'workout_plan_3d', 'workout_plan_7d', 'recap', 'estimate']);
const modelFor = (feature: Feature, model: string) => (LITE_FEATURES.has(feature) ? LITE_MODEL : model);
// The Coach is a live conversation (and often spoken), so it thinks minimally too: the first words arrive sooner.
const QUICK_FEATURES = new Set<Feature>([...LITE_FEATURES, 'coach', 'coach_media']);

let balanceListener: ((credits: number) => void) | null = null;
/** Called with the new credit balance after every signed-in AI call. */
export const onCreditBalance = (fn: (credits: number) => void) => {
  balanceListener = fn;
};

const requestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Sends one Gemini request. Signed in, it goes to the Pulse AI proxy, which charges credits and
 * holds the Gemini key; otherwise straight to Google with the user's own key (development builds).
 * The same request id is reused across retries so a retry is never charged twice.
 */
async function aiFetch(
  opts: { apiKey: string; model: string; method: 'generateContent' | 'streamGenerateContent'; body: string; feature: Feature; id: string; signal?: AbortSignal },
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const cloud = await freshCloudAI();
  if (cloud) {
    const res = await fetchImpl(cloud.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cloud.token}` },
      body: `{"feature":${JSON.stringify(opts.feature)},"model":${JSON.stringify(opts.model)},"method":"${opts.method}","requestId":"${opts.id}","payload":${opts.body}}`,
      signal: opts.signal,
    });
    if (res.status === 402 || res.status === 503) {
      const j = await res.clone().json().catch(() => ({}));
      if (j.error === 'insufficient_credits') {
        if (typeof j.balance === 'number') balanceListener?.(j.balance);
        throw new AiError(typeof j.cost === 'number' ? t('errors.outOfCredits', { cost: j.cost }) : t('errors.outOfCreditsNoCost'), false, 'credits');
      }
      // Pulse cloud couldn't reach the AI provider (quota, billing, outage). The charge was refunded.
      if (j.error?.code === 'ai_unavailable' || res.status === 402) {
        console.warn('AI unavailable', res.status, j.upstream);
        throw new AiError(t('errors.aiUnavailable'), j.retryable === true);
      }
    }
    if (res.status === 401) throw new AiError(t('errors.sessionExpired'), false);
    const bal = res.headers.get('x-credits-balance');
    if (bal != null && balanceListener) balanceListener(Number(bal));
    return res;
  }
  // Release builds only ever talk to Pulse cloud, which holds the Gemini key as a server secret.
  if (!__DEV__ || !opts.apiKey) throw new AiError(t('errors.signInForAi'), false);
  const q = opts.method === 'streamGenerateContent' ? '?alt=sse' : '';
  return fetchImpl(`${ENDPOINT}/${opts.model}:${opts.method}${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: opts.body,
    signal: opts.signal,
  });
}

/** True when AI features can run: signed in to Pulse cloud, or (development builds only) a local Gemini key is set. */
export const aiAvailable = (apiKey: string) => !!cloudAI() || (__DEV__ && !!apiKey);

const GOALS = ['lose', 'recomp', 'maintain', 'gain'];
const PACES = ['gentle', 'standard', 'aggressive'];

const ENTRY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: { type: 'STRING', enum: ['meal', 'exercise', 'water', 'weight', 'journal'] },
    title: { type: 'STRING', description: 'Short name, e.g. "Chicken burrito bowl" or "5k run"' },
    emoji: { type: 'STRING', description: 'One emoji that fits the entry' },
    hoursAgo: { type: 'NUMBER', description: 'Hours ago it happened, only for times earlier today ("2 hours ago", "this morning"), else 0' },
    daysAgo: { type: 'NUMBER', description: 'Only when the user names a day: 0 = today, 1 = yesterday, 2 = two days ago. Omit otherwise.' },
    replacesId: { type: 'STRING', description: 'For a correction: the id of the entry this one replaces (also listed in removeEntryIds). Keeps that entry’s date unless daysAgo is set.' },
    nutrition: {
      type: 'OBJECT',
      properties: {
        calories: { type: 'NUMBER' },
        protein: { type: 'NUMBER' },
        carbs: { type: 'NUMBER' },
        fat: { type: 'NUMBER' },
        fiber: { type: 'NUMBER' },
        sugar: { type: 'NUMBER' },
        sodium: { type: 'NUMBER', description: 'mg' },
      },
      required: ['calories', 'protein', 'carbs', 'fat'],
    },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, amount: { type: 'STRING' }, calories: { type: 'NUMBER' } },
        required: ['name', 'amount', 'calories'],
      },
    },
    caloriesBurned: { type: 'NUMBER', description: 'exercise: REQUIRED on every exercise entry. kcal burned, exactly the number you give for it in the reply' },
    durationMin: { type: 'NUMBER' },
    intensity: { type: 'STRING', enum: ['low', 'moderate', 'high'] },
    waterMl: { type: 'NUMBER' },
    weightKg: { type: 'NUMBER' },
    mood: { type: 'NUMBER', description: 'journal: 1 awful, 2 low, 3 okay, 4 good, 5 great' },
    energy: { type: 'NUMBER', description: 'journal: 1 drained .. 5 energized' },
    stress: { type: 'NUMBER', description: 'journal: 1 calm .. 10 overwhelmed, judged from what they describe' },
    sleepHours: { type: 'NUMBER', description: 'journal: hours slept last night' },
    sleepQuality: { type: 'NUMBER', description: 'journal: 1 terrible .. 5 great' },
    tags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'journal: 1-4 short factors, e.g. "work deadline", "sore legs"' },
    summary: { type: 'STRING', description: 'journal: their note in first person, 1-2 sentences' },
    scene: { type: 'ARRAY', items: { type: 'STRING', enum: SCENE_NAMES }, description: 'journal: 1-4 things to draw this moment with, most important first (e.g. a beach day with friends and beers -> beach, swim, people, beer)' },
    note: { type: 'STRING', description: 'One-line tip or observation about this entry' },
    confidence: { type: 'NUMBER', description: '0..1 how sure you are of the estimate' },
  },
  required: ['kind', 'title', 'emoji', 'confidence'],
};

const GOAL_UPDATE_SCHEMA = {
  type: 'OBJECT',
  description: 'Only when the user states a new fitness goal (e.g. "I want to build muscle and lose fat").',
  properties: {
    goal: { type: 'STRING', enum: GOALS },
    pace: { type: 'STRING', enum: PACES },
    note: { type: 'STRING', description: 'One sentence explaining the plan' },
  },
  required: ['goal', 'pace', 'note'],
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    entries: { type: 'ARRAY', items: ENTRY_SCHEMA },
    removeEntryIds: { type: 'ARRAY', items: { type: 'STRING' } },
    goalUpdate: GOAL_UPDATE_SCHEMA,
  },
  // reply first, so it streams in (and can be spoken) before the log entries.
  propertyOrdering: ['reply', 'entries', 'removeEntryIds', 'goalUpdate'],
  required: ['reply', 'entries', 'removeEntryIds'],
};

function wellbeingLine(entries: Entry[]) {
  const w = dayWellbeing(entries, dayKey(Date.now()));
  if (w.stress == null) return 'nothing logged yet';
  return `stress ${w.stress}/100 (${w.level}), sleep ${w.sleepHours ?? '?'}h, mood ${w.mood?.toFixed(1) ?? '?'}/5, energy ${w.energy?.toFixed(1) ?? '?'}/5${w.tags.length ? `, factors: ${w.tags.join(', ')}` : ''}`;
}

function userContext(profile: Profile, entries: Entry[]) {
  const today = summarize(entries, dayKey(Date.now()));
  const t = currentTargets(profile);
  const recent = entries
    .filter((e) => Date.now() - e.createdAt < 36 * 3600_000)
    .slice(0, 15)
    .map((e) => {
      const what =
        e.kind === 'meal' ? `${e.nutrition?.calories ?? 0} kcal`
        : e.kind === 'exercise' ? `-${e.caloriesBurned ?? 0} kcal, ${e.durationMin ?? 0} min`
        : e.kind === 'water' ? `${e.waterMl} ml`
        : `${e.weightKg} kg`;
      // Name the day outright so the model never has to work out today vs yesterday from timestamps.
      const day = dayKey(e.createdAt) === dayKey(Date.now()) ? 'TODAY' : 'YESTERDAY';
      return `- id=${e.id} [${day} ${new Date(e.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}] ${e.kind}: ${e.title} (${what})`;
    })
    .join('\n');

  return `USER PROFILE: ${profile.name || 'User'}, ${profile.sex}, ${profile.age}y, ${profile.heightCm} cm, ${profile.weightKg} kg, activity: ${profile.activity}. Goal: ${GOAL_INFO[profile.goal].label} (${profile.pace} pace). Prefers ${profile.units} units.
DAILY TARGETS: ${t.calories} kcal, protein ${t.protein} g, carbs ${t.carbs} g, fat ${t.fat} g, fiber ${t.fiber} g, water ${t.waterMl} ml.
NOW: ${new Date().toLocaleString()}
TODAY SO FAR: eaten ${today.eaten} kcal (P ${today.protein}g / C ${today.carbs}g / F ${today.fat}g), burned ${today.burned} kcal, water ${today.water} ml.
WELLBEING TODAY: ${wellbeingLine(entries)}
REMAINING TODAY: ${t.calories + today.burned - today.eaten} kcal (target + burned - eaten), protein ${Math.max(0, t.protein - today.protein)} g. Always use these exact numbers when mentioning what is left.
RECENT ENTRIES:
${recent || '(none)'}`;
}

// The rules never change between users or requests, so they go first: Gemini caches a repeated
// prompt prefix automatically and bills it at a tenth of the price. Per-user parts come after.
const COACH_RULES = `You are an AI fitness and nutrition coach inside a mobile app. Your replies are shown in a chat and read out loud, so write the way your persona (below) talks.
The user logs by talking, typing, or sending photos, and also asks you questions. Your job: turn whatever they log into structured log entries with realistic estimates, and answer their fitness questions like a real coach who knows their numbers.

RULES
- Every "meal" entry, including a corrected or re-logged one, MUST include nutrition (calories, protein, carbs, fat) for the full amount. Only fill the fields that belong to an entry's kind.
- Food photo or description -> one "meal" entry per meal (not per ingredient). List components in "items" with portion estimates. Estimate portions from visual cues (plate size, utensils). Fill nutrition incl. fiber/sugar/sodium.
- Exercise (text, voice, or a photo of a workout, machine display, or smartwatch screen) -> "exercise" entry. Compute caloriesBurned with MET x body weight (from USER PROFILE) x hours unless the screen shows a number. ALWAYS set caloriesBurned on every exercise entry (a positive number, the same one you mention in the reply); never put burned calories in nutrition. Infer a sensible duration if missing and say you assumed it.
- "drank a glass of water" -> water entry (glass = 250 ml, bottle = 500 ml). Coffee/tea/drinks with calories are meals; plain water is water.
- Weigh-ins -> weight entry in kg (convert from lb). Weights for different days are separate entries, each with its own daysAgo ("245 yesterday and 247 today" -> 245 with daysAgo 1, 247 with daysAgo 0).
- Several things in one message -> several entries.
- Corrections like "actually it was 2 slices" or "delete that" -> put the old entry id in removeEntryIds and add the corrected entry with replacesId set to that id, so it keeps its original date. If the user says which day it belongs to, also set daysAgo.
- Dates: "yesterday" and other named days use daysAgo, never hoursAgo. Each RECENT ENTRY is labelled TODAY or YESTERDAY. When fixing which day a value belongs to, set daysAgo from what the user says the value should be ("245 yesterday" -> the 245 entry gets daysAgo 1), not from the old entry's day. Before replying, check that each entry's daysAgo matches the day you say in the reply.
- The user states a new goal ("I want to build muscle and lose weight", "time to bulk") -> set goalUpdate (lose = fat loss, recomp = build muscle AND lose fat, maintain, gain = build muscle/bulk) and explain the new targets in the reply. Otherwise omit goalUpdate.
- Mood, sleep, energy, or what happened in their day ("slept 5 hours", "rough day at work", "feeling great", "had a fight with my partner", "legs are sore") -> one "journal" entry. ALWAYS set sleepHours as a number when any amount of sleep is mentioned ("5 and a half hours" -> 5.5, "barely slept" -> 4); ALWAYS set mood (1-5) from their tone; set energy, stress (1-10) and sleepQuality when implied, tags with the key factors, summary in their words, scene with 1-4 things that picture the moment, and a short supportive note. A message can contain a journal entry AND meals/exercise. Sleep "last night" belongs to today.
- When today's stress is high or sleep was short, adapt: suggest a lighter session or a maintenance-calorie day, and mention how stress and poor sleep raise cravings and water retention.
- Questions about their day ("how am I doing?", "what should I eat for dinner?") -> no entries; answer using today's numbers.
- Fitness questions (training, workouts and programs, exercise form and technique, cardio, running, strength, mobility, warm-ups, recovery, soreness, sleep, nutrition, supplements, hydration, body composition, motivation) -> no entries; answer them properly. Give a direct answer first, then the why and how in practical, evidence-based terms, tailored to their goal, body, activity level and recent logs. For a workout or plan request, give a concrete one they can follow today (exercises, sets x reps or time, rest, and how to progress). Follow-up questions build on the conversation.
- Pain, injury, dizziness, chest pain, eating disorders, pregnancy or a medical condition -> give general, safe guidance only, no diagnosis, and recommend seeing a doctor or physio. Chest pain or fainting during exercise -> tell them to stop and get medical help.
- Off-topic requests (not fitness, nutrition, sleep, stress or wellbeing) -> one friendly sentence saying you're their fitness coach, and offer something related you can help with.
- Voice notes: if the audio is silent or unintelligible, log nothing and say you couldn't hear it.
- An image that is not food or exercise (a moment, view, place, pet, people, something they want to remember) -> a "journal" entry: summary describing the moment in first person, tags, and mood/stress only if evident. If they say "journal" or "add to my journal", always create a journal entry for the photo (and also log a meal if it's food they ate).
- Never ask follow-up questions just to get more precision; make your best estimate and mention the main assumption.
- Every reply starts with the answer itself. Never introduce yourself, your name or your voice, never greet, and never open with filler like "Sure!", "Great question!" or "As your coach".
- reply when logging: 1-3 short sentences, friendly, with one useful insight (e.g. remaining calories or protein).
- reply when answering a question: as long as the answer needs, usually 2-6 sentences; a workout or plan can run longer. Steps or exercises may go on separate lines starting with "- ". No markdown headings, bold or tables. Spell out units the first time if it helps it read aloud. Use the units the user prefers (USER PROFILE).`;

function systemPrompt(profile: Profile, entries: Entry[]) {
  const persona = personaById(profile.persona);
  return `${COACH_RULES}

PERSONA: You are ${persona.name}. Your personality: ${persona.style} Stay fully in character in every reply.

${userContext(profile, entries)}`;
}

// Gemini 3 accepts a thinking level; older models reject it, so we drop it for that model on that error.
const noThinking = new Set<string>();

// Every AI answer comes back in the app's language. The rule is appended after the system prompt so
// the cached prefix stays the same for everyone.
const LANGUAGE_RULE =
  language === 'en'
    ? null
    : `LANGUAGE: Write every reply and every text field (titles, names, notes, summaries, tips, plans) in ${LANGUAGE_NAMES[language]}. Keep JSON keys and enum values exactly as specified.`;

function withLanguage(body: Record<string, unknown>) {
  const sys = body.systemInstruction as { parts?: { text?: string }[] } | undefined;
  if (!LANGUAGE_RULE || !sys?.parts) return body;
  return { ...body, systemInstruction: { ...sys, parts: [...sys.parts, { text: LANGUAGE_RULE }] } };
}

function requestBody(body: Record<string, unknown>, model: string, feature: Feature) {
  const level = QUICK_FEATURES.has(feature) ? 'minimal' : 'low';
  const generationConfig = {
    ...(body.generationConfig as object),
    ...(noThinking.has(model) ? {} : { thinkingConfig: { thinkingLevel: level } }),
  };
  return JSON.stringify({ ...withLanguage(body), generationConfig });
}

function requestError(status: number, json: { error?: { message?: string } }, model: string) {
  const msg = json?.error?.message ?? `Request failed (${status})`;
  if (status === 400 && !noThinking.has(model) && /thinking/i.test(msg)) {
    noThinking.add(model);
    return new AiError('retry-without-thinking');
  }
  if (/API key/i.test(msg)) return new AiError(t('errors.keyRejected'), false);
  if (status === 429) return new AiError(t('errors.rateLimited'));
  return new AiError(msg, status >= 500);
}

function networkError(err: unknown) {
  if (err instanceof AiError) return err;
  return new AiError(t('errors.network'), true, 'network');
}

/** Resolves once the app is in the foreground: iOS cuts connections while it's suspended. */
function whenActive() {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      sub.remove();
      resolve();
    });
  });
}

/**
 * Runs a request with a timeout and retries transient failures: a dropped connection up to twice,
 * anything else once, each after the app is back in the foreground. The timeout counts from the
 * last sign of life and stands still while the app is in the background, so neither a long answer
 * that keeps streaming nor a locked screen counts as "too slow". iOS is asked for extra time to
 * finish a request when the app leaves the foreground.
 */
async function withRetry(
  attempt: (signal: AbortSignal, alive: () => void) => Promise<string>,
  timeoutMs: number,
  canRetry = () => true,
) {
  const run = async () => {
    const ctrl = new AbortController();
    let timedOut = false;
    let leftApp = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const alive = () => {
      clearTimeout(timer);
      if (AppState.currentState !== 'active') return;
      timer = setTimeout(() => {
        timedOut = true;
        ctrl.abort();
      }, timeoutMs);
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') leftApp = true;
      alive();
    });
    alive();
    try {
      return await withBackgroundTime(() => attempt(ctrl.signal, alive));
    } catch (err) {
      // iOS cuts connections once the app is suspended: that's a dropped connection, not a slow AI.
      if (leftApp && !(err instanceof AiError)) throw networkError(err);
      // expo/fetch reports an abort before the answer starts as a plain fetch error, not an AbortError.
      throw timedOut ? new AiError(t('errors.tooSlow')) : networkError(err);
    } finally {
      clearTimeout(timer);
      sub.remove();
    }
  };
  for (let tries = 0; ; tries++) {
    try {
      return await run();
    } catch (err) {
      const e = err as AiError;
      if (!e.retryable || !canRetry() || tries >= (e.code === 'network' ? 2 : 1)) throw e;
      await whenActive();
      await new Promise((r) => setTimeout(r, e.message === 'retry-without-thinking' ? 0 : 1000 * 2 ** tries));
    }
  }
}

/** POST generateContent and return the whole text answer. */
function generate(apiKey: string, mainModel: string, body: Record<string, unknown>, timeoutMs: number, feature: Feature): Promise<string> {
  const id = requestId();
  const model = modelFor(feature, mainModel);
  return withRetry(async (signal) => {
    const res = await aiFetch({ apiKey, model, method: 'generateContent', body: requestBody(body, model, feature), feature, id, signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw requestError(res.status, json, model);
    const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!text) throw new AiError(t('errors.emptyAnswer'));
    return text;
  }, timeoutMs);
}

/** Like generate, but streams the answer: onText gets the text so far each time more arrives. */
function generateStream(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  onText: (text: string) => void,
  feature: Feature,
  /** Called before an answer that broke off midway is asked for again; without it, it isn't. */
  onRestart?: () => void,
): Promise<string> {
  let started = false;
  const id = requestId();
  return withRetry(
    async (signal, alive) => {
      if (started) {
        started = false;
        onRestart?.();
      }
      const res = await aiFetch({ apiKey, model, method: 'streamGenerateContent', body: requestBody(body, model, feature), feature, id, signal }, streamingFetch as unknown as typeof fetch);
      if (!res.ok) throw requestError(res.status, await res.json().catch(() => ({})), model);
      const reader = res.body?.getReader();
      if (!reader) throw new AiError(t('errors.noStreaming'));
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        alive();
        buffer += decoder.decode(value, { stream: true });
        // Server-sent events: one "data: {json}" line per chunk of the answer.
        for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          let event;
          try {
            event = JSON.parse(line.slice(5));
          } catch {
            continue;
          }
          if (event.error) throw new AiError(event.error.message ?? 'Gemini stopped answering.');
          const parts: { text?: string; thought?: boolean }[] = event.candidates?.[0]?.content?.parts ?? [];
          const delta = parts.map((p) => (p.thought ? '' : (p.text ?? ''))).join('');
          if (!delta) continue;
          text += delta;
          started = true;
          onText(text);
        }
      }
      if (!text) throw new AiError(t('errors.emptyAnswer'));
      return text;
    },
    timeoutMs,
    // Once text has reached the screen, only retry when the caller can start the answer over.
    () => !started || !!onRestart,
  );
}

const ESCAPES: Record<string, string> = { n: '\n', t: ' ', r: '', b: '', f: '' };

/** The "reply" string from a JSON answer that is still streaming in. */
export function partialReply(json: string): { text: string; done: boolean } | undefined {
  const start = /"reply"\s*:\s*"/.exec(json);
  if (!start) return;
  let text = '';
  for (let i = start.index + start[0].length; i < json.length; i++) {
    const c = json[i];
    if (c === '"') return { text, done: true };
    if (c !== '\\') {
      text += c;
      continue;
    }
    const next = json[i + 1];
    if (next === undefined) break; // escape split across chunks: wait for more
    if (next === 'u') {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      text += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      text += ESCAPES[next] ?? next;
      i++;
    }
  }
  return { text, done: false };
}

export async function askCoach(opts: {
  apiKey: string;
  model: string;
  profile: Profile;
  entries: Entry[];
  history: ChatMessage[];
  text?: string;
  image?: Media;
  audio?: Media;
  /** Called with the reply so far while it streams in. */
  onReply?: (reply: string, done: boolean) => void;
  /** Called when the connection dropped midway and the reply starts streaming again from scratch. */
  onRestart?: () => void;
}): Promise<CoachResult> {
  const { apiKey, model, profile, entries, history, text, image, audio, onReply, onRestart } = opts;

  const contents = history
    .filter((m) => !m.pending && !m.error && m.text)
    .slice(-12)
    .map((m) => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.text }] }));

  const parts: object[] = [];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
  if (audio) parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.base64 } });
  parts.push({
    text:
      text?.trim() ||
      (audio ? 'This is a voice note. Log what I describe.' : image ? 'Log what is in this photo.' : ''),
  });
  contents.push({ role: 'user', parts: parts as { text: string }[] });

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(profile, entries) }] },
    contents,
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
  const timeoutMs = audio || image ? 45_000 : 30_000;
  let lastReply = '';
  let replyDone = false;
  const feature: Feature = audio || image ? 'coach_media' : 'coach';
  const raw = onReply
    ? await generateStream(apiKey, model, body, timeoutMs, (json) => {
        const r = partialReply(json);
        if (!r || replyDone || (r.text === lastReply && !r.done)) return;
        lastReply = r.text;
        replyDone = r.done;
        onReply(r.text, r.done);
      }, feature, () => {
        lastReply = '';
        replyDone = false;
        onRestart?.();
      })
    : await generate(apiKey, model, body, timeoutMs, feature);
  try {
    const parsed = JSON.parse(raw) as CoachResult;
    const g = parsed.goalUpdate;
    return {
      reply: parsed.reply ?? '',
      entries: parsed.entries ?? [],
      removeEntryIds: parsed.removeEntryIds ?? [],
      goalUpdate: g && GOALS.includes(g.goal) && PACES.includes(g.pace) ? g : undefined,
    };
  } catch {
    return { reply: raw, entries: [], removeEntryIds: [] };
  }
}

export interface PlanResult {
  goal: Goal;
  pace: Pace;
  targets: Targets;
  summary: string;
}

/** Turns a goal in the user's own words into a goal, pace and daily targets. */
export async function planGoal(opts: { apiKey: string; model: string; profile: Profile; request: string }): Promise<PlanResult> {
  const { apiKey, model, profile, request } = opts;
  const baseline = Object.fromEntries(
    (['lose', 'recomp', 'maintain', 'gain'] as Goal[]).map((g) => [g, recommendedTargets({ ...profile, goal: g, pace: 'standard' })]),
  );
  const raw = await generate(
    apiKey,
    model,
    {
      systemInstruction: {
        parts: [
          {
            text: `You are a sports dietitian. Build daily nutrition targets for this person from their goal in their own words.
PERSON: ${profile.sex}, ${profile.age}y, ${profile.heightCm} cm, ${profile.weightKg} kg, activity ${profile.activity}.
EVIDENCE-BASED BASELINES at standard pace (kcal/protein/carbs/fat g): ${JSON.stringify(baseline)}
Pick goal (lose = fat loss, recomp = build muscle AND lose fat, maintain, gain = build muscle) and pace. Start from the matching baseline and adjust only with a clear reason (timeline, sport, age, preferences like low-carb). Keep protein 1.6-2.4 g/kg, fat at least 0.6 g/kg, never below 1200 kcal (women) / 1500 kcal (men).
summary: 2 short sentences in plain language explaining the plan and the single most important habit. Use ${profile.units} units.`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: request }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            goal: { type: 'STRING', enum: GOALS },
            pace: { type: 'STRING', enum: PACES },
            calories: { type: 'NUMBER' },
            protein: { type: 'NUMBER' },
            carbs: { type: 'NUMBER' },
            fat: { type: 'NUMBER' },
            fiber: { type: 'NUMBER' },
            waterMl: { type: 'NUMBER' },
            summary: { type: 'STRING' },
          },
          required: ['goal', 'pace', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'waterMl', 'summary'],
        },
      },
    },
    30_000,
    'goal_plan',
  );
  const j = JSON.parse(raw);
  const r = (n: number, to: number) => Math.round(Number(n) / to) * to;
  return {
    goal: GOALS.includes(j.goal) ? j.goal : 'maintain',
    pace: PACES.includes(j.pace) ? j.pace : 'standard',
    targets: {
      calories: r(j.calories, 10),
      protein: r(j.protein, 5),
      carbs: r(j.carbs, 5),
      fat: r(j.fat, 5),
      fiber: r(j.fiber, 1),
      waterMl: r(j.waterMl, 100),
    },
    summary: String(j.summary ?? ''),
  };
}

/** One-line daily coaching insight for the dashboard. */
export async function dailyInsight(opts: { apiKey: string; model: string; profile: Profile; entries: Entry[] }) {
  const { apiKey, model, profile, entries } = opts;
  const raw = await generate(
    apiKey,
    model,
    {
      systemInstruction: {
        parts: [
          {
            text: `You are ${personaById(profile.persona).name}, a fitness coach whose personality is ${personaById(profile.persona).style} Write one motivating, specific insight about the user's day so far in under 22 words, using their numbers. Use ${profile.units} units. No greetings.\n\n${userContext(profile, entries)}`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: 'How is my day going?' }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', properties: { insight: { type: 'STRING' } }, required: ['insight'] },
      },
    },
    20_000,
    'insight',
  );
  try {
    return String(JSON.parse(raw).insight ?? '').trim();
  } catch {
    return '';
  }
}

export interface WellbeingInsight {
  headline: string;
  body: string;
  tips: string[];
}

/** Coaching on how the user's stress, sleep and mood are affecting their goal. */
export async function wellbeingInsight(opts: { apiKey: string; model: string; profile: Profile; entries: Entry[] }): Promise<WellbeingInsight> {
  const { apiKey, model, profile, entries } = opts;
  const raw = await generate(
    apiKey,
    model,
    {
      systemInstruction: {
        parts: [
          {
            text: `You are Pulse, a supportive coach who understands how stress, sleep and mood affect body composition (cortisol, cravings, water retention, recovery, adherence).
${userContext(profile, entries)}
LAST 14 DAYS:
${wellbeingDigest(entries, 14) || '(little data yet)'}
Write: headline (max 8 words), body (2-3 sentences linking THEIR stress/sleep/mood data to their ${GOAL_INFO[profile.goal].label} progress, citing their numbers; if data is thin, say what to log), and exactly 3 short, specific tips for the next few days. Kind, direct, no medical claims, no diagnosis. Use ${profile.units} units.`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: 'How are stress and sleep affecting my progress?' }] }],
      generationConfig: {
        temperature: 0.6,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { headline: { type: 'STRING' }, body: { type: 'STRING' }, tips: { type: 'ARRAY', items: { type: 'STRING' } } },
          required: ['headline', 'body', 'tips'],
        },
      },
    },
    30_000,
    'wellbeing',
  );
  const j = JSON.parse(raw);
  return { headline: String(j.headline ?? ''), body: String(j.body ?? ''), tips: (j.tips ?? []).slice(0, 3).map(String) };
}

// Fastest first, since the user is waiting to hear the answer; a model this key can't use falls
// through to the next one.
const TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
let ttsModel = 0;

/** The Coach's voice before a persona is picked (each persona has its own, see lib/personas.ts). */
export const DEFAULT_VOICE = 'Puck';

/** Natural speech for a Coach reply. Usually 16-bit 24 kHz mono PCM; mimeType says which. */
export async function synthesizeSpeech(opts: { apiKey: string; text: string; voice: string }): Promise<Media> {
  const { apiKey, text, voice } = opts;
  for (; ttsModel < TTS_MODELS.length; ttsModel++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await aiFetch({
        apiKey,
        model: TTS_MODELS[ttsModel],
        method: 'generateContent',
        feature: 'voice',
        id: requestId(),
        signal: ctrl.signal,
        body: JSON.stringify({
          // Only the words to say: TTS models read any style instruction in the text out loud.
          // The tone comes from the chosen voice.
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg: string = json?.error?.message ?? `Speech request failed (${res.status})`;
        if (res.status === 404 || /not found|not supported|unsupported|modalit/i.test(msg)) continue;
        throw new AiError(msg, res.status >= 500 || res.status === 429);
      }
      type Part = { inlineData?: { data?: string; mimeType?: string } };
      const audio = (json?.candidates?.[0]?.content?.parts as Part[] | undefined)?.find((p) => p.inlineData?.data)?.inlineData;
      if (!audio?.data) throw new AiError(t('errors.noAudio'));
      return { base64: audio.data, mimeType: audio.mimeType ?? 'audio/L16;rate=24000' };
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw new AiError(t('errors.speechTooSlow'));
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  ttsModel = 0; // try again from the top next time, e.g. after the key changes
  throw new AiError(t('errors.noSpeechModel'), false);
}

/** Comic-book captions for the weekly recap, in the user's coach persona voice. */
export async function weeklyRecapCaptions(opts: { apiKey: string; model: string; profile: Profile; digest: string }): Promise<RecapCaptions> {
  const { apiKey, model, profile, digest } = opts;
  const persona = personaById(profile.persona);
  const raw = await generate(
    apiKey,
    model,
    {
      systemInstruction: {
        parts: [
          {
            text: `You are ${persona.name}, a fitness coach whose personality is ${persona.style}
You are writing captions for a comic-book page that recaps the user's last 7 days. Goal: ${GOAL_INFO[profile.goal].label}. Use ${profile.units} units.
THE WEEK:
${digest}
Write: title (3-6 words, ALL CAPS, comic headline), training, fuel, mind (one punchy caption each, max 16 words, citing their numbers), verdict (max 22 words: honest, encouraging, one thing to do next week). Stay in character. If a part has no data, say so playfully.`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: 'Recap my week.' }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { title: { type: 'STRING' }, training: { type: 'STRING' }, fuel: { type: 'STRING' }, mind: { type: 'STRING' }, verdict: { type: 'STRING' } },
          required: ['title', 'training', 'fuel', 'mind', 'verdict'],
        },
      },
    },
    30_000,
    'recap',
  );
  const j = JSON.parse(raw);
  return { title: String(j.title ?? ''), training: String(j.training ?? ''), fuel: String(j.fuel ?? ''), mind: String(j.mind ?? ''), verdict: String(j.verdict ?? '') };
}

export interface PlannedMeal {
  name: string;
  when: string; // "Breakfast", "Lunch", "Snack", "Dinner"
  emoji: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  steps: string;
}
export interface MealPlan {
  summary: string;
  days: { label: string; meals: PlannedMeal[] }[];
  grocery: { item: string; qty: string; aisle: string }[];
}

/** A meal plan that fits what's left today ("today") or the full targets for 3 days, plus a grocery list. */
export async function makeMealPlan(opts: { apiKey: string; model: string; profile: Profile; entries: Entry[]; span: 'today' | '3days'; prefs: string }): Promise<MealPlan> {
  const { apiKey, model, profile, entries, span, prefs } = opts;
  const persona = personaById(profile.persona);
  const raw = await generate(
    apiKey,
    model,
    {
      systemInstruction: {
        parts: [
          {
            text: `You are ${persona.name}, a fitness coach and practical nutritionist. Personality: ${persona.style}
${userContext(profile, entries)}
Build a meal plan. ${
              span === 'today'
                ? 'Plan only the REST OF TODAY: meals that together fit the REMAINING calories and protein above (skip meals already eaten given the time of day; at least one meal).'
                : 'Plan the next 3 days ("Day 1", "Day 2", "Day 3"), each day hitting the daily calorie and macro targets within ~5%.'
            }
Use simple, realistic home cooking with common supermarket ingredients; reuse ingredients across meals to keep the grocery list short. Per meal: name, when (Breakfast/Lunch/Snack/Dinner), one emoji, calories, protein, carbs, fat (grams), ingredients with amounts, steps (1-2 short sentences).
grocery: a combined shopping list for all meals with quantity and aisle (Produce, Meat & Fish, Dairy & Eggs, Pantry, Bakery, Frozen, Other).
summary: one or two sentences in character on why this plan works for their goal (${GOAL_INFO[profile.goal].label}).
Use ${profile.units} units for ingredient amounts.${prefs.trim() ? `\nUSER PREFERENCES (must follow): ${prefs.trim()}` : ''}`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: span === 'today' ? 'Plan the rest of my day.' : 'Plan my next 3 days.' }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            summary: { type: 'STRING' },
            days: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  label: { type: 'STRING' },
                  meals: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        name: { type: 'STRING' },
                        when: { type: 'STRING' },
                        emoji: { type: 'STRING' },
                        calories: { type: 'NUMBER' },
                        protein: { type: 'NUMBER' },
                        carbs: { type: 'NUMBER' },
                        fat: { type: 'NUMBER' },
                        ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
                        steps: { type: 'STRING' },
                      },
                      required: ['name', 'when', 'emoji', 'calories', 'protein', 'carbs', 'fat', 'ingredients', 'steps'],
                    },
                  },
                },
                required: ['label', 'meals'],
              },
            },
            grocery: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { item: { type: 'STRING' }, qty: { type: 'STRING' }, aisle: { type: 'STRING' } }, required: ['item', 'qty', 'aisle'] },
            },
          },
          required: ['summary', 'days', 'grocery'],
        },
      },
    },
    60_000,
    span === 'today' ? 'meal_plan' : 'meal_plan_3d',
  );
  const j = JSON.parse(raw) as MealPlan;
  return { summary: j.summary ?? '', days: j.days ?? [], grocery: j.grocery ?? [] };
}

/** Nutrition for a meal the Coach logged without numbers (repairs incomplete entries). */
export async function estimateMeal(opts: { apiKey: string; model: string; description: string; units: Profile['units'] }): Promise<Nutrition> {
  const raw = await generate(
    opts.apiKey,
    opts.model,
    {
      systemInstruction: { parts: [{ text: 'You are a nutritionist. Estimate realistic total nutrition for the described food or drink, including every serving mentioned. Return numbers only.' }] },
      contents: [{ role: 'user', parts: [{ text: opts.description }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { calories: { type: 'NUMBER' }, protein: { type: 'NUMBER' }, carbs: { type: 'NUMBER' }, fat: { type: 'NUMBER' }, fiber: { type: 'NUMBER' }, sugar: { type: 'NUMBER' } },
          required: ['calories', 'protein', 'carbs', 'fat'],
        },
      },
    },
    20_000,
    'estimate',
  );
  const j = JSON.parse(raw);
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : 0);
  return { calories: n(j.calories), protein: n(j.protein), carbs: n(j.carbs), fat: n(j.fat), fiber: n(j.fiber), sugar: n(j.sugar) };
}

export interface PlannedExercise {
  name: string;
  sets: string; // "4" or "1" for cardio
  reps: string; // "8-10", "30 min", "45 s"
  rest: string; // "90 s"
  notes: string;
}
export interface WorkoutDay {
  title: string; // "Push: chest & triceps", "Zone 2 run"
  focus: string; // "Strength", "Cardio", "Mobility", "Rest"
  emoji: string;
  rest: boolean;
  durationMin: number;
  estKcal: number;
  exercises: PlannedExercise[];
}

// How each goal shapes the week: lifting-heavy to build, cardio-led to lose, both for recomp.
const GOAL_TRAINING: Record<Profile['goal'], string> = {
  gain: 'Build muscle: mostly resistance training (4-5 lifting days, a push/pull/legs or upper/lower split), compound lifts first, 6-12 reps, progressive overload, at most one short low-intensity cardio session, and rest days.',
  lose: 'Fat loss: cardio-led (3-4 sessions mixing zone-2 steady cardio and one interval session) plus 2 full-body strength days to keep muscle, a daily steps habit, and one rest or mobility day.',
  recomp: 'Recomposition: 3-4 strength days (full-body or upper/lower) with progressive overload, plus 2 moderate cardio sessions, and rest days.',
  maintain: 'Maintenance: balanced week with 3 strength days, 2 cardio or sport days, mobility, and rest.',
};

/** A goal-specific workout plan for 1, 3 or 7 days starting today. */
export async function makeWorkoutPlan(opts: { apiKey: string; model: string; profile: Profile; entries: Entry[]; days: number; prefs: string }): Promise<{ summary: string; days: WorkoutDay[] }> {
  const { apiKey, model, profile, entries, days, prefs } = opts;
  const persona = personaById(profile.persona);
  const raw = await generate(
    apiKey,
    model,
    {
      systemInstruction: {
        parts: [
          {
            text: `You are ${persona.name}, a certified strength and conditioning coach. Personality: ${persona.style}
${userContext(profile, entries)}
GOAL: ${GOAL_INFO[profile.goal].label}. ${GOAL_TRAINING[profile.goal]}
Activity level: ${profile.activity}. Create exactly ${days} day${days > 1 ? 's' : ''} of training starting today, in order. Look at RECENT ENTRIES so you don't repeat yesterday's muscle groups, and if today's stress is high or sleep was short, make today lighter.
Per day: title, focus (Strength / Cardio / HIIT / Mobility / Rest), one emoji, rest (true for a rest day, with a short mobility or walk suggestion as its only exercise), durationMin, estKcal (calories burned for this person's ${profile.weightKg} kg body weight), and exercises (name, sets, reps or time, rest between sets, one short coaching note on form or intensity). Typical session 30-60 min, 4-7 exercises with a warm-up first.
summary: one or two sentences in character on how this plan serves the goal. Use ${profile.units} units for any loads or distances.${prefs.trim() ? `\nUSER PREFERENCES (must follow, e.g. equipment, injuries, time): ${prefs.trim()}` : ''}`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: days === 1 ? "Plan today's workout." : `Plan my next ${days} days of training.` }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            summary: { type: 'STRING' },
            days: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  focus: { type: 'STRING' },
                  emoji: { type: 'STRING' },
                  rest: { type: 'BOOLEAN' },
                  durationMin: { type: 'NUMBER' },
                  estKcal: { type: 'NUMBER' },
                  exercises: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: { name: { type: 'STRING' }, sets: { type: 'STRING' }, reps: { type: 'STRING' }, rest: { type: 'STRING' }, notes: { type: 'STRING' } },
                      required: ['name', 'sets', 'reps', 'rest', 'notes'],
                    },
                  },
                },
                required: ['title', 'focus', 'emoji', 'rest', 'durationMin', 'estKcal', 'exercises'],
              },
            },
          },
          required: ['summary', 'days'],
        },
      },
    },
    60_000,
    days <= 1 ? 'workout_plan' : days <= 3 ? 'workout_plan_3d' : 'workout_plan_7d',
  );
  const j = JSON.parse(raw);
  return { summary: String(j.summary ?? ''), days: (j.days ?? []).slice(0, days) };
}
