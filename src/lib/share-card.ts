import type { ChestTier } from './arcade';

// What a share card shows. <ShareCardHost /> (mounted in the root layout) draws the card off
// screen, captures it and opens the share sheet. Kept apart from the component so art components
// like the chest can ask for a card without importing the host.

export type ShareCard =
  | { kind: 'streak'; days: number; name: string; rank: string }
  | { kind: 'rank'; level: number; rank: string; name: string; xp: number }
  | { kind: 'chest'; tier: ChestTier; lines: string[]; name: string }
  | { kind: 'challenge'; title: string; vs?: string; name: string }
  | { kind: 'crew'; crew: string; days: number; members: number };

let handler: ((card: ShareCard) => void) | null = null;

/** Opens the share sheet with a card. */
export function shareCard(card: ShareCard) {
  handler?.(card);
}

/** Used by <ShareCardHost /> to receive requests. */
export function onShareCard(h: ((card: ShareCard) => void) | null) {
  handler = h;
}
