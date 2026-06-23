// Pure helpers for the OCR Training lab. Kept free of Prisma/Express so the
// alias-derivation rule can be unit-tested in isolation.

export interface CorrectedLabel {
  /** The REF text as printed / read by OCR (the thing that was mis-read). */
  token?: string;
  /** The correct catalog REF this label should resolve to. */
  ref?: string;
  lot?: string;
  exp?: string | null;
  gs1?: string;
}

export interface DerivedAlias {
  token: string;
  canonicalRef: string;
}

/** Normalize for comparison: upper-case, strip everything but letters/digits. */
function norm(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Turn an admin's corrected labels into alias rows the matcher can learn from.
 * We only emit an alias when there's an actual mis-read to capture: a token AND
 * a target REF, and the token isn't already the same code (nothing to learn).
 * Tokens are de-duplicated on their normalized form.
 */
export function deriveAliases(corrected: CorrectedLabel[] | null | undefined): DerivedAlias[] {
  const out: DerivedAlias[] = [];
  const seen = new Set<string>();
  for (const c of corrected ?? []) {
    const token = (c.token ?? '').trim();
    const ref = (c.ref ?? '').trim().toUpperCase();
    if (!token || !ref) continue;
    if (norm(token) === norm(ref)) continue; // already an exact match — skip
    const key = norm(token);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ token, canonicalRef: ref });
  }
  return out;
}
