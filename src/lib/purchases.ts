import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from 'react-native-purchases';

// In-app purchases through RevenueCat. RevenueCat checks the receipt with Apple, then calls the
// Supabase `revenuecat-webhook`, which adds the credits to the account. The RevenueCat user id is
// the Supabase user id, so a purchase always lands on the signed-in account.

const KEY = Platform.OS === 'ios' ? (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '') : (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '');

/** True when this build has a RevenueCat key for this platform. */
export const purchasesConfigured = !!KEY;

let configured = false;
function ensureConfigured(userId?: string) {
  if (!purchasesConfigured) return false;
  if (!configured) {
    Purchases.configure({ apiKey: KEY, appUserID: userId });
    configured = true;
  }
  return true;
}

export async function linkPurchases(userId: string) {
  if (!ensureConfigured(userId)) return;
  await Purchases.logIn(userId);
}

export async function unlinkPurchases() {
  if (!configured) return;
  if (!(await Purchases.getCustomerInfo()).originalAppUserId.startsWith('$RCAnonymousID')) await Purchases.logOut();
}

export interface CreditOffer {
  id: string;
  title: string;
  description: string;
  price: string;
  kind: 'pack' | 'subscription';
  pkg: PurchasesPackage;
}

/** The current offering's packages: credit packs and the Pulse Pro subscription. */
export async function loadOffers(): Promise<CreditOffer[]> {
  if (!ensureConfigured()) return [];
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return pkgs.map((p) => ({
    id: p.product.identifier,
    title: p.product.title,
    description: p.product.description,
    price: p.product.priceString,
    kind: p.product.productCategory === 'SUBSCRIPTION' || p.packageType === 'MONTHLY' ? 'subscription' : 'pack',
    pkg: p,
  }));
}

/** Buys a package. Resolves false if the user cancelled the Apple sheet. */
export async function buy(offer: CreditOffer): Promise<boolean> {
  try {
    await Purchases.purchasePackage(offer.pkg);
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
    throw e;
  }
}

/** Restores the subscription on a new device or after reinstalling (an App Store requirement). */
export async function restore() {
  if (!ensureConfigured()) return;
  await Purchases.restorePurchases();
}
