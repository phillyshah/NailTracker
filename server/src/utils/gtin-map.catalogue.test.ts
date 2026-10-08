import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { getProductCategory, getProductLabel, getItemNumber } from './gtin-map.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER_MAP = path.join(here, 'gtin-map.ts');
const CLIENT_MAP = path.resolve(here, '../../../client/src/utils/gtin-map.ts');

/**
 * The GTIN catalogue is duplicated: client/src/utils/gtin-map.ts drives scanning
 * in the browser, server/src/utils/gtin-map.ts drives every report. They are
 * separate files in separate workspaces with no shared module.
 *
 * In v3.46 five Telescopic Lag Screws were added to the client copy only. The
 * server therefore reported them as "Unknown" in the "Other" category for two
 * months, across Usage Trends, Usage by Distributor, Monthly Usage, Stock by
 * Item and the Reorder Report — silently, because nothing cross-checked them.
 *
 * These tests are that cross-check. Parsing a sibling workspace's source as text
 * is inelegant, but it is what makes this class of drift fail loudly instead of
 * quietly misfiling products. If the catalogues are ever merged into one shared
 * module, delete this file.
 */

/** GTIN short-code keys from a catalogue file's `gtinMap` object literal. */
function gtinMapKeys(file: string): Set<string> {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf('gtinMap');
  expect(start, `gtinMap not found in ${file}`).toBeGreaterThan(-1);
  // The next top-level `};` closes the object literal.
  const end = src.indexOf('\n};', start);
  const body = src.slice(start, end);
  return new Set([...body.matchAll(/^\s*'(\d{7})':/gm)].map((m) => m[1]));
}

describe('gtin catalogue parity (client vs server)', () => {
  it('both catalogues list exactly the same GTINs', () => {
    const client = gtinMapKeys(CLIENT_MAP);
    const server = gtinMapKeys(SERVER_MAP);

    const missingFromServer = [...client].filter((g) => !server.has(g)).sort();
    const missingFromClient = [...server].filter((g) => !client.has(g)).sort();

    expect(
      { missingFromServer, missingFromClient },
      'The client and server GTIN catalogues have drifted. Products missing from the '
        + 'SERVER report as "Unknown" in the "Other" category in every report; products '
        + 'missing from the CLIENT fail to resolve when scanned. Add them to both.',
    ).toEqual({ missingFromServer: [], missingFromClient: [] });
  });

  it('finds a non-trivial number of products (guards against a parse failure)', () => {
    // If the regex or the slice above silently stopped matching, the parity test
    // would pass vacuously on two empty sets. Anchor it to a realistic floor.
    expect(gtinMapKeys(SERVER_MAP).size).toBeGreaterThan(100);
  });
});

describe('Telescopic Lag Screws (v3.46) resolve on the server', () => {
  // The exact regression above: present on the client, absent on the server.
  const CASES = [
    ['9454785', 'PFL-T085', 'Lag Screw Telescopic 85mm'],
    ['9454792', 'PFL-T090', 'Lag Screw Telescopic 90mm'],
    ['9454815', 'PFL-T100', 'Lag Screw Telescopic 100mm'],
    ['9454822', 'PFL-T105', 'Lag Screw Telescopic 105mm'],
    ['9454839', 'PFL-T110', 'Lag Screw Telescopic 110mm'],
  ] as const;

  it.each(CASES)('%s -> %s, labelled and categorised', (gtinShort, ref, label) => {
    expect(getItemNumber(gtinShort)).toBe(ref);
    expect(getProductLabel(gtinShort)).toBe(label);
    // Must be "Lag Screw", never "Other" — this is what broke the category grouping.
    expect(getProductCategory(gtinShort)).toBe('Lag Screw');
  });

  it('still resolves the legacy SO-SPFL-T REF form', () => {
    expect(getProductCategory('', 'SO-SPFL-T085')).toBe('Lag Screw');
  });
});
