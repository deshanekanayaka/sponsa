import { describe, expect, it } from 'vitest';
import { decideRename } from '../src/lib/rename.ts';

describe('decideRename', () => {
  it('pairs one candidate above the threshold', () => {
    expect(decideRename([{ sponsorId: 7, similarity: 0.95 }])).toEqual({
      kind: 'paired',
      sponsorId: 7,
    });
  });

  it('pairs nothing below the threshold', () => {
    expect(decideRename([{ sponsorId: 7, similarity: 0.84 }])).toEqual({ kind: 'none' });
  });

  it('pairs a one-letter rename, which pg_trgm scores 0.875', () => {
    expect(decideRename([{ sponsorId: 7, similarity: 0.875 }])).toEqual({
      kind: 'paired',
      sponsorId: 7,
    });
  });

  it('refuses the worst measured false pair, which scores 0.808', () => {
    expect(decideRename([{ sponsorId: 7, similarity: 0.808 }])).toEqual({ kind: 'none' });
  });

  it('pairs nothing with no candidate', () => {
    expect(decideRename([])).toEqual({ kind: 'none' });
  });

  it('reports a tie rather than guessing', () => {
    const decision = decideRename([
      { sponsorId: 7, similarity: 0.95 },
      { sponsorId: 9, similarity: 0.93 },
    ]);
    expect(decision).toEqual({ kind: 'ambiguous', sponsorIds: [7, 9] });
  });

  it('ignores a low candidate beside a high one', () => {
    const decision = decideRename([
      { sponsorId: 7, similarity: 0.95 },
      { sponsorId: 9, similarity: 0.4 },
    ]);
    expect(decision).toEqual({ kind: 'paired', sponsorId: 7 });
  });
});
