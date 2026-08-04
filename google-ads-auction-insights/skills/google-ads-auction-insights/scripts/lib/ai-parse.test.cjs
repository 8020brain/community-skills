#!/usr/bin/env node
/**
 * ai-parse.test.cjs — regression tests for the parsing layer.
 *
 * The whole reason this fork exists is that the original parser assumed one
 * locale and silently produced numbers that were 100x wrong on UK data. These
 * tests exist so that can never come back. Run: node ai-parse.test.cjs
 */

'use strict';

const assert = require('assert');
const P = require('./ai-parse.cjs');

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

// ---- percentages -----------------------------------------------------------

check('UK decimal point is a decimal point, not a thousands separator', () => {
  assert.strictEqual(P.parsePercent('46.75%'), 46.75);
  assert.strictEqual(P.parsePercent('9.1%'), 9.1);
  assert.strictEqual(P.parsePercent('100.00%'), 100);
});

check('Italian decimal comma still parses', () => {
  assert.strictEqual(P.parsePercent('46,75%'), 46.75);
  assert.strictEqual(P.parsePercent('9,1%'), 9.1);
});

check('mixed separators resolve by rightmost', () => {
  assert.strictEqual(P.parsePercent('1,234.56'), 1234.56);
  assert.strictEqual(P.parsePercent('1.234,56'), 1234.56);
});

check('repeated separator is thousands grouping', () => {
  assert.strictEqual(P.parsePercent('1.234.567'), 1234567);
});

check('suppressed and not-applicable values', () => {
  assert.strictEqual(P.parsePercent('< 10%'), P.LT10_VALUE);
  assert.strictEqual(P.parsePercent('<10%'), P.LT10_VALUE);
  assert.strictEqual(P.parsePercent('--'), null);
  assert.strictEqual(P.parsePercent(''), null);
  assert.strictEqual(P.parsePercent('n/a'), null);
  assert.strictEqual(P.parsePercent(null), null);
});

check('numeric cells: fractions scale up, percentage points do not', () => {
  assert.strictEqual(P.parsePercent(0.4675), 46.75);
  assert.strictEqual(P.parsePercent(46.75), 46.75);
  assert.strictEqual(P.parsePercent(1), 1);
});

check('garbage is null, never a number', () => {
  assert.strictEqual(P.parsePercent('abc'), null);
  assert.strictEqual(P.parsePercent('n/d %'), null);
});

// ---- header mapping --------------------------------------------------------

const UK_SEARCH_HEADER = [
  'Week', 'Display URL domain', 'Impr. share', 'Overlap rate',
  'Position above rate', 'Top of page rate', 'Abs. Top of page rate', 'Outranking share',
];

check('UK search header maps every field to the right column', () => {
  const { map } = P.mapColumns(UK_SEARCH_HEADER);
  assert.deepStrictEqual(map, { week: 0, entity: 1, imp: 2, ov: 3, pos: 4, top: 5, abs: 6, ot: 7 });
});

check('"Abs. Top of page rate" does not steal the "Top of page rate" slot', () => {
  const { map } = P.mapColumns(['Week', 'Display URL domain', 'Abs. Top of page rate', 'Top of page rate']);
  assert.strictEqual(map.abs, 2);
  assert.strictEqual(map.top, 3);
});

check('"Outranking share" does not steal the "Impr. share" slot', () => {
  const { map } = P.mapColumns(['Week', 'Display URL domain', 'Outranking share', 'Impr. share']);
  assert.strictEqual(map.ot, 2);
  assert.strictEqual(map.imp, 3);
});

check('Italian search header still maps', () => {
  const { map } = P.mapColumns([
    'Settimana', "Dominio dell'URL di visualizzazione", 'Quota impressioni', 'Tasso di sovrapposizione',
    'Tasso posizionamento superiore', 'Tasso in alto nella pagina', 'Tasso in cima alla pagina', 'Quota superamento target',
  ]);
  assert.deepStrictEqual(map, { week: 0, entity: 1, imp: 2, ov: 3, pos: 4, top: 5, abs: 6, ot: 7 });
});

check('column order does not matter', () => {
  const { map } = P.mapColumns(['Overlap rate', 'Week', 'Impr. share', 'Display URL domain']);
  assert.strictEqual(map.ov, 0);
  assert.strictEqual(map.week, 1);
  assert.strictEqual(map.imp, 2);
  assert.strictEqual(map.entity, 3);
});

