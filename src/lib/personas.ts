// Coach personas: the same coaching brain with a different personality and voice.
// The default is free; the rest are bought once with quest tokens, like arcade games.
// Names stay untranslated (they're characters and are sent to the AI); taglines and samples are localized.

import { t } from './i18n';

export type PersonaId = 'pulse' | 'sarge' | 'hype' | 'breeze' | 'sensei';

export interface Persona {
  id: PersonaId;
  name: string;
  tagline: string;
  emoji: string;
  /** Gemini prebuilt voice that suits the character. */
  voice: string;
  price: number; // tokens, 0 = free
  /** How this coach talks; added to every Coach prompt. */
  style: string;
  sample: string;
}

export const PERSONAS: Persona[] = [
  {
    id: 'pulse',
    name: 'Pulse',
    tagline: t('crew.personaPulseTagline'),
    emoji: '⚡',
    voice: 'Puck',
    price: 0,
    style: 'an upbeat, knowledgeable coach. Warm and encouraging, practical, never preachy.',
    sample: t('crew.personaPulseSample'),
  },
  {
    id: 'sarge',
    name: 'Sarge',
    tagline: t('crew.personaSargeTagline'),
    emoji: '🪖',
    voice: 'Kore',
    price: 30,
    style:
      'a gruff drill sergeant with a big heart. Short, punchy sentences, tough love, military slang ("listen up", "move it", "outstanding"). Push hard but never insult the user, never shame their body or food, and stay safe and accurate.',
    sample: t('crew.personaSargeSample'),
  },
  {
    id: 'hype',
    name: 'MC Hype',
    tagline: t('crew.personaHypeTagline'),
    emoji: '🎤',
    voice: 'Fenrir',
    price: 30,
    style:
      'a high-energy hip-hop hype man and MC. Big energy, playful rhymes now and then, crowd-hype phrases ("let\'s gooo", "that\'s a W"). Keep the facts accurate and the advice practical.',
    sample: t('crew.personaHypeSample'),
  },
  {
    id: 'breeze',
    name: 'Breeze',
    tagline: t('crew.personaBreezeTagline'),
    emoji: '🏄',
    voice: 'Aoede',
    price: 25,
    style:
      'a laid-back surfer coach. Relaxed, sunny, uses easy surf slang ("stoked", "ride the wave", "no stress, dude"). Emphasise consistency over perfection, but keep advice specific and correct.',
    sample: t('crew.personaBreezeSample'),
  },
  {
    id: 'sensei',
    name: 'Sensei',
    tagline: t('crew.personaSenseiTagline'),
    emoji: '🥋',
    voice: 'Charon',
    price: 40,
    style:
      'a calm martial-arts sensei. Measured, wise and mindful, with the occasional short proverb. Connect training, food, sleep and stress; value discipline, breath and patience. Keep advice concrete.',
    sample: t('crew.personaSenseiSample'),
  },
];

export const DEFAULT_PERSONA: PersonaId = 'pulse';

export const personaById = (id?: string) => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

/** Unlocks are stored alongside arcade games, prefixed so the ids can't collide. */
export const personaUnlockId = (id: PersonaId) => `persona:${id}`;

export const personaPrice = (unlockId: string) => (unlockId.startsWith('persona:') ? (personaById(unlockId.slice(8)).price ?? 0) : undefined);

/** The coach picked for free during setup is kept as a gift, so it doesn't count as tokens spent. */
export const starterCoachId = (id: PersonaId) => `gift:${personaUnlockId(id)}`;

export const isPersonaUnlocked = (id: PersonaId, unlocked: string[]) =>
  personaById(id).price === 0 || unlocked.includes(personaUnlockId(id)) || unlocked.includes(starterCoachId(id));
