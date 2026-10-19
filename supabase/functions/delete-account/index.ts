// Permanently deletes the caller's account (App Store guideline 5.1.1(v)): the auth user, and by
// cascade their profile, credit ledger, subscription row and cloud backup. Purchases already made
// stay with Apple; the user manages any active subscription in their Apple ID settings.
import { admin, callerOf, cors, json } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'method_not_allowed' }, 405);
  const db = admin();
  const user = await callerOf(req, db);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
