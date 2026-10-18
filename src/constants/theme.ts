import '@/global.css';

import { Platform } from 'react-native';

// Pulse is dark-first: deep ink background, glassy surfaces, neon accents.
export const C = {
  bg: '#07080C',
  surface: '#11131A',
  surfaceHi: '#1A1D27',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F7FA',
  textDim: '#9AA1B2',
  textMute: '#5D6475',

  lime: '#C6FF3D',
  cyan: '#3DE7FF',
  violet: '#9B7BFF',
  pink: '#FF5CA8',
  orange: '#FF9F43',
  blue: '#4D8BFF',

  // Semantic
  eaten: '#FF9F43',
  burned: '#3DE7FF',
  protein: '#FF5CA8',
  carbs: '#C6FF3D',
  fat: '#9B7BFF',
  water: '#4D8BFF',
  danger: '#FF5C5C',
} as const;

export const Gradients = {
  brand: ['#C6FF3D', '#3DE7FF'] as const,
  violet: ['#9B7BFF', '#FF5CA8'] as const,
  warm: ['#FF9F43', '#FF5CA8'] as const,
  cool: ['#3DE7FF', '#4D8BFF'] as const,
};

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

export const Radius = { sm: 12, md: 18, lg: 26, pill: 999 } as const;
export const Space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const MaxContentWidth = 640;
