import { Readable } from 'node:stream';
import pg from 'pg';
import { readEnv } from '../env.ts';
import {
  decideRename,
  SIMILARITY_THRESHOLD,
  type RenameCandidate,
} from '../lib/rename.ts';
import {
  findCsvUrl,
  parseRegister,
  ROUTE_SEPARATOR,
  type Sponsor,
} from '../lib/register.ts';
import { mintSlug } from '../lib/slug.ts';

const MIN_ROW_FRACTION = 0.9;
const BATCH_SIZE = 1000;

const USER_AGENT =
  'Sponsa/0.1 (+https://github.com/deshanekanayaka/sponsa; thariduek22@gmail.com)';

type Counts = {
  rowsRead: number;
  sponsorsInserted: number;
  sponsorsUnlisted: number;
  sponsorsRenamed: number;
  renamesAmbiguous: number;
};

async function download(url: string): Promise<AsyncIterable<Uint8Array>> {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`register download returned ${response.status}`);
  if (!response.body) throw new Error('register download returned no body');
  return Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
}

async function insertBatched(
  client: pg.ClientBase,
  statement: string,
  columns: number,
  values: readonly unknown[],
): Promise<void> {
  const rows = values.length / columns;
  for (let start = 0; start < rows; start += BATCH_SIZE) {
    const slice = values.slice(
      start * columns,
      Math.min(start + BATCH_SIZE, rows) * columns,
    );
    const tuples: string[] = [];
    for (let i = 0; i < slice.length / columns; i += 1) {
      const params = Array.from({ length: columns }, (_, c) => `$${i * columns + c + 1}`);
      tuples.push(`(${params.join(', ')})`);
    }
    await client.query(`${statement} ${tuples.join(', ')}`, slice);
  }
}

async function stage(
  client: pg.ClientBase,
  sponsors: Map<string, Sponsor>,
): Promise<void> {
  await client.query(`
    create temporary table staging_sponsors (
      identity_key text primary key,
      name text not null,
      norm_name text not null,
      town text not null,
      town_norm text not null,
      county text not null
    ) on commit drop
  `);
  await client.query(`
    create temporary table staging_routes (
      identity_key text not null,
      route text not null,
      rating text not null,
      primary key (identity_key, route, rating)
    ) on commit drop
  `);

  const sponsorValues: unknown[] = [];
  const routeValues: unknown[] = [];
  for (const sponsor of sponsors.values()) {
    sponsorValues.push(
      sponsor.identityKey,
      sponsor.name,
      sponsor.normName,
      sponsor.town,
      sponsor.townNorm,
      sponsor.county,
    );
    for (const routeKey of sponsor.routes) {
      const [route = '', rating = ''] = routeKey.split(ROUTE_SEPARATOR);
      routeValues.push(sponsor.identityKey, route, rating);
    }
  }

  await insertBatched(
    client,
    'insert into staging_sponsors (identity_key, name, norm_name, town, town_norm, county) values',
    6,
    sponsorValues,
  );
  await insertBatched(
    client,
    'insert into staging_routes (identity_key, route, rating) values',
    3,
    routeValues,
  );
  await client.query('create index on staging_sponsors (town_norm)');
  await client.query('analyze staging_sponsors');
}

async function pairRenames(
  client: pg.ClientBase,
  today: string,
): Promise<{ renamed: number; ambiguous: number }> {
  const { rows } = await client.query<{
    sponsor_id: string;
    new_key: string;
    sim: number;
  }>(
    `select a.id as sponsor_id, s.identity_key as new_key, similarity(a.norm_name, s.norm_name) as sim
     from sponsors a
     join staging_sponsors s on s.town_norm = a.town_norm
     where a.unlisted_at is null
       and not exists (select 1 from staging_sponsors t where t.identity_key = a.identity_key)
       and not exists (select 1 from sponsors b where b.identity_key = s.identity_key)
       and similarity(a.norm_name, s.norm_name) >= $1`,
    [SIMILARITY_THRESHOLD],
  );

  const bySponsor = new Map<number, { candidate: RenameCandidate; newKey: string }[]>();
  const keyUse = new Map<string, number>();
  for (const row of rows) {
    const sponsorId = Number(row.sponsor_id);
    const list = bySponsor.get(sponsorId) ?? [];
    list.push({
      candidate: { sponsorId, similarity: Number(row.sim) },
      newKey: row.new_key,
    });
    bySponsor.set(sponsorId, list);
    keyUse.set(row.new_key, (keyUse.get(row.new_key) ?? 0) + 1);
  }

  let renamed = 0;
  let ambiguous = 0;
  for (const [sponsorId, matches] of bySponsor) {
    const decision = decideRename(matches.map((m) => m.candidate));
    if (decision.kind !== 'paired') {
      ambiguous += 1;
      continue;
    }
    const match = matches[0]!;
    if ((keyUse.get(match.newKey) ?? 0) > 1) {
      ambiguous += 1;
      continue;
    }
    await client.query(
      `update sponsors
       set identity_key = s.identity_key,
           name = s.name,
           norm_name = s.norm_name,
           town = s.town,
           town_norm = s.town_norm,
           county = s.county,
           last_seen = $3
       from staging_sponsors s
       where sponsors.id = $1 and s.identity_key = $2`,
      [sponsorId, match.newKey, today],
    );
    renamed += 1;
  }
  return { renamed, ambiguous };
}