check('report type detected from the columns present', () => {
  assert.strictEqual(P.typeFromMap(P.mapColumns(UK_SEARCH_HEADER).map), 'srch');
  assert.strictEqual(
    P.typeFromMap(P.mapColumns(['Week', 'Store name', 'Impr. share', 'Overlap rate', 'Outranking share']).map),
    'shop'
  );
});

// ---- whole file ------------------------------------------------------------

const UK_SEARCH_CSV = [
  'Auction insights report',
  '1 Jan 2026 - 30 Jun 2026',
  UK_SEARCH_HEADER.join(','),
  '2026-06-15,You,46.75%,--,--,88.10%,31.20%,--',
  '2026-06-15,competitor-a.co.uk,22.30%,41.00%,18.90%,72.40%,19.10%,68.20%',
  '2026-06-15,competitor-b.co.uk,< 10%,12.50%,7.10%,55.00%,9.90%,84.30%',
  '2026-06-22,You,51.02%,--,--,90.00%,35.60%,--',
  '2026-06-22,competitor-a.co.uk,19.80%,38.70%,15.40%,70.10%,17.30%,71.50%',
].join('\n');

check('a UK search report parses end to end with correct magnitudes', () => {
  const parsed = P.parseReport(UK_SEARCH_CSV);
  assert.strictEqual(parsed.type, 'srch');
  assert.strictEqual(parsed.headerRow, 2, 'header row found beneath the report title lines');
  assert.strictEqual(parsed.rows.length, 5);

  const you = parsed.rows.find(r => r.s === 'You' && r.w === '2026-06-15');
  assert.strictEqual(you.imp, 46.75, 'impression share must be 46.75, not 4675');
  assert.strictEqual(you.ov, null, 'overlap is not applicable on your own row');
  assert.strictEqual(you.top, 88.1);
  assert.strictEqual(you.abs, 31.2);

  const b = parsed.rows.find(r => r.s === 'competitor-b.co.uk');
  assert.strictEqual(b.imp, P.LT10_VALUE);
  assert.strictEqual(b.ot, 84.3);
});

check('the "You" row is recognised in any report language', () => {
  assert.strictEqual(P.canonicalEntity('You'), 'You');
  assert.strictEqual(P.canonicalEntity('Tu'), 'You');
  assert.strictEqual(P.canonicalEntity('Sie'), 'You');
  assert.strictEqual(P.canonicalEntity('competitor-a.co.uk'), 'competitor-a.co.uk');
});

// Header line and value formats copied verbatim from a real UK download
// (verified 28 Jul 2026). Competitor domains are replaced with placeholders:
// the real ones are a client's competitive data and this file is shareable.
// Note "Impression share", not the "Impr. share" some views show, and the
// leading space in " --" — both are exactly as Google writes them.
const REAL_UK_EXPORT = [
  'Auction insights report',
  '"April 1, 2026 - July 27, 2026"',
  'Display URL domain,Impression share,Overlap rate,Position above rate,Top of page rate,Abs. Top of page rate,Outranking share',
  'competitor-one.co.uk,< 10%,9.64%,52.27%,73.51%,25.17%,35.49%',
  'You,37.37%, --, --,69.77%,26.83%, --',
  'competitor-two.co.uk,13.22%,19.17%,76.00%,76.47%,40.56%,31.93%',
].join('\n');

check('real UK column names all map (verified against a live download)', () => {
  const { map, unmapped } = P.mapColumns(REAL_UK_EXPORT.split('\n')[2].split(','));
  assert.deepStrictEqual(unmapped, [], 'every column should be recognised');
  assert.deepStrictEqual(map, { entity: 0, imp: 1, ov: 2, pos: 3, top: 4, abs: 5, ot: 6 });
});

check('real UK values parse, including the leading-space " --"', () => {
  assert.strictEqual(P.parsePercent('9.64%'), 9.64);
  assert.strictEqual(P.parsePercent('37.37%'), 37.37);
  assert.strictEqual(P.parsePercent('76.00%'), 76);
  assert.strictEqual(P.parsePercent(' --'), null);
  assert.strictEqual(P.parsePercent('< 10%'), P.LT10_VALUE);
});

