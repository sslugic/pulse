import { Tabs } from 'expo-router/tabs';

import { StreetTabBar } from '@/components/street-tab-bar';
import { C } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <StreetTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="coach" />
      <Tabs.Screen name="trends" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
