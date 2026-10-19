import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { AppState, Platform } from 'react-native';

// Pulse cloud: Supabase holds the account (Sign in with Apple), the AI credit balance, and an
// optional backup of the app's data. The Gemini key lives on the server; signed-in AI calls go
// through the `ai` edge function, which charges credits per feature.

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** True when this build has a Supabase project configured. */
export const cloudConfigured = !!URL && !!KEY;

// Release exports also render routes on a server (no `window`), where the auth client's storage
// can't run; only start the client in the app itself.
const inApp = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase = cloudConfigured && inApp
  ? createClient(URL, KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

let session: Session | null = null;
const listeners = new Set<(s: Session | null) => void>();

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    session = data.session;
    listeners.forEach((l) => l(session));
  });
  supabase.auth.onAuthStateChange((_event, s) => {
    session = s;
    listeners.forEach((l) => l(session));
  });
  // Refresh tokens only while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const currentSession = () => session;
export const onSessionChange = (l: (s: Session | null) => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Endpoint and token for the AI proxy, or null when not signed in. */
export function cloudAI() {
  return supabase && session ? { url: `${URL}/functions/v1/ai`, token: session.access_token } : null;
}

export async function appleSignInAvailable() {
  return Platform.OS === 'ios' && cloudConfigured && (await AppleAuthentication.isAvailableAsync());
}

/**
 * Native Sign in with Apple, exchanged for a Supabase session. A random nonce is sent to Apple
 * hashed and to Supabase raw, so the identity token can't be replayed.
 */
export async function signInWithApple() {
  if (!supabase) throw new Error('Pulse cloud isn’t configured in this build.');
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce: hashed,
  });
  if (!cred.identityToken) throw new Error('Apple didn’t return a sign-in token.');
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: raw });
  if (error) throw error;
  const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
  return { user: data.user, name };
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/** Deletes the account and everything stored with it on the server. */
export async function deleteAccount() {
  if (!supabase) return;
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut();
}

export async function fetchBalance(): Promise<number | null> {
  if (!supabase || !session) return null;
  const { data, error } = await supabase.rpc('my_balance');
  return error ? null : (data as number);
}

export async function fetchCosts(): Promise<Record<string, number>> {
  if (!supabase) return {};
  const { data } = await supabase.from('feature_costs').select('feature, credits');
  return Object.fromEntries((data ?? []).map((r: { feature: string; credits: number }) => [r.feature, r.credits]));
}

export async function fetchSubscription(): Promise<{ active: boolean; expiresAt?: string; willRenew: boolean } | null> {
  if (!supabase || !session) return null;
  const { data } = await supabase.from('subscriptions').select('active, expires_at, will_renew').maybeSingle();
  return data ? { active: data.active, expiresAt: data.expires_at ?? undefined, willRenew: data.will_renew } : null;
}

/** Saves the app's local data to the signed-in account. */
export async function saveBackup(data: unknown) {
  if (!supabase || !session) return;
  await supabase.from('user_state').upsert({ user_id: session.user.id, data, updated_at: new Date().toISOString() });
}

export async function loadBackup(): Promise<{ data: unknown; updatedAt: string } | null> {
  if (!supabase || !session) return null;
  const { data } = await supabase.from('user_state').select('data, updated_at').maybeSingle();
  return data ? { data: data.data, updatedAt: data.updated_at } : null;
}

/** A local Supabase (supabase start) is configured; enables the test sign-in in development builds. */
export const devBackend = /127\.0\.0\.1|localhost/.test(URL);

/** Development only: signs in to the local backend with a throwaway email account (Apple sign-in needs a real project). */
export async function devSignIn() {
  if (!supabase || !__DEV__ || !devBackend) return;
  const email = 'dev@pulse.test';
  const password = 'pulse-dev-password';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const { error: e2 } = await supabase.auth.signUp({ email, password });
    if (e2) throw e2;
  }
}
