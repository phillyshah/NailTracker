/**
 * GTIN Product Map + REF Code Parser
 *
 * Maps gtinShort (last 7 digits of GTIN after stripping leading zeros)
 * to product descriptions. Source of truth: Summa Orthopedics GTIN spreadsheet.
 *
 * Falls back to REF code parsing when GTIN isn't in the map.
 *
 * REF code patterns (from spreadsheet):
 *   SO-SPFN-{length}-{diameter}-{angle}          = Short Nail
 *   SO-SPFN-{length}-{diameter}{L|R}-{angle}     = Long Nail (Left/Right)
 *   SO-SPFL-N{length}                            = Lag Screw Normal
 *   SO-SPFL-A{length}                            = Lag Screw Anti-Rotation
 *   SO-SPFL-T{length}                            = Lag Screw Telescopic
 *   SO-S50I-SO-{length}-T                        = Interlocking Screw
 *   SO-SPFC-{size}                               = Cap Screw
 *   SO-SPFS-{ref}                                = Set Screw
 */

export const gtinMap: Record<string, string> = {
  // ── Short Nails (SO-SPFN, lengths 180-200mm) ───────────────────────
  '9459148': 'Short Nail 180/10mm 125°',
  '9459162': 'Short Nail 200/10mm 125°',
  '9459186': 'Short Nail 180/10mm 130°',
  '9459209': 'Short Nail 200/10mm 130°',
  '9459223': 'Short Nail 180/11mm 125°',
  '9459247': 'Short Nail 200/11mm 125°',
  '9459261': 'Short Nail 180/11mm 130°',
  '9459285': 'Short Nail 200/11mm 130°',
  '9459308': 'Short Nail 180/12mm 125°',
  '9459322': 'Short Nail 200/12mm 125°',
  '9459346': 'Short Nail 180/12mm 130°',
  '9459360': 'Short Nail 200/12mm 130°',

  // ── Long Nails Right 125° (SO-SPFN, 10mm) ─────────────────────────
  '9459452': 'Long Nail 300/10mm Right 125°',
  '9459469': 'Long Nail 320/10mm Right 125°',
  '9459476': 'Long Nail 340/10mm Right 125°',
  '9459483': 'Long Nail 360/10mm Right 125°',
  '9459490': 'Long Nail 380/10mm Right 125°',
  '9460298': 'Long Nail 400/10mm Right 125°',
  '9460304': 'Long Nail 420/10mm Right 125°',

  // ── Long Nails Right 130° (SO-SPFN, 10mm) ─────────────────────────
  '9459506': 'Long Nail 300/10mm Right 130°',
  '9459513': 'Long Nail 320/10mm Right 130°',
  '9459520': 'Long Nail 340/10mm Right 130°',
  '9459537': 'Long Nail 360/10mm Right 130°',
  '9459544': 'Long Nail 380/10mm Right 130°',
  '9460366': 'Long Nail 400/10mm Right 130°',
  '9460373': 'Long Nail 420/10mm Right 130°',

  // ── Long Nails Right 125° (SO-SPFN, 11mm) ─────────────────────────
  '9459551': 'Long Nail 300/11mm Right 125°',
  '9459568': 'Long Nail 320/11mm Right 125°',
  '9459575': 'Long Nail 340/11mm Right 125°',
  '9459582': 'Long Nail 360/11mm Right 125°',
  '9459599': 'Long Nail 380/11mm Right 125°',
  '9460434': 'Long Nail 400/11mm Right 125°',
  '9460441': 'Long Nail 420/11mm Right 125°',

  // ── Long Nails Right 130° (SO-SPFN, 11mm) ─────────────────────────
  '9459605': 'Long Nail 300/11mm Right 130°',
  '9459612': 'Long Nail 320/11mm Right 130°',
  '9459629': 'Long Nail 340/11mm Right 130°',
  '9459636': 'Long Nail 360/11mm Right 130°',
  '9459643': 'Long Nail 380/11mm Right 130°',
  '9460502': 'Long Nail 400/11mm Right 130°',
  '9460519': 'Long Nail 420/11mm Right 130°',

  // ── Long Nails Left 125° (SO-SPFN, 10mm) ──────────────────────────
  '9459858': 'Long Nail 300/10mm Left 125°',
  '9459865': 'Long Nail 320/10mm Left 125°',
  '9459872': 'Long Nail 340/10mm Left 125°',
  '9459889': 'Long Nail 360/10mm Left 125°',
  '9459896': 'Long Nail 380/10mm Left 125°',
  '9460854': 'Long Nail 400/10mm Left 125°',
  '9460861': 'Long Nail 420/10mm Left 125°',

  // ── Long Nails Left 130° (SO-SPFN, 10mm) ──────────────────────────
  '9459902': 'Long Nail 300/10mm Left 130°',
  '9459919': 'Long Nail 320/10mm Left 130°',
  '9459926': 'Long Nail 340/10mm Left 130°',
  '9459933': 'Long Nail 360/10mm Left 130°',
  '9459940': 'Long Nail 380/10mm Left 130°',
  '9460922': 'Long Nail 400/10mm Left 130°',
  '9460939': 'Long Nail 420/10mm Left 130°',

  // ── Long Nails Left 125° (SO-SPFN, 11mm) ──────────────────────────
  '9459957': 'Long Nail 300/11mm Left 125°',
  '9459964': 'Long Nail 320/11mm Left 125°',
  '9459971': 'Long Nail 340/11mm Left 125°',
  '9459988': 'Long Nail 360/11mm Left 125°',
  '9459995': 'Long Nail 380/11mm Left 125°',
  '9460991': 'Long Nail 400/11mm Left 125°',
  '9461004': 'Long Nail 420/11mm Left 125°',

  // ── Long Nails Left 130° (SO-SPFN, 11mm) ──────────────────────────
  '9460007': 'Long Nail 300/11mm Left 130°',
  '9460014': 'Long Nail 320/11mm Left 130°',
  '9460021': 'Long Nail 340/11mm Left 130°',
  '9460038': 'Long Nail 360/11mm Left 130°',
  '9460045': 'Long Nail 380/11mm Left 130°',
  '9461066': 'Long Nail 400/11mm Left 130°',
  '9461073': 'Long Nail 420/11mm Left 130°',

  // ── Lag Screws — Normal (SO-SPFL-N) ────────────────────────────────
  '9461370': 'Lag Screw Normal 70mm',
  '9461387': 'Lag Screw Normal 75mm',
  '9461394': 'Lag Screw Normal 80mm',
  '9461400': 'Lag Screw Normal 85mm',
  '9461417': 'Lag Screw Normal 90mm',
  '9461424': 'Lag Screw Normal 95mm',
  '9461431': 'Lag Screw Normal 100mm',
  '9461448': 'Lag Screw Normal 105mm',
  '9461455': 'Lag Screw Normal 110mm',
  '9461462': 'Lag Screw Normal 115mm',
  '9461479': 'Lag Screw Normal 120mm',

  // ── Interlocking Screws (SO-S50I-SO) ───────────────────────────────
  '9461608': 'Interlocking Screw 26mm',
  '9461622': 'Interlocking Screw 28mm',
  '9461646': 'Interlocking Screw 30mm',
  '9461660': 'Interlocking Screw 32mm',
  '9461684': 'Interlocking Screw 34mm',
  '9461707': 'Interlocking Screw 36mm',
  '9461721': 'Interlocking Screw 38mm',
  '9461745': 'Interlocking Screw 40mm',
  '9461769': 'Interlocking Screw 42mm',
  '9461783': 'Interlocking Screw 44mm',
  '9461806': 'Interlocking Screw 46mm',
  '9461820': 'Interlocking Screw 48mm',
  '9461844': 'Interlocking Screw 50mm',
  '9461899': 'Interlocking Screw 55mm',
  '9461943': 'Interlocking Screw 60mm',
  '9461998': 'Interlocking Screw 65mm',
  '9462049': 'Interlocking Screw 70mm',
  '9462094': 'Interlocking Screw 75mm',
  '9462148': 'Interlocking Screw 80mm',
  '9462193': 'Interlocking Screw 85mm',
  '9462247': 'Interlocking Screw 90mm',

  // ── Cap Screws (SO-SPFC) ───────────────────────────────────────────
  '9462551': 'Cap Screw 0mm',
  '9462568': 'Cap Screw 5mm',
  '9462575': 'Cap Screw 10mm',
  '9462582': 'Cap Screw 15mm',

  // ── Set Screw (SO-SPFS) ───────────────────────────────────────────
  '9462605': 'Set Screw',
};

