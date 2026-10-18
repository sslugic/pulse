import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { dayKey } from './nutrition';

/** Today's day key, refreshed when the app returns to the foreground (e.g. after midnight). */
export function useTodayKey() {
  const [key, setKey] = useState(() => dayKey(Date.now()));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setKey(dayKey(Date.now()));
    });
    return () => sub.remove();
  }, []);
  return key;
}
