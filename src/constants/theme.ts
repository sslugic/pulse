import '@/global.css';

import { Platform } from 'react-native';

// "The Underground": 80s subway arcade. Concrete and riveted steel, with
// neon green, hazard orange, spray-paint purple and comic yellow on top.
export const C = {
  bg: '#16181A',
  surface: '#23272B',
  surfaceHi: '#30353A',
  border: 'rgba(0,0,0,0.55)',
  steel: '#6E747A',
  steelHi: '#A7ADB2',
  rust: '#8A4A22',
  ink: '#0B0C0D',
  text: '#F3EEDC',
  textDim: '#B5B09F',
  textMute: '#7A776C',

  lime: '#9CFF2E',
  cyan: '#38D6FF',
  violet: '#A267FF',
  pink: '#FF4FA0',
  orange: '#FF7A1A',
  yellow: '#FFD319',
  blue: '#3E8BFF',

  // Semantic
  eaten: '#FF7A1A',
  burned: '#38D6FF',
  protein: '#FF4FA0',
  carbs: '#9CFF2E',
  fat: '#A267FF',
  water: '#3E8BFF',
  danger: '#FF4141',
} as const;

export const Gradients = {
  brand: ['#B8FF4A', '#5BE01E'] as const,
  violet: ['#B07BFF', '#7A2FE0'] as const,
  warm: ['#FF9A3D', '#E8530E'] as const,
  cool: ['#5FE2FF', '#1E8FE0'] as const,
  arcade: ['#FFE34A', '#FFB800'] as const,
};

// Display faces are loaded in the root layout via expo-font.
export const Display = {
  comic: 'Bangers_400Regular',
  tag: 'PermanentMarker_400Regular',
  block: 'RussoOne_400Regular',
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: Display.block, mono: 'ui-monospace' },
  web: { sans: 'var(--font-display)', rounded: Display.block, mono: 'var(--font-mono)' },
  default: { sans: 'normal', rounded: Display.block, mono: 'monospace' },
});

export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const Space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const MaxContentWidth = 640;