/**
 * gtinShort -> official item number (REF code) from Summa Orthopedics catalog.
 */
export const gtinToRef: Record<string, string> = {
  // Proximal Femur Nail
  '9459148': 'SO-SPFN-0180-10-25',
  '9459162': 'SO-SPFN-0200-10-25',
  '9459186': 'SO-SPFN-0180-10-30',
  '9459209': 'SO-SPFN-0200-10-30',
  '9459223': 'SO-SPFN-0180-11-25',
  '9459247': 'SO-SPFN-0200-11-25',
  '9459261': 'SO-SPFN-0180-11-30',
  '9459285': 'SO-SPFN-0200-11-30',
  '9459308': 'SO-SPFN-0180-12-25',
  '9459322': 'SO-SPFN-0200-12-25',
  '9459346': 'SO-SPFN-0180-12-30',
  '9459360': 'SO-SPFN-0200-12-30',
  '9459452': 'SO-SPFN-0300-10R-25',
  '9459469': 'SO-SPFN-0320-10R-25',
  '9459476': 'SO-SPFN-0340-10R-25',
  '9459483': 'SO-SPFN-0360-10R-25',
  '9459490': 'SO-SPFN-0380-10R-25',
  '9459506': 'SO-SPFN-0300-10R-30',
  '9459513': 'SO-SPFN-0320-10R-30',
  '9459520': 'SO-SPFN-0340-10R-30',
  '9459537': 'SO-SPFN-0360-10R-30',
  '9459544': 'SO-SPFN-0380-10R-30',
  '9459551': 'SO-SPFN-0300-11R-25',
  '9459568': 'SO-SPFN-0320-11R-25',
  '9459575': 'SO-SPFN-0340-11R-25',
  '9459582': 'SO-SPFN-0360-11R-25',
  '9459599': 'SO-SPFN-0380-11R-25',
  '9459605': 'SO-SPFN-0300-11R-30',
  '9459612': 'SO-SPFN-0320-11R-30',
  '9459629': 'SO-SPFN-0340-11R-30',
  '9459636': 'SO-SPFN-0360-11R-30',
  '9459643': 'SO-SPFN-0380-11R-30',
  '9459858': 'SO-SPFN-0300-10L-25',
  '9459865': 'SO-SPFN-0320-10L-25',
  '9459872': 'SO-SPFN-0340-10L-25',
  '9459889': 'SO-SPFN-0360-10L-25',
  '9459896': 'SO-SPFN-0380-10L-25',
  '9459902': 'SO-SPFN-0300-10L-30',
  '9459919': 'SO-SPFN-0320-10L-30',
  '9459926': 'SO-SPFN-0340-10L-30',
  '9459933': 'SO-SPFN-0360-10L-30',
  '9459940': 'SO-SPFN-0380-10L-30',
  '9459957': 'SO-SPFN-0300-11L-25',
  '9459964': 'SO-SPFN-0320-11L-25',
  '9459971': 'SO-SPFN-0340-11L-25',
  '9459988': 'SO-SPFN-0360-11L-25',
  '9459995': 'SO-SPFN-0380-11L-25',
  '9460007': 'SO-SPFN-0300-11L-30',
  '9460014': 'SO-SPFN-0320-11L-30',
  '9460021': 'SO-SPFN-0340-11L-30',
  '9460038': 'SO-SPFN-0360-11L-30',
  '9460045': 'SO-SPFN-0380-11L-30',
  '9460298': 'SO-SPFN-0400-10R-25',
  '9460304': 'SO-SPFN-0420-10R-25',
  '9460366': 'SO-SPFN-0400-10R-30',
  '9460373': 'SO-SPFN-0420-10R-30',
  '9460434': 'SO-SPFN-0400-11R-25',
  '9460441': 'SO-SPFN-0420-11R-25',
  '9460502': 'SO-SPFN-0400-11R-30',
  '9460519': 'SO-SPFN-0420-11R-30',
  '9460854': 'SO-SPFN-0400-10L-25',
  '9460861': 'SO-SPFN-0420-10L-25',
  '9460922': 'SO-SPFN-0400-10L-30',
  '9460939': 'SO-SPFN-0420-10L-30',
  '9460991': 'SO-SPFN-0400-11L-25',
  '9461004': 'SO-SPFN-0420-11L-25',
  '9461066': 'SO-SPFN-0400-11L-30',
  '9461073': 'SO-SPFN-0420-11L-30',
  // Lag Screw (Normal)
  '9461370': 'SO-SPFL-N070',
  '9461387': 'SO-SPFL-N075',
  '9461394': 'SO-SPFL-N080',
  '9461400': 'SO-SPFL-N085',
  '9461417': 'SO-SPFL-N090',
  '9461424': 'SO-SPFL-N095',
  '9461431': 'SO-SPFL-N100',
  '9461448': 'SO-SPFL-N105',
  '9461455': 'SO-SPFL-N110',
  '9461462': 'SO-SPFL-N115',
  '9461479': 'SO-SPFL-N120',
  // Interlocking Screw
  '9461608': 'SO-S50I-SO-026-T',
  '9461622': 'SO-S50I-SO-028-T',
  '9461646': 'SO-S50I-SO-030-T',
  '9461660': 'SO-S50I-SO-032-T',
  '9461684': 'SO-S50I-SO-034-T',
  '9461707': 'SO-S50I-SO-036-T',
  '9461721': 'SO-S50I-SO-038-T',
  '9461745': 'SO-S50I-SO-040-T',
  '9461769': 'SO-S50I-SO-042-T',
  '9461783': 'SO-S50I-SO-044-T',
  '9461806': 'SO-S50I-SO-046-T',
  '9461820': 'SO-S50I-SO-048-T',
  '9461844': 'SO-S50I-SO-050-T',
  '9461899': 'SO-S50I-SO-055-T',
  '9461943': 'SO-S50I-SO-060-T',
  '9461998': 'SO-S50I-SO-065-T',
  '9462049': 'SO-S50I-SO-070-T',
  '9462094': 'SO-S50I-SO-075-T',
  '9462148': 'SO-S50I-SO-080-T',
  '9462193': 'SO-S50I-SO-085-T',
  '9462247': 'SO-S50I-SO-090-T',
  // Cap Screw
  '9462551': 'SO-SPFC-000',
  '9462568': 'SO-SPFC-005',
  '9462575': 'SO-SPFC-010',
  '9462582': 'SO-SPFC-015',
  // Set Screw
  '9462605': 'SO-SPFS-000',
};

