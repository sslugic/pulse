// Local admin for Pulse: lists every account with its credit balance, keeps private labels on this
// Mac (labels.json, never committed), and grants credits. It talks to production through the
// Supabase CLI you're already logged into, so no database keys live here.
//
//   npm run admin   →   http://localhost:4391
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { appStoreStats } from './appstore.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PROJECT = process.env.PULSE_PROJECT_REF ?? 'zkdvvnrjpcodmvqdbbck';
const PORT = Number(process.env.PORT ?? 4391);
const LABELS = join(HERE, 'labels.json');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Runs one SQL statement on production and returns its rows. Writes need write=true. */
function sql(statement, { write = false } = {}) {
  const args = ['supabase', 'db', 'query', `--remote=${PROJECT}`, '--output-format', 'json', write ? '--yes' : '--read-only', statement];
  return new Promise((resolve, reject) => {
    execFile('npx', args, { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      // In a normal terminal the CLI prints the rows as a bare JSON array; under an AI agent it wraps
      // them as { rows, boundary, warning } or { error }. Accept both.
      const start = stdout.search(/[[{]/);
      try {
        const out = JSON.parse(stdout.slice(start));
        if (Array.isArray(out)) return resolve(out);
        if (out.error) return reject(new Error(out.error.message ?? String(out.error)));
        resolve(out.rows ?? []);
      } catch {
        reject(new Error((stderr || err?.message || 'Supabase CLI failed').trim().split('\n').slice(-3).join(' ')));
      }
    });
  });
}

const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function labels() {
  try {
    return JSON.parse(await readFile(LABELS, 'utf8'));
  } catch {
    return {};
  }
}

const USERS = `
  select u.id, u.email, u.is_anonymous as guest, u.created_at, u.last_sign_in_at,
         sp.name, sp.level, sp.streak,
         coalesce(l.balance, 0) as balance, coalesce(l.bought, 0) as bought, coalesce(l.used, 0) as used, l.last_at,
         s.active as pro, s.expires_at as pro_until
  from auth.users u
  left join public.social_profiles sp on sp.user_id = u.id
  left join (
    select user_id, sum(delta) as balance,
           sum(delta) filter (where reason in ('purchase', 'subscription')) as bought,
           -sum(delta) filter (where reason = 'usage') as used,
           max(created_at) as last_at
    from public.credit_ledger group by user_id
  ) l on l.user_id = u.id
  left join public.subscriptions s on s.user_id = u.id
  order by u.created_at desc`;

const routes = {
  'GET /api/appstore': (q) => appStoreStats({ fresh: q.get('fresh') === '1' }),
  'GET /api/users': async () => {
    const [rows, names] = await Promise.all([sql(USERS), labels()]);
    return rows.map((r) => ({ ...r, label: names[r.id] ?? '' }));
  },
  'GET /api/ledger': async (q) => {
    if (!UUID.test(q.get('id') ?? '')) throw new Error('Bad user id');
    return sql(`select delta, reason, ref, meta, created_at from public.credit_ledger where user_id = ${quote(q.get('id'))} order by created_at desc limit 100`);
  },
  'POST /api/label': async (_q, body) => {
    if (!UUID.test(body.id ?? '')) throw new Error('Bad user id');
    const names = await labels();
    const label = String(body.label ?? '').trim().slice(0, 80);
    if (label) names[body.id] = label;
    else delete names[body.id];
    await writeFile(LABELS, JSON.stringify(names, null, 2) + '\n');
    return { ok: true };
  },
  'POST /api/grant': async (_q, body) => {
    const amount = Number(body.amount);
    if (!UUID.test(body.id ?? '')) throw new Error('Bad user id');
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10000) throw new Error('Amount must be a whole number between -10000 and 10000, not 0');
    const note = String(body.note ?? '').slice(0, 200);
    // A unique ref per click: grant_credits ignores a repeated ref, so a double submit can't pay twice.
    const ref = `admin:local:${body.nonce && /^[a-z0-9-]{8,64}$/.test(body.nonce) ? body.nonce : randomUUID()}`;
    await sql(
      `select public.grant_credits(${quote(body.id)}::uuid, ${amount}, 'admin', ${quote(ref)}, jsonb_build_object('note', ${quote(note)}, 'by', 'local-admin'))`,
      { write: true },
    );
    const [row] = await sql(`select public.credit_balance(${quote(body.id)}::uuid) as balance`);
    return { ok: true, balance: row?.balance ?? null, ref };
  },
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const send = (status, type, data) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(data);
  };
  try {
    if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html; charset=utf-8', await readFile(join(HERE, 'index.html')));
    const route = routes[`${req.method} ${url.pathname}`];
    if (!route) return send(404, 'application/json', JSON.stringify({ error: 'Not found' }));
    // Writes only from this page: another site in the browser can't set this header cross-origin.
    if (req.method === 'POST' && req.headers['x-pulse-admin'] !== '1') return send(403, 'application/json', JSON.stringify({ error: 'Forbidden' }));
    let body = {};
    if (req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      body = raw ? JSON.parse(raw) : {};
    }
    send(200, 'application/json', JSON.stringify(await route(url.searchParams, body)));
  } catch (e) {
    send(400, 'application/json', JSON.stringify({ error: e.message }));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Pulse admin on http://localhost:${PORT} (project ${PROJECT})`));
