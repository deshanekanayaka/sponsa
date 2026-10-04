import { describe, expect, it } from 'vitest';
import { mintSlug, slugify } from '../src/lib/slug.ts';

describe('slugify', () => {
  it('hyphenates a normalised name', () => {
    expect(slugify('Monzo Bank Limited')).toBe('monzo-bank-limited');
  });
});

describe('mintSlug', () => {
  it('uses the plain slug when it is free', () => {
    expect(mintSlug('Monzo Bank Limited', 'London', new Set())).toBe(
      'monzo-bank-limited',
    );
  });

  it('adds the town on a collision', () => {
    const taken = new Set(['apex-care-ltd']);
    expect(mintSlug('Apex Care Ltd', 'Leeds', taken)).toBe('apex-care-ltd-leeds');
  });

  it('numbers the slug when the town is taken too', () => {
    const taken = new Set(['apex-care-ltd', 'apex-care-ltd-leeds']);
    expect(mintSlug('Apex Care Ltd', 'Leeds', taken)).toBe('apex-care-ltd-leeds-2');
  });

  it('numbers the slug when the town is empty', () => {
    const taken = new Set(['apex-care-ltd']);
    expect(mintSlug('Apex Care Ltd', '', taken)).toBe('apex-care-ltd-2');
  });
});
