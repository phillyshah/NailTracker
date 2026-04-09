/**
 * GTIN Product Map — Summa Orthopaedics Femoral Nail System
 *
 * Maps gtinShort (last 7 digits of GTIN, leading zeros stripped) to product descriptions.
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
 *
 * To add a new product:
 *   1. Take the 14-digit GTIN from the barcode label
 *   2. Strip leading zeros, take the last 7 digits
 *   3. Add an entry: 'XXXXXXX': 'Product Description'
 *
 * Manufacturer: Jeil Medical Corporation for Summa Orthopaedics Inc.
 * Address: 11 Woodside Avenue, Berwyn, PA 19312
 */

export const gtinMap: Record<string, string> = {
  // ── Short Proximal Femoral Nails (SO-SPFN) ──────────────────────
  // GTIN prefix: 088800894591xx / 088800894592xx
  // REF: SO-SPFN-{length}-{diameter}-{angle}
  // Verified from product labels:
  '9459162': 'Short Femoral Nail 10mm x 200mm, 126°',   // REF: SO-SPFN-0200-10-26, GTIN: 08800089459162
  '9459247': 'Short Femoral Nail 11mm x 200mm, 126°',   // REF: SO-SPFN-0200-11-26, GTIN: 08880089459247

  // Additional Short Nails — add as labels are scanned
  // Lengths: 170, 180, 190, 200mm | Diameters: 10, 11, 12, 13mm | Angles: 125°, 130°

  // ── Long Proximal Femoral Nails — Left (SO-LPFN-*-L) ────────────
  // Lengths: 220-440mm (20mm steps) | Diameters: 10, 11, 12, 13mm | Angles: 125°, 130°

  // ── Long Proximal Femoral Nails — Right (SO-LPFN-*-R) ───────────

  // ── Lag Screws — Normal (SO-SPFL-N) ──────────────────────────────
  // GTIN prefix: 088000894614xx
  // Verified from product labels:
  '9461431': 'Lag Screw Normal 100mm',                   // REF: SO-SPFL-N100, GTIN: 08800089461431

  // Additional Normal Lag Screws — lengths: 70-130mm (5mm steps)

  // ── Lag Screws — Anti-Rotation (SO-SPFL-A) ───────────────────────
  // Lengths: 70-130mm (5mm steps)

  // ── Lag Screws — Telescopic (SO-SPFL-T) ──────────────────────────
  // Lengths: 85-130mm (5mm steps)

  // ── Interlocking Screws (SO-IS) ──────────────────────────────────
  // Thread lengths: 16-120mm (1mm steps)

  // ── End Caps (SO-EC) ─────────────────────────────────────────────
  // Sizes: 0mm, 5mm, 10mm, 15mm, 20mm

  // ── Set Screw (SO-SS) ────────────────────────────────────────────
};

/**
 * Look up product label by gtinShort.
 * Returns a human-readable description or 'Unknown' fallback.
 */
export function getProductLabel(gtinShort: string): string {
  return gtinMap[gtinShort] ?? `Unknown — GTIN: ${gtinShort}`;
}
