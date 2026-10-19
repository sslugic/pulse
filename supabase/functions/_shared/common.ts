import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'x-credits-balance, x-credits-cost',
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', ...extra } });
}

/** Service-role client: bypasses RLS, so only use it after checking who the caller is. */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}

/** The signed-in user behind the request's bearer token, or null. */
export async function callerOf(req: Request, db: SupabaseClient): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error ? null : data.user;
}