/** Reverse lookup: REF code -> gtinShort. Built once at module load. */
/** Reverse lookup: REF code (uppercase) -> gtinShort. */
export const refToGtinShort: Record<string, string> = Object.fromEntries(
  Object.entries(gtinToRef).map(([gs, ref]) => [ref.toUpperCase(), gs]),
);

/**
 * Build the full 14-digit GTIN for a given gtinShort, using the Summa
 * Orthopedics company prefix (`08800089`). All catalog items live under
 * this prefix, so the GTIN is `08800089` + last 6 of gtinShort.
 */
export function gtinShortToFullGtin(gtinShort: string): string {
  return '08800089' + gtinShort.slice(-6);
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR alias overlay — the "training" feedback loop.
//
// Admins review mis-read labels in the OCR Training lab and confirm what each
// mangled REF token should have been. Those corrections are persisted server-side
// and loaded here once at app boot via setAliasOverlay. The OCR matcher
// (ocrBarcode) consults this overlay to resolve tokens it would otherwise miss,
// so accuracy improves as the correction set grows — no model retraining.
//
// Defaults empty: with no aliases loaded the matcher behaves exactly as before,
// which keeps the pure parse path deterministic for tests.
// ─────────────────────────────────────────────────────────────────────────────
export interface OcrAliasEntry {
  /** The mis-read REF text exactly as OCR produced it. */
  token: string;
  /** The catalog REF it should resolve to. */
  canonicalRef: string;
}

let aliasOverlay: OcrAliasEntry[] = [];

/** Replace the active alias overlay (keeps only entries whose REF is catalogued). */
export function setAliasOverlay(entries: OcrAliasEntry[]): void {
  aliasOverlay = entries.filter(
    (e) => e.token && e.canonicalRef && refToGtinShort[e.canonicalRef.toUpperCase()],
  );
}

/** Current alias overlay (the matcher reads this; tests can assert against it). */
export function getAliasOverlay(): OcrAliasEntry[] {
  return aliasOverlay;
}

/** Clear the overlay — used by tests to avoid cross-test leakage. */
export function clearAliasOverlay(): void {
  aliasOverlay = [];
}

/**
 * Extract a Summa item number (REF code) from raw barcode/label text.
 * Returns the full REF code if found, else null.
 */
export function extractItemNumber(text: string): string | null {
  if (!text) return null;
  // Match a Summa REF code anywhere in the text.
  // Patterns: SO-SPFN-..., SO-SPFL-..., SO-S50I-SO-..., SO-SPFC-..., SO-SPFS-..., SO-LPFN-..., SO-IS-..., SO-EC-..., SO-SS
  const patterns = [
    /\bSO-SPFN-\d{3,4}-\d{1,2}[LR]?-\d{2}\b/i,
    /\bSO-SPFL-[NAT]\d{2,3}\b/i,
    /\bSO-S50I-SO-\d{2,3}-T\b/i,
    /\bSO-SPFC-\d{3}\b/i,
    /\bSO-SPFS-\d{3}\b/i,
    /\bSO-LPFN-\d{3,4}-\d{1,2}-\d{2}-[LR]\b/i,
    /\bSO-IS-\d{2,3}\b/i,
    /\bSO-EC-\d{1,2}\b/i,
    /\bSO-SS\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].toUpperCase();
  }
  return null;
}

