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
  if (gtinMap[gtinShort]) {
    return gtinMap[gtinShort];
  }

  if (rawBarcode) {
    const fromRef = parseRefCode(rawBarcode);
    if (fromRef) return fromRef;
  }

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
