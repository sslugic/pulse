// RevenueCat webhook: turns App Store purchases into credits. RevenueCat validates the receipt
// with Apple and calls this with an event; we grant credits once per event id (replays are
// harmless) and keep the subscription row in sync. The app's RevenueCat user id is the Supabase
// user id, so `app_user_id` tells us whose account to credit.
import { admin, json } from '../_shared/common.ts';

const GRANT = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH')?.trim();
  // RevenueCat sends the header exactly as typed in its dashboard, so accept the secret with or
  // without the "Bearer " prefix and ignore stray whitespace.
  const sent = (req.headers.get('Authorization') ?? '').trim().replace(/^Bearer\s+/i, '');
  if (!secret || sent !== secret) {
    console.warn('webhook auth failed', { length: sent.length, bearer: /^Bearer\s/i.test(req.headers.get('Authorization') ?? '') });
    return json({ error: 'unauthorized' }, 401);
  }

  const body = await req.json().catch(() => null);
  const e = body?.event;
  if (!e?.id || !e?.type) return json({ error: 'bad_request' }, 400);

  const uid: string | undefined = [e.app_user_id, ...(e.aliases ?? [])].find((id: string) => UUID.test(id ?? ''));
  // Anonymous RevenueCat ids (before sign-in) can't be credited; acknowledge so RevenueCat stops retrying.
  if (!uid) return json({ ok: true, skipped: 'no_account' });
  if (e.environment === 'SANDBOX' && Deno.env.get('ALLOW_SANDBOX') !== 'true') return json({ ok: true, skipped: 'sandbox' });

  const db = admin();
  const { data: product } = await db.from('products').select('credits, kind').eq('product_id', e.product_id).maybeSingle();

  if (GRANT.has(e.type)) {
    if (!product) {
      console.error('unknown product', e.product_id);
      return json({ ok: true, skipped: 'unknown_product' });
    }
    const why = product.kind === 'subscription' ? 'subscription' : 'purchase';
    const { error } = await db.rpc('grant_credits', { uid, amount: product.credits, why, ref_key: `rc:${e.id}`, info: { product_id: e.product_id, type: e.type, store: e.store } });
    if (error) return json({ error: error.message }, 500);
  }

  // Refunds take the credits back (they may go negative if already spent).
  if (e.type === 'CANCELLATION' && e.cancel_reason === 'CUSTOMER_SUPPORT' && product) {
    await db.rpc('grant_credits', { uid, amount: -product.credits, why: 'revoked', ref_key: `rc-refund:${e.id}`, info: { product_id: e.product_id } });
  }

  if (product?.kind === 'subscription') {
    const active = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'].includes(e.type) || (e.type === 'CANCELLATION' && e.expiration_at_ms > Date.now());
    await db.from('subscriptions').upsert({
      user_id: uid,
      product_id: e.product_id,
      active: e.type === 'EXPIRATION' ? false : active,
      will_renew: !['CANCELLATION', 'EXPIRATION'].includes(e.type),
      expires_at: e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
  }
  return json({ ok: true });
});
