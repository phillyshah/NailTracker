/**
 * GTIN Product Map — Summa Orthopaedics Femoral Nail System
 *
 * Maps gtinShort (last 7 digits of GTIN, leading zeros stripped) to product descriptions.
 * Update this file with real GTIN values from the Summa catalog.
 *
 * To add a new product:
 *   1. Take the 14-digit GTIN from the barcode label
 *   2. Strip leading zeros, take the last 7 digits
 *   3. Add an entry: 'XXXXXXX': 'Product Description'
 */

export const gtinMap: Record<string, string> = {
  // ── Short Femoral Nails ──────────────────────────────────────────
  // Format: Short Nail {diameter}mm x {length}mm, {angle}°
  // Lengths: 170, 180, 190, 200mm | Diameters: 10, 11, 12, 13mm | Angles: 125°, 130°

  // TODO: Replace placeholder GTINs with real values from catalog
  // Example entry: '8459148': 'Short Nail 10mm x 170mm, 125°',

  // ── Long Femoral Nails — Left ────────────────────────────────────
  // Format: Long Nail Left {diameter}mm x {length}mm, {angle}°
  // Lengths: 220-440mm (20mm steps) | Diameters: 10, 11, 12, 13mm | Angles: 125°, 130°

  // ── Long Femoral Nails — Right ───────────────────────────────────
  // Format: Long Nail Right {diameter}mm x {length}mm, {angle}°
  // Same sizes as Left

  // ── Lag Screws — Normal ──────────────────────────────────────────
  // Lengths: 70-130mm (5mm steps)

  // ── Lag Screws — Anti-Rotation ───────────────────────────────────
  // Lengths: 70-130mm (5mm steps)

  // ── Lag Screws — Telescopic ──────────────────────────────────────
  // Lengths: 85-130mm (5mm steps)

  // ── Interlocking Screws ──────────────────────────────────────────
  // Thread lengths: 16-120mm (1mm steps)

  // ── End Caps ─────────────────────────────────────────────────────
  // Sizes: 0mm, 5mm, 10mm, 15mm, 20mm

  // ── Set Screw ────────────────────────────────────────────────────
};

/**
 * Look up product label by gtinShort.
 * Returns a human-readable description or 'Unknown' fallback.
 */
export function getProductLabel(gtinShort: string): string {
  return gtinMap[gtinShort] ?? `Unknown — GTIN: ${gtinShort}`;
}
