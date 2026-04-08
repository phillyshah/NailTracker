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

  // ── Long Femoral Nails — Left ────────────────────────────────────
  // ── Long Femoral Nails — Right ───────────────────────────────────
  // ── Lag Screws — Normal ──────────────────────────────────────────
  // ── Lag Screws — Anti-Rotation ───────────────────────────────────
  // ── Lag Screws — Telescopic ──────────────────────────────────────
  // ── Interlocking Screws ──────────────────────────────────────────
  // ── End Caps ─────────────────────────────────────────────────────
  // ── Set Screw ────────────────────────────────────────────────────
};

export function getProductLabel(gtinShort: string): string {
  return gtinMap[gtinShort] ?? `Unknown — GTIN: ${gtinShort}`;
}
