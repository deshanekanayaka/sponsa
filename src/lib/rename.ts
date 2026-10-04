export const SIMILARITY_THRESHOLD = 0.9;

export type RenameCandidate = {
  readonly sponsorId: number;
  readonly similarity: number;
};

export type RenameDecision =
  | { readonly kind: 'paired'; readonly sponsorId: number }
  | { readonly kind: 'none' }
  | { readonly kind: 'ambiguous'; readonly sponsorIds: readonly number[] };

export function decideRename(candidates: readonly RenameCandidate[]): RenameDecision {
  const above = candidates.filter((c) => c.similarity >= SIMILARITY_THRESHOLD);
  if (above.length === 0) return { kind: 'none' };
  if (above.length > 1) {
    return { kind: 'ambiguous', sponsorIds: above.map((c) => c.sponsorId) };
  }
  return { kind: 'paired', sponsorId: above[0]!.sponsorId };
}
