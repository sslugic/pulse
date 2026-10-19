import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';
import { appleSignInAvailable, cloudConfigured, devBackend, devSignIn } from '@/lib/cloud';
import { actions, useStore } from '@/lib/store';

import { Icon } from './icon';
import { TokenCoin } from './quests-card';
import { Card, T, tap } from './ui';

/** Pulse account: Sign in with Apple, credit balance, backup, sign out and account deletion. */
export function AccountCard() {
  const account = useStore((s) => s.account);
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    appleSignInAvailable().then(setApple);
  }, []);

  const run = async (what: string, fn: () => Promise<unknown>) => {
    tap();
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code !== 'ERR_REQUEST_CANCELED') Alert.alert('Something went wrong', err.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  if (!cloudConfigured) {
    return (
      <Card>
        <T size={13} color={C.textDim}>
          Accounts aren’t set up in this build yet.
        </T>
      </Card>
    );
  }

  if (!account.userId) {
    return (
      <Card style={{ gap: 12 }} accent={C.yellow + '99'}>
        <View style={styles.row}>
          <TokenCoin size={28} />
          <T size={13} color={C.text} style={{ flex: 1, lineHeight: 18 }}>
            Sign in to get <T size={13} rounded color={C.yellow}>50 free AI credits</T>, buy more, and back up your progress.
          </T>
        </View>
        {apple ? (
          busy === 'signin' ? (
            <ActivityIndicator color={C.text} />
          ) : (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={10}
              style={{ height: 48 }}
              onPress={() => run('signin', () => actions.signInWithApple())}
            />
          )
        ) : (
          <T size={12} color={C.textMute}>
            Sign in with Apple isn’t available on this device.
          </T>
        )}
        {__DEV__ && devBackend && (
          <Pressable onPress={() => run('dev', () => devSignIn())} style={styles.small}>
            <T size={12} rounded color={C.orange}>
              DEV: SIGN IN WITH TEST ACCOUNT
            </T>
          </Pressable>
        )}
      </Card>
    );
  }

  return (
    <Card style={{ gap: 12 }} accent={C.yellow + '99'}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <T size={11} rounded color={C.textDim}>
            SIGNED IN
          </T>
          <T size={14} color={C.text} numberOfLines={1}>
            {account.email?.endsWith('privaterelay.appleid.com') ? 'Apple ID (email hidden)' : (account.email ?? 'Apple ID')}
          </T>
        </View>
        <Pressable onPress={() => router.push('/credits')} style={styles.credits} accessibilityRole="button">
          <TokenCoin size={20} />
          <T size={16} rounded color={C.yellow}>
            {account.credits?.toLocaleString() ?? '—'}
          </T>
          <Icon name="chevron" size={12} color={C.yellow} />
        </Pressable>
      </View>
      {account.subscription?.active && (
        <T size={12} rounded color={C.lime}>
          ⭐ PULSE PRO
        </T>
      )}
      <Pressable onPress={() => router.push('/credits')} style={styles.action}>
        <T size={13} rounded color={C.ink}>
          GET MORE CREDITS
        </T>
      </Pressable>
      <View style={styles.row}>
        <Pressable onPress={() => run('backup', () => actions.backupNow())} style={styles.small}>
          {busy === 'backup' ? <ActivityIndicator size="small" color={C.cyan} /> : <Icon name="retry" size={13} color={C.cyan} />}
          <T size={12} rounded color={C.cyan}>
            BACK UP NOW
          </T>
        </Pressable>
        <Pressable onPress={() => run('signout', () => actions.signOut())} style={styles.small}>
          <T size={12} rounded color={C.textDim}>
            SIGN OUT
          </T>
        </Pressable>
      </View>
      <T size={11} color={C.textMute}>
        {account.backedUpAt ? `Backed up ${new Date(account.backedUpAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Your data backs up automatically while signed in.'}
      </T>
      <Pressable
        onPress={() =>
          Alert.alert(
            'Delete your account?',
            'This permanently deletes your Pulse account, your remaining credits and your cloud backup. Your logs stay on this phone. An active Pulse Pro subscription must be cancelled in your Apple ID settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete account', style: 'destructive', onPress: () => run('delete', () => actions.deleteAccount()) },
            ],
          )
        }
        hitSlop={8}>
        <T size={12} color={C.danger}>
          {busy === 'delete' ? 'Deleting…' : 'Delete account'}
        </T>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  credits: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#2A2410' },
  action: { alignItems: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: C.yellow, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4 },
  small: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, backgroundColor: '#1D2023', borderWidth: 2, borderColor: C.ink },
});
