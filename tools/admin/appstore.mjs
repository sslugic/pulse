// App Store numbers for the admin page, from the App Store Connect API.
//
// Two sources:
// - Sales reports (Sales and Trends): units per day, by product type. First-time downloads, redownloads,
//   updates and in-app purchases. Available for any day up to yesterday.
// - Analytics reports: impressions, product page views and downloads, which give the conversion rate.
//   Apple only starts generating these after an ONGOING report request exists for the app, and the
//   first data shows up 1–2 days later. ensureRequest() creates that request once.
//
// Credentials come from tools/admin/asc.json (gitignored), see asc.example.json. The .p8 private key
// stays wherever you keep it; this file only reads it to sign a short-lived token.
import { createPrivateKey, sign } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG = join(HERE, 'asc.json');
const CACHE = join(HERE, '.appstore-cache.json');
const API = 'https://api.appstoreconnect.apple.com';

async function config() {
  let c;
  try {
    c = JSON.parse(await readFile(CONFIG, 'utf8'));
  } catch {
    throw new Error('App Store Connect isn’t set up: copy tools/admin/asc.example.json to asc.json and fill it in.');
  }
  for (const k of ['keyId', 'issuerId', 'keyPath', 'appId']) if (!c[k]) throw new Error(`asc.json is missing "${k}".`);
  return c;
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

async function token(c) {
  const key = createPrivateKey(await readFile(c.keyPath.replace(/^~/, process.env.HOME ?? ''), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const head = b64url({ alg: 'ES256', kid: c.keyId, typ: 'JWT' });
  const body = b64url({ iss: c.issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' });
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}

async function call(c, path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    method,
    headers: { authorization: `Bearer ${await token(c)}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && raw) return null; // no sales report for that day (yet)
  if (!res.ok) {
    const text = await res.text();
    let detail = text.slice(0, 300);
    try {
      detail = JSON.parse(text).errors?.map((e) => e.detail || e.title).join('; ') || detail;
    } catch {}
    throw new Error(`App Store Connect ${res.status}: ${detail}`);
  }
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

/** Tab-separated report text → array of row objects keyed by header. */
function tsv(text) {
  const [head, ...lines] = text.trim().split('\n');
  const cols = head.split('\t').map((h) => h.trim());
  return lines.filter(Boolean).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v.trim()])));
}

const ymd = (d) => d.toISOString().slice(0, 10);

// Product type identifiers in Sales reports (Apple's "Product Type Identifiers" reference).
const FIRST = new Set(['1', '1F', '1T']); // first-time downloads (paid or free) for iPhone/universal apps
const RE = new Set(['3', '3F', '3T']); // redownloads
const UPDATE = new Set(['7', '7F', '7T']);
const IAP = new Set(['IA1', 'IA9', 'IAY', 'IAC', 'FI1']);

async function salesDay(c, date) {
  if (!c.vendorNumber) return null;
  const q = new URLSearchParams({
    'filter[frequency]': 'DAILY',
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[vendorNumber]': String(c.vendorNumber),
    'filter[reportDate]': date,
  });
  const gz = await call(c, `/v1/salesReports?${q}`, { raw: true });
  const day = { date, firstDownloads: 0, redownloads: 0, updates: 0, purchases: 0, proceeds: 0, currency: '' };
  if (!gz) return day;
  for (const r of tsv(gunzipSync(gz).toString('utf8'))) {
    // In-app purchases carry the app's id in Parent Identifier (as the SKU), apps in Apple Identifier.
    const ours = r['Apple Identifier'] === String(c.appId) || (c.sku && (r['SKU'] === c.sku || r['Parent Identifier'] === c.sku));
    if (!ours) continue;
    const units = Number(r['Units']) || 0;
    const t = r['Product Type Identifier'];
    if (FIRST.has(t)) day.firstDownloads += units;
    else if (RE.has(t)) day.redownloads += units;
    else if (UPDATE.has(t)) day.updates += units;
    else if (IAP.has(t)) {
      day.purchases += units;
      day.proceeds += units * (Number(r['Developer Proceeds']) || 0);
      day.currency = r['Currency of Proceeds'] || day.currency;
    }
  }
  return day;
}

/** Finds the app's ONGOING analytics report request, creating it the first time. */
async function ensureRequest(c) {
  const list = await call(c, `/v1/apps/${c.appId}/analyticsReportRequests`);
  const found = list.data?.find((r) => r.attributes?.accessType === 'ONGOING' && !r.attributes?.stoppedDueToInactivity);
  if (found) return { id: found.id, created: false };
  const made = await call(c, '/v1/analyticsReportRequests', {
    method: 'POST',
    body: {
      data: {
        type: 'analyticsReportRequests',
        attributes: { accessType: 'ONGOING' },
        relationships: { app: { data: { type: 'apps', id: String(c.appId) } } },
      },
    },
  });
  return { id: made.data.id, created: true };
}

async function all(c, path) {
  const out = [];
  for (let next = path; next; ) {
    const page = await call(c, next);
    out.push(...(page.data ?? []));
    next = page.links?.next;
  }
  return out;
}

/** Downloads every daily instance of one analytics report and returns its rows. */
async function reportRows(c, requestId, name, days) {
  const reports = await all(c, `/v1/analyticsReportRequests/${requestId}/reports?filter[name]=${encodeURIComponent(name)}`);
  const rows = [];
  for (const rep of reports) {
    const instances = await all(c, `/v1/analyticsReports/${rep.id}/instances?filter[granularity]=DAILY`);
    for (const inst of instances.filter((i) => i.attributes?.processingDate >= days[0])) {
      for (const seg of await all(c, `/v1/analyticsReportInstances/${inst.id}/segments`)) {
        const gz = await call(c, seg.attributes.url, { raw: true });
        if (gz) rows.push(...tsv(gunzipSync(gz).toString('utf8')));
      }
    }
  }
  return rows;
}

const pick = (row, ...names) => {
  for (const n of names) for (const k of Object.keys(row)) if (k.toLowerCase() === n.toLowerCase()) return row[k];
  return undefined;
};

async function analytics(c, days) {
  const req = await ensureRequest(c);
  const byDay = Object.fromEntries(days.map((d) => [d, { impressions: 0, pageViews: 0, downloads: 0 }]));
  const [engagement, downloads] = await Promise.all([
    reportRows(c, req.id, 'App Store Discovery and Engagement Standard', days),
    reportRows(c, req.id, 'App Downloads Standard', days),
  ]);
  for (const r of engagement) {
    const d = byDay[pick(r, 'Date')];
    if (!d) continue;
    const event = (pick(r, 'Event') ?? '').toLowerCase();
    const n = Number(pick(r, 'Unique Counts', 'Counts')) || 0;
    if (event.includes('impression')) d.impressions += n;
    else if (event.includes('page view')) d.pageViews += n;
  }
  for (const r of downloads) {
    const d = byDay[pick(r, 'Date')];
    if (!d) continue;
    const type = (pick(r, 'Download Type') ?? '').toLowerCase();
    if (type.includes('first')) d.downloads += Number(pick(r, 'Counts')) || 0;
  }
  return { requestCreated: req.created, haveData: engagement.length + downloads.length > 0, byDay };
}

/** Last `count` days (ending yesterday, in UTC) of sales and analytics, cached for an hour. */
export async function appStoreStats({ count = 30, fresh = false } = {}) {
  if (!fresh) {
    try {
      const cached = JSON.parse(await readFile(CACHE, 'utf8'));
      if (Date.now() - cached.at < 60 * 60 * 1000) return cached.stats;
    } catch {}
  }
  const c = await config();
  const days = [];
  for (let i = count; i >= 1; i--) days.push(ymd(new Date(Date.now() - i * 86400000)));
  const [sales, ana] = await Promise.all([
    Promise.all(days.map((d) => salesDay(c, d).catch(() => null))),
    analytics(c, days).catch((e) => ({ error: e.message })),
  ]);
  const rows = days.map((date, i) => ({ date, ...(sales[i] ?? {}), ...(ana.byDay?.[date] ?? {}) }));
  const sum = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const totals = {
    firstDownloads: sum('firstDownloads'),
    redownloads: sum('redownloads'),
    purchases: sum('purchases'),
    proceeds: Math.round(sum('proceeds') * 100) / 100,
    currency: rows.find((r) => r.currency)?.currency ?? '',
    impressions: sum('impressions'),
    pageViews: sum('pageViews'),
    analyticsDownloads: sum('downloads'),
  };
  totals.conversion = totals.pageViews ? totals.analyticsDownloads / totals.pageViews : null;
  const stats = {
    rows,
    totals,
    salesConfigured: Boolean(c.vendorNumber),
    analytics: ana.error ? { error: ana.error } : { requestCreated: ana.requestCreated, haveData: ana.haveData },
  };
  await writeFile(CACHE, JSON.stringify({ at: Date.now(), stats }));
  return stats;
}
