// Apple Push Notification service, shared by the functions that push to players' iPhones.
//
// Push secrets (set with `supabase secrets set`): APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (the
// .p8 file's contents) and APNS_TOPIC (the app's bundle identifier).

let cachedJwt: { token: string; at: number } | null = null;

/** Provider token for APNs, reused for 50 minutes (Apple accepts them for up to an hour). */
async function apnsJwt(): Promise<string | null> {
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const pem = Deno.env.get('APNS_PRIVATE_KEY');
  if (!keyId || !teamId || !pem) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.at < 50 * 60) return cachedJwt.token;

  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\\n|\s/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const b64 = (data: Uint8Array | string) =>
    btoa(typeof data === 'string' ? data : String.fromCharCode(...data)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${b64(JSON.stringify({ alg: 'ES256', kid: keyId }))}.${b64(JSON.stringify({ iss: teamId, iat: now }))}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)));
  cachedJwt = { token: `${unsigned}.${b64(sig)}`, at: now };
  return cachedJwt.token;
}

/** Sends one notification. Returns Apple's HTTP status, or 0 when push isn't configured or failed. */
export async function pushToApple(token: string, sandbox: boolean, payload: unknown): Promise<number> {
  const jwt = await apnsJwt();
  const topic = Deno.env.get('APNS_TOPIC');
  if (!jwt || !topic) return 0;
  const host = sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  try {
    const res = await fetch(`${host}/3/device/${token}`, {
      method: 'POST',
      headers: { authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status !== 200) console.warn('[apns]', res.status, await res.text().catch(() => ''));
    return res.status;
  } catch (e) {
    console.warn('[apns] failed', e);
    return 0;
  }
}
