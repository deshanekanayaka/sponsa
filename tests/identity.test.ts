import { describe, expect, it } from 'vitest';
import { identityKey, normalise, normaliseName } from '../src/lib/identity.ts';

describe('normalise', () => {
  it('strips the leading space the register puts before a name', () => {
    expect(normalise(' AaruvikA Limited')).toBe('aaruvika limited');
  });

  it('folds accents to ascii', () => {
    expect(normalise('Café Zoë')).toBe('cafe zoe');
  });

  it('collapses punctuation to single spaces', () => {
    expect(normalise('C. BECHSTEIN  HALL')).toBe('c bechstein hall');
  });
});

describe('normaliseName', () => {
  it('drops a trailing legal suffix', () => {
    expect(normaliseName('Monzo Bank Limited')).toBe('monzo bank');
    expect(normaliseName('2MS CONSTRUCTION LTD')).toBe('2ms construction');
  });

  it('drops stacked legal suffixes', () => {
    expect(normaliseName('Foo Holdings Ltd Limited')).toBe('foo holdings');
  });

  it('keeps UK, because stripping it merges separate legal entities', () => {
    expect(normaliseName('Monzo UK Limited')).toBe('monzo uk');
  });

  it('keeps a word that only looks like a suffix mid-name', () => {
    expect(normaliseName('Limited Edition Cakes Ltd')).toBe('limited edition cakes');
  });

  it('keeps the whole name when every word is a suffix', () => {
    expect(normaliseName('Limited')).toBe('limited');
  });

  it('merges two spellings of one entity', () => {
    expect(normaliseName('C. BECHSTEIN HALL LIMITED')).toBe(
      normaliseName('C. Bechstein Hall LIMITED'),
    );
  });
});

describe('identityKey', () => {
  it('separates two entities of one name in different towns', () => {
    expect(identityKey('Apex Care Ltd', 'Leeds')).not.toBe(
      identityKey('Apex Care Ltd', 'Bristol'),
    );
  });

  it('ignores the town casing the register varies', () => {
    expect(identityKey('2MS CONSTRUCTION LTD', 'NEWMARKET')).toBe(
      identityKey('2MS Construction Ltd', 'Newmarket'),
    );
  });

  it('takes no county, because one pair carries two counties in one file', () => {
    expect(identityKey('AKST Limited', 'Leeds')).toBe('akst|leeds');
  });
});