check('a manual interface download says so instead of failing vaguely', () => {
  assert.throws(() => P.parseReport(REAL_UK_EXPORT), /no week column/);
  assert.throws(() => P.parseReport(REAL_UK_EXPORT), /scheduled report/);
});

check('an unrecognisable header fails loudly instead of guessing columns', () => {
  assert.throws(
    () => P.parseReport('alpha,beta,gamma\n1,2,3'),
    /could not find a header row/
  );
});

check('dedupe keeps the last row per week and competitor', () => {
  const rows = P.dedupe([
    { w: '2026-06-15', s: 'a', imp: 10 },
    { w: '2026-06-15', s: 'a', imp: 20 },
    { w: '2026-06-22', s: 'a', imp: 30 },
  ]);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows.find(r => r.w === '2026-06-15').imp, 20);
});

check('pipe-delimited snapshots parse the same way', () => {
  const psv = [
    'Week|Display URL domain|Impr. share|Overlap rate|Position above rate|Top of page rate|Abs. Top of page rate|Outranking share',
    '2026-06-15|You|46.75%|--|--|88.10%|31.20%|--',
  ].join('\n');
  const parsed = P.parseReport(psv);
  assert.strictEqual(parsed.rows[0].imp, 46.75);
});

// The first real SCHEDULED report landed 29 Jul 2026 (a UK search campaign). These
// are its first rows with the report name and the competitor domains replaced by
// placeholders; the headers, the date range and the value formats are exactly as
// Google wrote them. It is the only place the Week column header is confirmed:
// Google writes it as plain "Week", and it sits in column 1 under a two-row
// preamble of report name and date range.
const REAL_SCHEDULED_EXPORT = [
  'Example Residential Campaign',
  '"April 1, 2026 - July 27, 2026"',
  'Week,Display URL domain,Impression share,Overlap rate,Position above rate,Top of page rate,Abs. Top of page rate,Outranking share',
  '2026-04-13,competitor-one.com,21.82%,22.85%,49.18%,80.68%,17.9%,29.39%',
  '2026-04-13,competitor-two.co.uk,< 10%,16.48%,51.14%,81.65%,36.71%,30.32%',
  '2026-04-13,You,33.11%,--,--,69.66%,27.34%,--',
].join('\n');

check('the real scheduled report maps every column, Week included', () => {
  const parsed = P.parseReport(REAL_SCHEDULED_EXPORT);
  assert.deepStrictEqual(parsed.warnings, [], 'no column should be unrecognised');
  assert.strictEqual(parsed.headerRow, 2, 'header sits under the two-row preamble');
  assert.strictEqual(parsed.type, 'srch');
  assert.deepStrictEqual(parsed.map, {
    week: 0, entity: 1, imp: 2, ov: 3, pos: 4, top: 5, abs: 6, ot: 7,
  });
  assert.strictEqual(parsed.rows.length, 3);
  assert.deepStrictEqual(parsed.rows[0], {
    w: '2026-04-13', s: 'competitor-one.com',
    imp: 21.82, ov: 22.85, pos: 49.18, top: 80.68, abs: 17.9, ot: 29.39,
  });
  assert.strictEqual(parsed.rows[1].imp, P.LT10_VALUE);
  assert.strictEqual(parsed.rows[2].s, P.YOU);
});

// A pipe-delimited export of the same file kept its preamble, and the preamble
// rows carry no delimiter at all. Reading only line 1 called it comma-delimited
// and the header row was then never found.
check('the delimiter is found despite a delimiter-free preamble', () => {
  const psv = REAL_SCHEDULED_EXPORT.split('\n').map(l => l.replace(/,/g, '|')).join('\n');
  assert.strictEqual(P.detectDelimiter(psv.split('\n')), '|');
  const parsed = P.parseReport(psv);
  assert.strictEqual(parsed.rows.length, 3);
  assert.strictEqual(parsed.rows[0].imp, 21.82);
});

check('detectDelimiter still accepts a single line', () => {
  assert.strictEqual(P.detectDelimiter('a|b|c'), '|');
  assert.strictEqual(P.detectDelimiter('a,b,c'), ',');
});

if (!process.exitCode) console.log(`ai-parse: ${passed} checks passed`);
else console.error('\nai-parse: FAILURES above');
