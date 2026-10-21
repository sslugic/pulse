import { t } from './i18n';

// Unlockable app icons (art in scripts/app-icons/icons.html, added to iOS by
// plugins/with-alternate-icons.js). Classic is always there; the rest unlock by rank, by a
// best-ever streak, or as a rare drop from a gold chest. Unlocks live in game.unlocked as icon:<id>.

export type AppIconId = 'classic' | 'synthwave' | 'neon' | 'rain' | 'arcade' | 'gold';

export interface AppIconDef {
  id: AppIconId;
  name: string;
  /** Alternate icon name in the iOS asset catalog; null for the main icon. */
  native: string | null;
  thumb: number;
  /** Street Crew level (1-based) that unlocks it. */
  level?: number;
  /** Unlocks at this best-ever streak, in days. */
  streak?: number;
  /** Only drops from gold chests. */
  chest?: boolean;
}

export const APP_ICONS: AppIconDef[] = [
  { id: 'classic', name: t('appIcons.classic'), native: null, thumb: require('@/assets/app-icons/classic-thumb.png') },
  { id: 'synthwave', name: t('appIcons.synthwave'), native: 'AppIcon-Synthwave', thumb: require('@/assets/app-icons/synthwave-thumb.png'), level: 5 },
  { id: 'neon', name: t('appIcons.neon'), native: 'AppIcon-NeonSign', thumb: require('@/assets/app-icons/neon-sign-thumb.png'), level: 8 },
  { id: 'rain', name: t('appIcons.rain'), native: 'AppIcon-MidnightRain', thumb: require('@/assets/app-icons/midnight-rain-thumb.png'), streak: 30 },
  { id: 'arcade', name: t('appIcons.arcade'), native: 'AppIcon-Arcade', thumb: require('@/assets/app-icons/arcade-thumb.png'), chest: true },
  { id: 'gold', name: t('appIcons.gold'), native: 'AppIcon-GoldLegend', thumb: require('@/assets/app-icons/gold-legend-thumb.png'), level: 15 },
];

/** Unlock marker kept in game.unlocked when an icon drops from a chest. */
export const appIconUnlockId = (id: AppIconId) => `icon:${id}`;

export const isAppIconUnlocked = (icon: AppIconDef, level: number, unlocked: string[], bestStreak: number) =>
  icon.id === 'classic' ||
  unlocked.includes(appIconUnlockId(icon.id)) ||
  (icon.level != null && level >= icon.level) ||
  (icon.streak != null && bestStreak >= icon.streak);

/** What it takes to unlock a locked icon. */
export function appIconHint(icon: AppIconDef, rankName: (level: number) => string) {
  if (icon.chest) return t('appIcons.unlocksChest');
  if (icon.streak != null) return t('appIcons.unlocksStreak', { days: icon.streak });
  return t('appIcons.unlocksAt', { rank: rankName(icon.level ?? 1) });
}
