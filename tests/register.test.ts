import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { findCsvUrl, parseRegister, toRow } from '../src/lib/register.ts';

function stubFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
}

describe('findCsvUrl', () => {
  it('returns the one attachment the content API lists', async () => {
    const url = 'https://assets.publishing.service.gov.uk/media/x/register.csv';
    await expect(
      findCsvUrl(stubFetch({ details: { attachments: [{ url }] } })),
    ).resolves.toBe(url);
  });

  it('fails when the API lists no attachment', async () => {
    await expect(findCsvUrl(stubFetch({ details: { attachments: [] } }))).rejects.toThrow(
      'expected exactly 1',
    );
  });

  it('fails rather than guessing between two attachments', async () => {
    const two = { details: { attachments: [{ url: 'a.csv' }, { url: 'b.csv' }] } };
    await expect(findCsvUrl(stubFetch(two))).rejects.toThrow('expected exactly 1');
  });

  it('fails on a non-ok response', async () => {
    await expect(findCsvUrl(stubFetch({}, 503))).rejects.toThrow('503');
  });
});

describe('toRow', () => {
  it('trims every field the register leaves padded', () => {
    const row = toRow({
      'Organisation Name': ' AaruvikA Limited',
      'Town/City': 'Edinburgh',
      County: '',
      'Type & Rating': 'Worker (A rating)',
      Route: 'Charity Worker ',
    });
    expect(row.name).toBe('AaruvikA Limited');
    expect(row.route).toBe('Charity Worker');
    expect(row.identityKey).toBe('aaruvika|edinburgh');
  });
});

describe('parseRegister', () => {
  async function parseFixture() {
    const csv = await readFile(new URL('./fixtures/register-small.csv', import.meta.url));
    return parseRegister(Readable.from([csv]));
  }

  it('counts every row it read', async () => {
    const { rowCount } = await parseFixture();
    expect(rowCount).toBe(8);
  });

  it('folds the rows of one sponsor into one sponsor with many routes', async () => {
    const { sponsors } = await parseFixture();
    const aaruvika = sponsors.get('aaruvika|edinburgh');
    expect(aaruvika?.routes.size).toBe(2);
  });

  it('keeps two entities of one name in different towns apart', async () => {
    const { sponsors } = await parseFixture();
    expect(sponsors.has('apex care|leeds')).toBe(true);
    expect(sponsors.has('apex care|bristol')).toBe(true);
  });

  it('merges a row that differs only by town casing', async () => {
    const { sponsors } = await parseFixture();
    expect(sponsors.get('2ms construction|newmarket')?.routes.size).toBe(1);
  });

  it('drops a duplicate route rather than repeating it', async () => {
    const { sponsors } = await parseFixture();
    const total = [...sponsors.values()].reduce((sum, s) => sum + s.routes.size, 0);
    expect(total).toBe(7);
  });

  it('reads a quoted field holding a comma', async () => {
    const { sponsors } = await parseFixture();
    expect(sponsors.get('bond jones co|london')?.name).toBe('Bond, Jones & Co Limited');
  });
});
