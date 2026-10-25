// Invite links shared from the app (https://pulseretro.fit/invite.html?f=CODE, ?c= or ?r=) open Pulse
// directly as universal links. Map them to the in-app routes that add the friend, join the crew or
// claim the referral. Everything else passes through unchanged.

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'https://pulseretro.fit');
    if (/\/invite(\.html)?$/.test(url.pathname)) {
      const q = url.searchParams;
      const raw = q.get('f') ?? q.get('c') ?? q.get('r') ?? '';
      const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (code) return q.has('f') ? `/add/${code}` : q.has('c') ? `/join/${code}` : `/r/${code}`;
      return '/';
    }
  } catch {
    // not a URL we understand
  }
  return path;
}
