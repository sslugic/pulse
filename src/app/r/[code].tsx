import { Redirect } from 'expo-router';

/**
 * pulse://r/CODE: an old referral link. Referral codes no longer give credits (App Review guideline
 * 3.1.1), so the link just opens the Squad, where friends are added.
 */
export default function ReferralLink() {
  return <Redirect href="/squad" />;
}
