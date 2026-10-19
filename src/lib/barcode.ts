// Packaged-food lookup by barcode via Open Food Facts (free, public, no key). Only the barcode is sent.

export interface FoodProduct {
  code: string;
  name: string;
  brand?: string;
  servingLabel: string; // e.g. "30 g" or "100 g"
  perServing: { calories: number; protein: number; carbs: number; fat: number; fiber?: number; sugar?: number };
}

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() && isFinite(Number(v)) ? Number(v) : undefined);

export async function lookupBarcode(code: string): Promise<FoodProduct | null> {
  const clean = code.replace(/\D/g, '');
  if (!clean) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,brands,nutriments,serving_size,serving_quantity`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Pulse/1.0 (iOS fitness app)' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
    const j = await res.json();
    if (j.status !== 1 || !j.product) return null;
    const p = j.product;
    const n = p.nutriments ?? {};
    const servingG = num(p.serving_quantity);
    // Prefer per-serving numbers from the label; otherwise scale per-100g to the serving, or show per 100 g.
    const pick = (key: string) => num(n[`${key}_serving`]) ?? (servingG ? (num(n[`${key}_100g`]) ?? 0) * (servingG / 100) : num(n[`${key}_100g`]));
    const kcal = num(n['energy-kcal_serving']) ?? (servingG ? (num(n['energy-kcal_100g']) ?? 0) * (servingG / 100) : num(n['energy-kcal_100g']));
    if (kcal == null) return null;
    const usesServing = num(n['energy-kcal_serving']) != null || !!servingG;
    return {
      code: clean,
      name: String(p.product_name || 'Scanned food').trim(),
      brand: p.brands ? String(p.brands).split(',')[0].trim() : undefined,
      servingLabel: usesServing ? String(p.serving_size || `${servingG} g`) : '100 g',
      perServing: {
        calories: kcal,
        protein: pick('proteins') ?? 0,
        carbs: pick('carbohydrates') ?? 0,
        fat: pick('fat') ?? 0,
        fiber: pick('fiber'),
        sugar: pick('sugars'),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
