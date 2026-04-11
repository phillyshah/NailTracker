/**
 * GTIN Product Map + REF Code Parser
 *
 * Maps gtinShort (last 7 digits of GTIN) to product descriptions.
 * Falls back to REF code parsing when GTIN isn't in the map.
 *
 * REF code patterns:
 *   SO-SPFN-{length}-{diameter}-{angle}       = Short Proximal Femoral Nail
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
  '9459162': 'Short Femoral Nail 10mm x 200mm, 126°',
  '9459247': 'Short Femoral Nail 11mm x 200mm, 126°',

  // ── Lag Screws — Normal (SO-SPFL-N) ──────────────────────────────
  '9461431': 'Lag Screw Normal 100mm',
};

/**
 * REF code prefix → category name mapping.
 */
const refCategories: [RegExp, string][] = [
  [/SO-SPFN/i, 'Short Femoral Nail'],
  [/SO-LPFN/i, 'Long Femoral Nail'],
  [/SO-SPFL-N/i, 'Lag Screw (Normal)'],
  [/SO-SPFL-A/i, 'Lag Screw (Anti-Rotation)'],
  [/SO-SPFL-T/i, 'Lag Screw (Telescopic)'],
  [/SO-IS/i, 'Interlocking Screw'],
  [/SO-EC/i, 'End Cap'],
  [/SO-SS/i, 'Set Screw'],
];

/**
 * Keyword fallbacks — if REF code isn't found but these keywords
 * appear anywhere in the text, use them for categorization.
 */
const keywordCategories: [RegExp, string][] = [
  [/SPFN/i, 'Femoral Nail'],
  [/LPFN/i, 'Long Femoral Nail'],
  [/femur|femoral/i, 'Femoral Nail'],
  [/lag\s*screw/i, 'Lag Screw'],
  [/interlock/i, 'Interlocking Screw'],
  [/end\s*cap/i, 'End Cap'],
  [/set\s*screw/i, 'Set Screw'],
];

/**
 * Try to parse a REF code like SO-SPFN-0180-11-25 into a product label
 * with dimensions: "Short Femoral Nail 11mm x 180mm, 125°"
 */
function parseRefCode(text: string): string | null {
  // Match SO-SPFN-{length}-{diameter}-{angle}
  const spfnMatch = text.match(/SO-SPFN-(\d{3,4})-(\d{1,2})-(\d{2})/i);
  if (spfnMatch) {
    const length = parseInt(spfnMatch[1], 10);
    const diameter = parseInt(spfnMatch[2], 10);
    const angle = parseInt(spfnMatch[3], 10) + 100;
    return `Short Femoral Nail ${diameter}mm x ${length}mm, ${angle}°`;
  }

  // Match SO-LPFN-{length}-{diameter}-{angle}-{side}
  const lpfnMatch = text.match(/SO-LPFN-(\d{3,4})-(\d{1,2})-(\d{2})-([LR])/i);
  if (lpfnMatch) {
    const length = parseInt(lpfnMatch[1], 10);
    const diameter = parseInt(lpfnMatch[2], 10);
    const angle = parseInt(lpfnMatch[3], 10) + 100;
    const side = lpfnMatch[4].toUpperCase() === 'L' ? 'Left' : 'Right';
    return `Long Femoral Nail ${diameter}mm x ${length}mm, ${angle}° ${side}`;
  }

  // Match SO-SPFL-{type}{length}
  const lagMatch = text.match(/SO-SPFL-([NAT])(\d{2,3})/i);
  if (lagMatch) {
    const type = lagMatch[1].toUpperCase();
    const length = parseInt(lagMatch[2], 10);
    const typeLabel = type === 'N' ? 'Normal' : type === 'A' ? 'Anti-Rotation' : 'Telescopic';
    return `Lag Screw (${typeLabel}) ${length}mm`;
  }

  // Match SO-IS-{length}
  const isMatch = text.match(/SO-IS-(\d{2,3})/i);
  if (isMatch) {
    return `Interlocking Screw ${parseInt(isMatch[1], 10)}mm`;
  }

  // Match SO-EC-{size}
  const ecMatch = text.match(/SO-EC-(\d{1,2})/i);
  if (ecMatch) {
    return `End Cap ${parseInt(ecMatch[1], 10)}mm`;
  }

  // Match SO-SS
  if (/SO-SS\b/i.test(text)) {
    return 'Set Screw';
  }

  return null;
}

/**
 * Look up product label by gtinShort, with fallback to REF code parsing.
 *
 * @param gtinShort - Last 7 digits of GTIN
 * @param rawBarcode - Optional raw barcode string to search for REF codes
 */
export function getProductLabel(gtinShort: string, rawBarcode?: string): string {
  // 1. Direct GTIN map lookup
  if (gtinMap[gtinShort]) {
    return gtinMap[gtinShort];
  }

  // 2. Try to parse REF code from rawBarcode
  if (rawBarcode) {
    const fromRef = parseRefCode(rawBarcode);
    if (fromRef) return fromRef;
  }

  // 3. Try category matching from rawBarcode keywords
  if (rawBarcode) {
    for (const [pattern, category] of refCategories) {
      if (pattern.test(rawBarcode)) return category;
    }
    for (const [pattern, category] of keywordCategories) {
      if (pattern.test(rawBarcode)) return category;
    }
  }

  return `Unknown — GTIN: ${gtinShort}`;
}
