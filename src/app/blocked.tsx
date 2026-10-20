import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton } from '@/components/icon';
import { squadFail } from '@/components/squad-bits';
import { Card, Chip, T } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { listBlocked, refreshSquad, unblockPlayer } from '@/lib/social';

/** Players you blocked, with a way to unblock them. */
export default function BlockedScreen() {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<{ user_id: string; name: string }[] | null>(null);

  const load = () => listBlocked().then(setList).catch((e) => (squadFail(e), setList([])));
  useEffect(() => {
    load();
  }, []);

  const unblock = (p: { user_id: string; name: string }) =>
    Alert.alert(t('squad.unblockTitle', { name: p.name }), t('squad.unblockBody'), [
      { text: t('squad.cancel'), style: 'cancel' },
      {
        text: t('squad.unblock'),
        onPress: () =>
          unblockPlayer(p.user_id)
            .then(() => (load(), refreshSquad()))
            .catch(squadFail),
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <Comic size={34} style={{ flex: 1 }}>
            {t('squad.blockedPlayers')}
          </Comic>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>
        {list === null ? (
          <ActivityIndicator color={C.lime} />
        ) : list.length ? (
          <Card style={{ gap: 10 }}>
            {list.map((p) => (
              <View key={p.user_id} style={styles.row}>
                <T size={14} rounded color={C.text} style={{ flex: 1 }}>
                  {p.name}
                </T>
                <Chip label={t('squad.unblock')} onPress={() => unblock(p)} />
              </View>
            ))}
          </Card>
        ) : (
          <T size={13} color={C.textDim}>
            {t('squad.noBlocked')}
          </T>
        )}
        <T size={12} color={C.textMute} style={{ lineHeight: 17 }}>
          {t('squad.blockedNote')}
        </T>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.md, paddingTop: Space.lg, gap: Space.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
