import { Tabs } from 'expo-router/tabs';
import { View } from 'react-native';

import { QuickFab } from '@/components/quick-fab';
import { RewardsPopup } from '@/components/rewards-popup';
import { StreetTabBar } from '@/components/street-tab-bar';
import { C } from '@/constants/theme';

export default function TabsLayout() {
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
    </View>
  );
}
