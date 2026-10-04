import { parse } from 'csv-parse';
import { identityKey, normalise, normaliseName } from './identity.ts';

export const PUBLICATION_URL =
  'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers';

export const ROUTE_SEPARATOR = '::';

export type RegisterRow = {
  readonly identityKey: string;
  readonly name: string;
  readonly normName: string;
  readonly town: string;
  readonly townNorm: string;
  readonly county: string;
  readonly route: string;
  readonly rating: string;
};

export type Sponsor = {
  readonly identityKey: string;
  readonly name: string;
  readonly normName: string;
  readonly town: string;
  readonly townNorm: string;
  readonly county: string;
  readonly routes: Set<string>;
};

export async function findCsvUrl(fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(PUBLICATION_URL, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`gov.uk content API returned ${response.status}`);
  }
  const body = (await response.json()) as {
    details?: { attachments?: { url?: string }[] };
  };
  const attachments = body.details?.attachments ?? [];
  if (attachments.length !== 1) {
    throw new Error(
      `gov.uk content API listed ${attachments.length} attachments, expected exactly 1`,
    );
  }
  const url = attachments[0]?.url;
  if (!url) throw new Error('gov.uk content API listed an attachment with no url');
  return url;
}

export function toRow(raw: Record<string, string>): RegisterRow {
  const name = (raw['Organisation Name'] ?? '').trim();
  const town = (raw['Town/City'] ?? '').trim();
  return {
    identityKey: identityKey(name, town),
    name,
    normName: normaliseName(name),
    town,
    townNorm: normalise(town),
    county: (raw['County'] ?? '').trim(),
    route: (raw['Route'] ?? '').trim(),
    rating: (raw['Type & Rating'] ?? '').trim(),
  };
}

export type ParsedRegister = {
  readonly rowCount: number;
  readonly sponsors: Map<string, Sponsor>;
};

export async function parseRegister(
  source: AsyncIterable<Uint8Array>,
): Promise<ParsedRegister> {
  const parser = parse({ columns: true, bom: true, skip_empty_lines: true });
  const sponsors = new Map<string, Sponsor>();
  let rowCount = 0;

  const pump = (async () => {
    for await (const chunk of source) {
      if (!parser.write(chunk)) {
        await new Promise((resolve) => parser.once('drain', resolve));
      }
    }
    parser.end();
  })();

  for await (const raw of parser) {
    const row = toRow(raw as Record<string, string>);
    rowCount += 1;
    if (!row.name) continue;
    const routeKey = `${row.route}${ROUTE_SEPARATOR}${row.rating}`;
    const existing = sponsors.get(row.identityKey);
    if (existing) {
      existing.routes.add(routeKey);
      continue;
    }
    sponsors.set(row.identityKey, {
      identityKey: row.identityKey,
      name: row.name,
      normName: row.normName,
      town: row.town,
      townNorm: row.townNorm,
      county: row.county,
      routes: new Set([routeKey]),
    });
  }

  await pump;
  return { rowCount, sponsors };
}
