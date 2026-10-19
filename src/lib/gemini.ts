// React Native's fetch can't read a response as it arrives; expo/fetch can.
import { fetch as streamingFetch } from 'expo/fetch';

import type { ChatMessage, Entry, Goal, Pace, Profile, Targets } from './types';
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
  ) {
    super(message);
  }
}

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
    caloriesBurned: { type: 'NUMBER' },
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

function systemPrompt(profile: Profile, entries: Entry[]) {
  return `You are Pulse, an upbeat, knowledgeable AI fitness and nutrition coach inside a mobile app. Your replies are shown in a chat and read out loud, so write the way a good coach talks.
The user logs by talking, typing, or sending photos, and also asks you questions. Your job: turn whatever they log into structured log entries with realistic estimates, and answer their fitness questions like a real coach who knows their numbers.

${userContext(profile, entries)}

RULES
- Food photo or description -> one "meal" entry per meal (not per ingredient). List components in "items" with portion estimates. Estimate portions from visual cues (plate size, utensils). Fill nutrition incl. fiber/sugar/sodium.
- Exercise (text, voice, or a photo of a workout, machine display, or smartwatch screen) -> "exercise" entry. Compute caloriesBurned with MET x body weight (${profile.weightKg} kg) x hours unless the screen shows a number. Infer a sensible duration if missing and say you assumed it.
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
- reply when answering a question: as long as the answer needs, usually 2-6 sentences; a workout or plan can run longer. Steps or exercises may go on separate lines starting with "- ". No markdown headings, bold or tables. Spell out units the first time if it helps it read aloud. Use ${profile.units} units.`;
}

// Gemini 3 accepts a thinking level; older models reject it, so we drop it on that error.
let thinkingSupported = true;

function requestBody(body: Record<string, unknown>) {
  const generationConfig = {
    ...(body.generationConfig as object),
    ...(thinkingSupported ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
  };
  return JSON.stringify({ ...body, generationConfig });
}

function requestError(status: number, json: { error?: { message?: string } }) {
  const msg = json?.error?.message ?? `Request failed (${status})`;
  if (status === 400 && thinkingSupported && /thinking/i.test(msg)) {
    thinkingSupported = false;
    return new AiError('retry-without-thinking');
  }
  if (/API key/i.test(msg)) return new AiError('That API key was rejected. Check it in Profile.', false);
  if (status === 429) return new AiError('Gemini is rate-limiting requests. Try again in a moment.');
  return new AiError(msg, status >= 500);
}

function networkError(err: unknown) {
  if ((err as Error).name === 'AbortError') return new AiError('Gemini took too long to answer.');
  if (err instanceof AiError) return err;
  return new AiError('Network problem — check your connection.');
}

/** Runs a request with a hard timeout and one retry on transient failures. */
async function withRetry(attempt: (signal: AbortSignal) => Promise<string>, timeoutMs: number, canRetry = () => true) {
  const run = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await attempt(ctrl.signal);
    } catch (err) {
      throw networkError(err);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await run();
  } catch (err) {
    const e = err as AiError;
    if (!e.retryable || !canRetry()) throw e;
    await new Promise((r) => setTimeout(r, e.message === 'retry-without-thinking' ? 0 : 1200));
    return run();
  }
}

/** POST generateContent and return the whole text answer. */
function generate(apiKey: string, model: string, body: Record<string, unknown>, timeoutMs: number): Promise<string> {
  return withRetry(async (signal) => {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: requestBody(body),
      signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw requestError(res.status, json);
    const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!text) throw new AiError('Gemini returned an empty answer.');
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
): Promise<string> {
  let started = false;
  return withRetry(
    async (signal) => {
      const res = await streamingFetch(`${ENDPOINT}/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: requestBody(body),
        signal,
      });
      if (!res.ok) throw requestError(res.status, await res.json().catch(() => ({})));
      const reader = res.body?.getReader();
      if (!reader) throw new AiError('Streaming is not available.');
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
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
      if (!text) throw new AiError('Gemini returned an empty answer.');
      return text;
    },
    timeoutMs,
    // Once text has reached the screen, a retry would show the answer twice.
    () => !started,
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
}): Promise<CoachResult> {
  const { apiKey, model, profile, entries, history, text, image, audio, onReply } = opts;
  if (!apiKey) throw new AiError('Add your Google AI API key in Profile to start logging.', false);

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
  const raw = onReply
    ? await generateStream(apiKey, model, body, timeoutMs, (json) => {
        const r = partialReply(json);
        if (!r || replyDone || (r.text === lastReply && !r.done)) return;
        lastReply = r.text;
        replyDone = r.done;
        onReply(r.text, r.done);
      })
    : await generate(apiKey, model, body, timeoutMs);
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
  if (!apiKey) throw new AiError('Add your Google AI API key in Profile first.', false);
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
            text: `You are Pulse, a friendly fitness coach. Write one motivating, specific insight about the user's day so far in under 22 words, using their numbers. Use ${profile.units} units. No greetings.\n\n${userContext(profile, entries)}`,
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
  );
  const j = JSON.parse(raw);
  return { headline: String(j.headline ?? ''), body: String(j.body ?? ''), tips: (j.tips ?? []).slice(0, 3).map(String) };
}

// Fastest first, since the user is waiting to hear the answer; a model this key can't use falls
// through to the next one.
const TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
let ttsModel = 0;

/** Gemini prebuilt voices offered for the Coach. */
export const COACH_VOICES = [
  { id: 'Puck', label: 'Upbeat' },
  { id: 'Kore', label: 'Firm' },
  { id: 'Fenrir', label: 'Hype' },
  { id: 'Aoede', label: 'Breezy' },
  { id: 'Charon', label: 'Calm' },
] as const;
export const DEFAULT_VOICE = 'Puck';

/** Natural speech for a Coach reply. Usually 16-bit 24 kHz mono PCM; mimeType says which. */
export async function synthesizeSpeech(opts: { apiKey: string; text: string; voice: string }): Promise<Media> {
  const { apiKey, text, voice } = opts;
  if (!apiKey) throw new AiError('No API key', false);
  for (; ttsModel < TTS_MODELS.length; ttsModel++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch(`${ENDPOINT}/${TTS_MODELS[ttsModel]}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          // Only the words to say: TTS models read any style instruction in the text out loud.
          // The tone comes from the chosen voice.
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
        signal: ctrl.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg: string = json?.error?.message ?? `Speech request failed (${res.status})`;
        if (res.status === 404 || /not found|not supported|unsupported|modalit/i.test(msg)) continue;
        throw new AiError(msg, res.status >= 500 || res.status === 429);
      }
      type Part = { inlineData?: { data?: string; mimeType?: string } };
      const audio = (json?.candidates?.[0]?.content?.parts as Part[] | undefined)?.find((p) => p.inlineData?.data)?.inlineData;
      if (!audio?.data) throw new AiError('Gemini returned no audio.');
      return { base64: audio.data, mimeType: audio.mimeType ?? 'audio/L16;rate=24000' };
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw new AiError('Speech took too long.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  ttsModel = 0; // try again from the top next time, e.g. after the key changes
  throw new AiError('No Gemini speech model is available for this key.', false);
}
