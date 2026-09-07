// Enrichment from OpenRouter's public catalog (no key needed):
// https://openrouter.ai/api/v1/models → context length, $/M pricing, modalities.
// Vendor prefixes differ per provider (nvidia "meta/..." vs openrouter
// "meta-llama/..."), so matching is done on the normalized model part.

interface CatalogEntry {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture: { modality: string; input_modalities: string[]; output_modalities: string[] };
}

export interface EnrichedMeta {
  displayName: string;
  contextWindow: string;
  inputPrice: number;
  outputPrice: number;
  modalities: string;
}

let cache: { at: number; data: CatalogEntry[] } | null = null;
const TTL = 12 * 3600_000;

export async function getCatalog(): Promise<CatalogEntry[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const r = await fetch("https://openrouter.ai/api/v1/models", { headers: { "User-Agent": "freeroute/1.0" } });
  if (!r.ok) throw new Error(`openrouter catalog ${r.status}`);
  const data = await r.json().catch(() => ({}));
  const list = Array.isArray(data?.data) ? data.data : [];
  cache = { at: Date.now(), data: list };
  return list;
}

function normModelPart(id: string): string {
  return id
    .toLowerCase()
    .replace(/:(free|nitro|floor|extended)$/, "")
    .split("/")
    .slice(1)
    .join("/")
    .replace(/_/g, "-");
}

function normVendor(id: string): string {
  return id.toLowerCase().split("/")[0].replace(/[-_]/g, "");
}

export function matchEntry(catalog: CatalogEntry[], slug: string): CatalogEntry | null {
  const low = slug.toLowerCase();
  // 1. exact id
  const exact = catalog.find((e) => e.id.toLowerCase() === low);
  if (exact) return exact;
  // 2. same model part, prefer overlapping vendor name
  const part = normModelPart(slug);
  if (!part) return null;
  const vendor = normVendor(slug);
  const cands = catalog.filter((e) => normModelPart(e.id) === part);
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0];
  const sameVendor = cands.find((e) => {
    const v = normVendor(e.id);
    return v.includes(vendor) || vendor.includes(v);
  });
  return sameVendor ?? cands[0];
}

export function fmtContext(n: number): string {
  if (!n || n <= 0) return "–";
  if (n >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(2))}M`;
  if (n >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`;
  return `${n}`;
}

const MOD_MAP: Record<string, string> = {
  text: "T",
  image: "IMG",
  audio: "AUD",
  video: "VID",
  document: "DOC",
  file: "DOC",
  pdf: "DOC",
};

export function toModalities(e: CatalogEntry): string {
  const set = new Set<string>();
  const arch = e.architecture ?? {};
  const pools = [
    ...(arch.input_modalities ?? []),
    ...(arch.output_modalities ?? []),
    ...(arch.modality ?? "").split("->"),
  ];
  for (const raw of pools) {
    const code = MOD_MAP[String(raw).trim().toLowerCase()];
    if (code) set.add(code);
  }
  if (set.size === 0) set.add("T");
  const order = ["T", "IMG", "DOC", "VID", "AUD"];
  return [...set].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(",");
}

function perMillion(x: unknown): number {
  const v = parseFloat(String(x ?? "0"));
  if (!isFinite(v) || v <= 0) return 0;
  return Math.round(v * 1_000_000 * 1_000_000) / 1_000_000;
}

export function enrich(slug: string, catalog: CatalogEntry[]): EnrichedMeta | null {
  const e = matchEntry(catalog, slug);
  if (!e) return null;
  return {
    displayName: e.name || slug,
    contextWindow: fmtContext(e.context_length),
    inputPrice: perMillion(e.pricing?.prompt),
    outputPrice: perMillion(e.pricing?.completion),
    modalities: toModalities(e),
  };
}