/**
 * Get the official item number (REF code) for an inventory item.
 * Prefers REF extracted from rawBarcode (master), falls back to gtinShort lookup.
 */
export function getItemNumber(gtinShort: string, rawBarcode?: string): string | null {
  if (rawBarcode) {
    const extracted = extractItemNumber(rawBarcode);
    if (extracted) return extracted;
  }
  return gtinToRef[gtinShort] || null;
}

const refCategories: [RegExp, string][] = [
  [/SO-SPFN/i, 'Proximal Femur Nail'],
  [/SO-LPFN/i, 'Long Nail'],
  [/SO-SPFL-N/i, 'Lag Screw (Normal)'],
  [/SO-SPFL-A/i, 'Lag Screw (Anti-Rotation)'],
  [/SO-SPFL-T/i, 'Lag Screw (Telescopic)'],
  [/SO-S50I/i, 'Interlocking Screw'],
  [/SO-IS/i, 'Interlocking Screw'],
  [/SO-SPFC/i, 'Cap Screw'],
  [/SO-EC/i, 'Cap Screw'],
  [/SO-SPFS/i, 'Set Screw'],
  [/SO-SS/i, 'Set Screw'],
];

const keywordCategories: [RegExp, string][] = [
  [/SPFN/i, 'Proximal Femur Nail'],
  [/LPFN/i, 'Long Nail'],
  [/S50I/i, 'Interlocking Screw'],
  [/SPFC/i, 'Cap Screw'],
  [/femur|femoral/i, 'Proximal Femur Nail'],
  [/lag\s*screw/i, 'Lag Screw'],
  [/interlock/i, 'Interlocking Screw'],
  [/cap\s*screw/i, 'Cap Screw'],
  [/end\s*cap/i, 'Cap Screw'],
  [/set\s*screw/i, 'Set Screw'],
];

