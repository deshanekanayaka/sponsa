const LEGAL_SUFFIXES: ReadonlySet<string> = new Set([
  'limited',
  'ltd',
  'plc',
  'llp',
  'llc',
  'inc',
  'cic',
  'cio',
  'lp',
]);

export function normalise(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normaliseName(name: string): string {
  const words = normalise(name).split(' ').filter(Boolean);
  const kept = [...words];
  while (kept.length > 0 && LEGAL_SUFFIXES.has(kept[kept.length - 1]!)) {
    kept.pop();
  }
  return kept.length > 0 ? kept.join(' ') : words.join(' ');
}

export function identityKey(name: string, town: string): string {
  return `${normaliseName(name)}|${normalise(town)}`;
}
