// The bay category vocabulary. The store and map layers speak PLURAL categories;
// the lifted places GeoJSON predates the store and speaks singular ones. CANON
// folds both vocabularies to the plural form so a `startup` dot and a
// `startups` record weigh the same — ported from ayaan-site's
// assets/bay/personas.js so server ranking and map emphasis can never drift.

export const BAY_CATEGORIES = [
  'housing',
  'sports',
  'tours',
  'hackathons',
  'offices',
  'startups',
  'events',
] as const;

export type BayCategory = (typeof BAY_CATEGORIES)[number];

export const CANON: Record<string, BayCategory> = {
  // the store's own plural vocabulary
  housing: 'housing',
  sports: 'sports',
  tours: 'tours',
  hackathons: 'hackathons',
  offices: 'offices',
  startups: 'startups',
  events: 'events',
  // the static places geojson predates the store and speaks singular
  startup: 'startups',
  office: 'offices',
  tour: 'tours',
};

/** Fold a raw category into its canonical plural form, or null when unknown —
 * callers reject rather than silently miscategorize. */
export function canonicalCategory(raw: string): BayCategory | null {
  return CANON[raw] ?? null;
}