async function insertNewSponsors(
  client: pg.ClientBase,
  today: string,
  isBootstrap: boolean,
): Promise<number> {
  const { rows: takenRows } = await client.query<{ slug: string }>(
    'select slug from sponsors',
  );
  const taken = new Set(takenRows.map((r) => r.slug));

  const { rows: fresh } = await client.query<{
    identity_key: string;
    name: string;
    norm_name: string;
    town: string;
    town_norm: string;
    county: string;
  }>(
    `select s.identity_key, s.name, s.norm_name, s.town, s.town_norm, s.county
     from staging_sponsors s
     where not exists (select 1 from sponsors x where x.identity_key = s.identity_key)
     order by s.identity_key`,
  );

  const values: unknown[] = [];
  for (const row of fresh) {
    const slug = mintSlug(row.name, row.town, taken);
    taken.add(slug);
    values.push(
      row.identity_key,
      row.name,
      row.norm_name,
      slug,
      row.town,
      row.town_norm,
      row.county,
      today,
      today,
    );
  }
  await insertBatched(
    client,
    `insert into sponsors
       (identity_key, name, norm_name, slug, town, town_norm, county, first_seen, last_seen)
     values`,
    9,
    values,
  );
  if (isBootstrap && fresh.length === 0) {
    throw new Error('bootstrap inserted no sponsors');
  }
  return fresh.length;
}

async function run(): Promise<void> {
  const env = readEnv();
  const today = new Date().toISOString().slice(0, 10);
  const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
  await client.connect();

  const { rows: runRows } = await client.query<{ id: string }>(
    `insert into crawl_runs (kind) values ('ingest') returning id`,
  );
  const runId = runRows[0]!.id;
  const counts: Counts = {
    rowsRead: 0,
    sponsorsInserted: 0,
    sponsorsUnlisted: 0,
    sponsorsRenamed: 0,
    renamesAmbiguous: 0,
  };

  try {
    const { rows: lastRows } = await client.query<{ rows_read: number | null }>(
      `select rows_read from crawl_runs
       where kind = 'ingest' and error_count = 0 and rows_read is not null and id <> $1
       order by started_at desc limit 1`,
      [runId],
    );
    const previousRows = lastRows[0]?.rows_read ?? null;
    const isBootstrap = previousRows === null;

    const csvUrl = await findCsvUrl();
    const parsed = await parseRegister(await download(csvUrl));
    counts.rowsRead = parsed.rowCount;

    if (previousRows !== null && parsed.rowCount < previousRows * MIN_ROW_FRACTION) {
      throw new Error(
        `row count guard: read ${parsed.rowCount} rows against ${previousRows} yesterday`,
      );
    }

    await client.query('begin');
    await stage(client, parsed.sponsors);

    const renames = await pairRenames(client, today);
    counts.sponsorsRenamed = renames.renamed;
    counts.renamesAmbiguous = renames.ambiguous;

    counts.sponsorsInserted = await insertNewSponsors(client, today, isBootstrap);

    await client.query(
      `update sponsors
       set last_seen = $1, unlisted_at = null, county = s.county, name = s.name
       from staging_sponsors s
       where sponsors.identity_key = s.identity_key`,
      [today],
    );

    await client.query(
      `insert into sponsor_names (sponsor_id, name, first_seen, last_seen)
       select sp.id, sp.name, $1, $1 from sponsors sp
       join staging_sponsors s on s.identity_key = sp.identity_key
       on conflict (sponsor_id, name) do update set last_seen = excluded.last_seen`,
      [today],
    );

    await client.query(
      `delete from sponsor_routes r
       using sponsors sp
       where r.sponsor_id = sp.id
         and exists (select 1 from staging_sponsors s where s.identity_key = sp.identity_key)`,
    );
    await client.query(
      `insert into sponsor_routes (sponsor_id, route, rating)
       select sp.id, t.route, t.rating
       from staging_routes t
       join sponsors sp on sp.identity_key = t.identity_key
       on conflict do nothing`,
    );

    const { rowCount: unlisted } = await client.query(
      `update sponsors
       set unlisted_at = $1
       where unlisted_at is null
         and not exists (select 1 from staging_sponsors s where s.identity_key = sponsors.identity_key)`,
      [today],
    );
    counts.sponsorsUnlisted = unlisted ?? 0;

    await client.query('commit');

    await client.query(
      `update crawl_runs
       set ended_at = now(), is_bootstrap = $2, rows_read = $3, sponsors_inserted = $4,
           sponsors_unlisted = $5, sponsors_renamed = $6, renames_ambiguous = $7
       where id = $1`,
      [
        runId,
        isBootstrap,
        counts.rowsRead,
        counts.sponsorsInserted,
        counts.sponsorsUnlisted,
        counts.sponsorsRenamed,
        counts.renamesAmbiguous,
      ],
    );

    console.log(
      `sponsors inserted=${counts.sponsorsInserted} renamed=${counts.sponsorsRenamed} ` +
        `ambiguous=${counts.renamesAmbiguous} unlisted=${counts.sponsorsUnlisted} ` +
        `rows=${counts.rowsRead} bootstrap=${isBootstrap}`,
    );
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    await client.query(
      `update crawl_runs
       set ended_at = now(), error_count = 1, error_message = $2, rows_read = $3
       where id = $1`,
      [runId, message, counts.rowsRead || null],
    );
    console.error(`ingest failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await run();
