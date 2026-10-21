import { router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';

import { FeatureTour } from '@/components/feature-tour';
import { QuickFab } from '@/components/quick-fab';
import { RewardsPopup } from '@/components/rewards-popup';
import { StreetTabBar } from '@/components/street-tab-bar';
import { C } from '@/constants/theme';

import { onShortcutLink, takePendingLink } from '../../../modules/pulse-intents';

export default function TabsLayout() {
  // Siri, Shortcuts, the Action Button and Back Tap open the Coach (see plugins/app-intents). Handled
  // here, once the tabs exist, so a cold launch from Siri has somewhere to navigate to.
  useEffect(() => {
    const go = (url: string | null) => {
      if (url?.startsWith('pulse://')) setTimeout(() => router.navigate(url.slice('pulse:/'.length) as never), 0);
    };
    go(takePendingLink());
    const off = onShortcutLink(go);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && go(takePendingLink()));
    return () => {
      off();
      sub.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Tabs tabBar={(props) => <StreetTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="coach" />
        <Tabs.Screen name="journal" />
        <Tabs.Screen name="squad" />
        <Tabs.Screen name="arcade" />
        <Tabs.Screen name="trends" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <QuickFab />
      <RewardsPopup />
      <FeatureTour />
    </View>
  );
}
