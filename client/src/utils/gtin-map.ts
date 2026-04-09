/**
 * GTIN Product Map — Summa Orthopaedics Femoral Nail System
 * Client-side copy — keep in sync with server/src/utils/gtin-map.ts
 *
 * REF code pattern:
 *   SO-SPFN-{length}-{diameter}-{angle} = Short Proximal Femoral Nail
 *   SO-LPFN-{length}-{diameter}-{angle}-{side} = Long Proximal Femoral Nail
 *   SO-SPFL-N{length} = Lag Screw, Normal
 *   SO-SPFL-A{length} = Lag Screw, Anti-Rotation
 *   SO-SPFL-T{length} = Lag Screw, Telescopic
 *   SO-IS-{length}    = Interlocking Screw
 *   SO-EC-{size}      = End Cap
 *   SO-SS             = Set Screw
 */

export const gtinMap: Record<string, string> = {
  // ── Short Proximal Femoral Nails (SO-SPFN) ──────────────────────
  '9459162': 'Short Femoral Nail 10mm x 200mm, 126°',   // REF: SO-SPFN-0200-10-26
  '9459247': 'Short Femoral Nail 11mm x 200mm, 126°',   // REF: SO-SPFN-0200-11-26

  // ── Lag Screws — Normal (SO-SPFL-N) ──────────────────────────────
  '9461431': 'Lag Screw Normal 100mm',                   // REF: SO-SPFL-N100
};

export function getProductLabel(gtinShort: string): string {
  return gtinMap[gtinShort] ?? `Unknown — GTIN: ${gtinShort}`;
}
