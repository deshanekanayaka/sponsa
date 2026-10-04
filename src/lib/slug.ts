import { normalise } from './identity.ts';

export function slugify(value: string): string {
  return normalise(value).replace(/ /g, '-');
}

export function mintSlug(name: string, town: string, taken: ReadonlySet<string>): string {
  const base = slugify(name) || 'sponsor';
  if (!taken.has(base)) return base;

  const townSlug = slugify(town);
  const withTown = townSlug ? `${base}-${townSlug}` : base;
  if (townSlug && !taken.has(withTown)) return withTown;

  for (let n = 2; ; n += 1) {
    const numbered = `${withTown}-${n}`;
    if (!taken.has(numbered)) return numbered;
  }
}
