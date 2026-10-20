// Public legal pages, required by the App Store for subscriptions (guideline 3.1.2) and for any app
// that handles health data. Set the real URLs per build with these env vars before submitting.
import { t } from './i18n';

export const LEGAL = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://sslugic.github.io/pulse-site/privacy.html',
  terms: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://sslugic.github.io/pulse-site/terms.html',
  support: process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://sslugic.github.io/pulse-site/',
};

/** Shown with Coach advice and in onboarding (App Store guideline 1.4.1 for health apps). */
export const HEALTH_DISCLAIMER = t('crew.healthDisclaimer');
