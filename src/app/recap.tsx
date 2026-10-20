import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { GlassButton, Icon, type IconName } from '@/components/icon';
import { MomentArt } from '@/components/moment-art';
import { T } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, Display, MaxContentWidth, Space } from '@/constants/theme';
import { weeklyRecapCaptions } from '@/lib/gemini';
import { locale, t } from '@/lib/i18n';
import { fmtKg } from '@/lib/nutrition';
import { personaById } from '@/lib/personas';
import { fallbackCaptions, weekStats, type RecapCaptions } from '@/lib/recap';
import { canUseAI, getState, useStore } from '@/lib/store';
import { moodEmoji } from '@/lib/wellbeing';

const fmtRange = (a: string, b: string) => {
  const f = (k: string) => new Date(k + 'T12:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' }).toLocaleUpperCase(locale);
  return `${f(a)} – ${f(b)}`;
};

/** The last 7 days as a comic page, captioned by the user's coach, ready to share as an image. */
export default function RecapScreen() {
  const insets = useSafeAreaInsets();
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const claims = useStore((s) => s.game.claims);
  const persona = personaById(profile.persona);
  const stats = useMemo(() => weekStats(entries, profile, claims), [entries, profile, claims]);
  const [captions, setCaptions] = useState<RecapCaptions>(() => fallbackCaptions(stats));
  const [loading, setLoading] = useState(() => canUseAI());
  const [round, setRound] = useState(0);
  const page = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    const s = getState();
    if (!canUseAI()) return;
    let cancelled = false;
    weeklyRecapCaptions({ apiKey: s.settings.apiKey, model: s.settings.model, profile: s.profile, digest: stats.digest })
      .then((c) => !cancelled && setCaptions(c))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [stats.digest, round]);

  const share = async () => {
    if (!page.current) return;
    try {
      // view-shot's types predate RN's element refs; the runtime accepts the host view.
      const uri = await captureRef(page as never, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('recap.shareDialogTitle'), UTI: 'public.png' });
      else Alert.alert(t('recap.sharingUnavailable'));
    } catch (err) {
      Alert.alert(t('recap.shareFailed'), (err as Error).message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Space.lg, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('recap.subtitle')}
            </T>
            <Comic size={36}>{t('recap.title')}</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        {/* The page that gets captured and shared */}
        <View ref={page} collapsable={false} style={styles.page}>
          <View style={[styles.panel, styles.titlePanel]}>
            <T size={11} rounded color={C.ink}>
              {t('recap.masthead', { range: fmtRange(stats.from, stats.to) })}
            </T>
            <Comic size={30} color={C.ink} outline="#fff" style={{ textAlign: 'center' }}>
              {captions.title}
            </Comic>
            <T size={12} rounded color={C.ink}>
              {t('recap.daysLogged', { n: stats.daysLogged })}
            </T>
            {loading && <ActivityIndicator color={C.ink} style={{ position: 'absolute', right: 10, top: 10 }} />}
          </View>

          <View style={styles.row}>
            <StatPanel icon="dumbbell" color={C.lime} big={`${stats.workouts}`} label={t('recap.workouts')} sub={t('recap.workoutsSub', { min: stats.activeMin, kcal: stats.burned })} caption={captions.training} />
            <StatPanel icon="fork" color={C.orange} big={`${stats.meals}`} label={t('recap.meals')} sub={t('recap.mealsSub', { n: stats.proteinDays })} caption={captions.fuel} />
          </View>

          {stats.bestMoment && (
            <View style={[styles.panel, { gap: 8, padding: 8 }]}>
              <MomentArt scene={stats.bestMoment.scene} mood={stats.bestMoment.mood} height={130} />
              <View style={styles.bubble}>
                <T size={10} rounded color={C.pink}>
                  {t('recap.momentOfWeek')}
                </T>
                <T size={13} color={C.ink} style={{ lineHeight: 18 }} numberOfLines={3}>
                  “{stats.bestMoment.summary}”
                </T>
              </View>
            </View>
          )}

          <View style={styles.row}>
            <StatPanel
              icon="moon"
              color={C.violet}
              big={stats.avgSleep != null ? `${stats.avgSleep.toFixed(1)}h` : '—'}
              label={t('recap.avgSleep')}
              sub={stats.avgMood != null ? t('recap.mood', { emoji: moodEmoji(stats.avgMood) }) : t('recap.noMood')}
              caption={captions.mind}
            />
            <StatPanel
              icon="target"
              color={C.yellow}
              big={`${stats.questsCleared}`}
              label={t('recap.quests')}
              sub={t('recap.questsSub', { perfect: stats.perfectDays, tokens: stats.tokensEarned })}
              caption={stats.weightChangeKg != null ? t('recap.weightCaption', { change: `${stats.weightChangeKg < 0 ? '−' : '+'}${fmtKg(Math.abs(stats.weightChangeKg), profile.units)}` }) : t('recap.xpCaption', { xp: stats.xpFromQuests })}
            />
          </View>

          <View style={[styles.panel, styles.verdict]}>
            <View style={styles.avatar}>
              <T size={30}>{persona.emoji}</T>
            </View>
            <View style={[styles.bubble, { flex: 1 }]}>
              <T size={10} rounded color={C.violet}>
                {t('recap.personaSays', { name: persona.name.toUpperCase() })}
              </T>
              <T size={14} color={C.ink} style={{ lineHeight: 19, fontFamily: Display.block }}>
                {captions.verdict}
              </T>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: Space.md }}>
          <ArcadeButton label={t('recap.share')} size="md" onPress={share} icon={<Icon name="send" size={20} color="#FF7A1A" weight="bold" />} style={{ flex: 1 }} />
          <ArcadeButton
            label={t('recap.redraw')}
            size="md"
            colors={['#5FE2FF', '#1E8FE0']}
            textColor="#fff"
            disabled={loading || !canUseAI()}
            onPress={() => {
              setLoading(true);
              setRound((r) => r + 1);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function StatPanel({ icon, color, big, label, sub, caption }: { icon: IconName; color: string; big: string; label: string; sub: string; caption: string }) {
  return (
    <View style={[styles.panel, { flex: 1, gap: 4 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={16} color={color} />
        <T size={10} rounded color={C.textDim}>
          {label}
        </T>
      </View>
      <Comic size={34} color={color}>
        {big}
      </Comic>
      <T size={9} rounded color={C.textMute}>
        {sub}
      </T>
      <View style={[styles.bubble, { marginTop: 4 }]}>
        <T size={11} color={C.ink} style={{ lineHeight: 15 }}>
          {caption}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Space.sm },
  page: { gap: 8, padding: 8, borderRadius: 6, backgroundColor: '#F3EEDC', borderWidth: 4, borderColor: C.ink },
  panel: { padding: 10, borderRadius: 4, backgroundColor: '#1D2023', borderWidth: 3, borderColor: C.ink },
  titlePanel: { alignItems: 'center', gap: 4, backgroundColor: C.yellow, paddingVertical: 14 },
  row: { flexDirection: 'row', gap: 8 },
  bubble: { padding: 8, borderRadius: 10, backgroundColor: '#fff', borderWidth: 2, borderColor: C.ink, gap: 2 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#2A1E3A' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D2023', borderWidth: 3, borderColor: C.violet },
});