function parseRefCode(text: string): string | null {
  // Long nail: SO-SPFN-{length}-{diameter}{L|R}-{angle}
  const longMatch = text.match(/SO-SPFN-(\d{3,4})-(\d{1,2})([LR])-(\d{2})/i);
  if (longMatch) {
    const length = parseInt(longMatch[1], 10);
    const diameter = parseInt(longMatch[2], 10);
    const side = longMatch[3].toUpperCase() === 'L' ? 'Left' : 'Right';
    const angle = parseInt(longMatch[4], 10) + 100;
    return `Long Nail ${length}/${diameter}mm ${side} ${angle}°`;
  }

  // Short nail: SO-SPFN-{length}-{diameter}-{angle}
  const shortMatch = text.match(/SO-SPFN-(\d{3,4})-(\d{1,2})-(\d{2})/i);
  if (shortMatch) {
    const length = parseInt(shortMatch[1], 10);
    const diameter = parseInt(shortMatch[2], 10);
    const angle = parseInt(shortMatch[3], 10) + 100;
    return `Short Nail ${length}/${diameter}mm ${angle}°`;
  }

  // Long nail legacy: SO-LPFN-{length}-{diameter}-{angle}-{side}
  const lpfnMatch = text.match(/SO-LPFN-(\d{3,4})-(\d{1,2})-(\d{2})-([LR])/i);
  if (lpfnMatch) {
    const length = parseInt(lpfnMatch[1], 10);
    const diameter = parseInt(lpfnMatch[2], 10);
    const angle = parseInt(lpfnMatch[3], 10) + 100;
    const side = lpfnMatch[4].toUpperCase() === 'L' ? 'Left' : 'Right';
    return `Long Nail ${length}/${diameter}mm ${side} ${angle}°`;
  }

  // Lag screw: SO-SPFL-{type}{length}
  const lagMatch = text.match(/SO-SPFL-([NAT])(\d{2,3})/i);
  if (lagMatch) {
    const type = lagMatch[1].toUpperCase();
    const length = parseInt(lagMatch[2], 10);
    const typeLabel = type === 'N' ? 'Normal' : type === 'A' ? 'Anti-Rotation' : 'Telescopic';
    return `Lag Screw ${typeLabel} ${length}mm`;
  }

  // Interlocking screw: SO-S50I-SO-{length}-T
  const s50iMatch = text.match(/SO-S50I-SO-(\d{2,3})-T/i);
  if (s50iMatch) {
    return `Interlocking Screw ${parseInt(s50iMatch[1], 10)}mm`;
  }

  // Interlocking screw legacy: SO-IS-{length}
  const isMatch = text.match(/SO-IS-(\d{2,3})/i);
  if (isMatch) {
    return `Interlocking Screw ${parseInt(isMatch[1], 10)}mm`;
  }

  // Cap screw: SO-SPFC-{size}
  const spfcMatch = text.match(/SO-SPFC-(\d{2,3})/i);
  if (spfcMatch) {
    return `Cap Screw ${parseInt(spfcMatch[1], 10)}mm`;
  }

  // Cap screw legacy: SO-EC-{size}
  const ecMatch = text.match(/SO-EC-(\d{1,2})/i);
  if (ecMatch) {
    return `Cap Screw ${parseInt(ecMatch[1], 10)}mm`;
  }

  // Set screw: SO-SPFS
  if (/SO-SPFS/i.test(text)) {
    return 'Set Screw';
  }

  // Set screw legacy: SO-SS
  if (/SO-SS\b/i.test(text)) {
    return 'Set Screw';
  }

  return null;
}

export function getProductLabel(gtinShort: string, rawBarcode?: string): string {
  // 1. If the raw barcode/label contains an explicit REF code, it is the master.
  //    Look up the canonical product via the REF's known gtinShort.
  if (rawBarcode) {
    const ref = extractItemNumber(rawBarcode);
    if (ref) {
      const canonicalGtinShort = refToGtinShort[ref];
      if (canonicalGtinShort && gtinMap[canonicalGtinShort]) {
        return gtinMap[canonicalGtinShort];
      }
      // REF found but not in our catalog — parse dimensions from it
      const fromRef = parseRefCode(ref);
      if (fromRef) return fromRef;
    }
  }

  // 2. Fall back to direct gtinShort lookup.
  if (gtinMap[gtinShort]) {
    return gtinMap[gtinShort];
  }

  // 3. Try parseRefCode on the full rawBarcode.
  if (rawBarcode) {
    const fromRef = parseRefCode(rawBarcode);
    if (fromRef) return fromRef;
  }

  // 4. Category / keyword fallback.
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
