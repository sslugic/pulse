import { Platform } from 'react-native';

import PulseWidget from '@/widgets/pulse-widget';

import { dailyQuests, questXp } from './quests';
import { dayKey, macroTargets, streak, summarize } from './nutrition';
import { crewRank } from './rank';
import { getState } from './store';

let timer: ReturnType<typeof setTimeout> | undefined;

/** Pushes today's numbers to the home screen widget, debounced so a burst of logs is one update. */
export function syncWidget() {
  if (Platform.OS !== 'ios') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const { entries, profile, game } = getState();
      const today = dayKey(Date.now());
      const t = macroTargets(profile);
      const sum = summarize(entries, today);
      const crew = crewRank(entries, questXp(game.claims), game.frozenDays);
      PulseWidget.updateSnapshot({
        streak: streak(entries, game.frozenDays),
        kcalLeft: Math.round(t.calories + sum.burned - sum.eaten),
        questsCleared: dailyQuests(entries, t, today, game.claims).filter((q) => q.claimed).length,
        rank: crew.rank,
        rankProgress: crew.progress,
        water: t.waterMl ? Math.min(1, sum.water / t.waterMl) : 0,
      });
    } catch (err) {
      console.warn('[widget] update failed', err);
    }
  }, 800);
}
