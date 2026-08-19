#!/usr/bin/env node
/**
 * read-xlsx.cjs — dump an .xlsx workbook to plain text so a skill can read it.
 *
 * Why this exists: the entity-brand-blueprint skill ships its deliverable as an
 * .xlsx, and seo-council-eval has to score copy against that blueprint. Without
 * this, the entity seat scores against a second-hand summary of the blueprint
 * instead of the blueprint itself.
 *
 * Dependency-free on purpose. An .xlsx is a ZIP of XML, and Node's zlib can
 * inflate it, so this works on any machine that can run the rest of the brain.
 *
 * Usage:
 *   node read-xlsx.cjs <file.xlsx>                  all sheets
 *   node read-xlsx.cjs <file.xlsx> --list           sheet names only
 *   node read-xlsx.cjs <file.xlsx> --sheet "Name"   one sheet
 *   node read-xlsx.cjs <file.xlsx> --max-rows 50    cap rows per sheet
 */

const fs = require('fs');
const zlib = require('zlib');

// ---------- minimal ZIP reader ----------

function readZip(buf) {
  // End of Central Directory: scan backwards for the signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file (no end-of-central-directory record). Is this really an .xlsx?');

  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const entries = {};

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const fnLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + fnLen);

    // Local header tells us where the data actually starts.
    const lFnLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lFnLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    entries[name] = () => (method === 0 ? raw : zlib.inflateRawSync(raw));
    ptr += 46 + fnLen + extraLen + commentLen;
  }
  return entries;
}

// ---------- tiny XML helpers ----------

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function unescapeXml(s) {
  return s.replace(/&(amp|lt|gt|quot|apos|#x?[0-9a-fA-F]+);/g, (m, e) => {
    if (ENT[e]) return ENT[e];
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X'
        ? parseInt(e.slice(2), 16)
        : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return m;
  });
}

/** All text inside <t>...</t> tags of a fragment, concatenated (handles rich-text runs). */
function textOf(fragment) {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(fragment)) !== null) out += unescapeXml(m[1] || '');
  return out;
}

function colToIndex(ref) {
  const letters = (ref.match(/^[A-Z]+/) || ['A'])[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// ---------- workbook parsing ----------

function parseSharedStrings(entries) {
  if (!entries['xl/sharedStrings.xml']) return [];
  const xml = entries['xl/sharedStrings.xml']().toString('utf8');
  const out = [];
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(textOf(m[1] || ''));
  return out;
}

function parseSheetList(entries) {
  const wb = entries['xl/workbook.xml']().toString('utf8');

  // rId -> target path
  const relMap = {};
  if (entries['xl/_rels/workbook.xml.rels']) {
    const rels = entries['xl/_rels/workbook.xml.rels']().toString('utf8');
    const re = /<Relationship\b[^>]*\/?>/g;
    let m;
    while ((m = re.exec(rels)) !== null) {
      const id = (m[0].match(/Id="([^"]+)"/) || [])[1];
      let target = (m[0].match(/Target="([^"]+)"/) || [])[1];
      if (!id || !target) continue;
      target = target.replace(/^\/?xl\//, '').replace(/^\.\//, '');
      relMap[id] = 'xl/' + target;
    }
  }

  const sheets = [];
  const re = /<sheet\b[^>]*\/?>/g;
  let m;
  let fallback = 1;
  while ((m = re.exec(wb)) !== null) {
    const name = unescapeXml((m[0].match(/name="([^"]*)"/) || ['', ''])[1]);
    const rid = (m[0].match(/r:id="([^"]+)"/) || [])[1];
    const path = (rid && relMap[rid]) || `xl/worksheets/sheet${fallback}.xml`;
    fallback++;
    sheets.push({ name, path });
  }
  return sheets;
}

function parseSheet(xml, shared, maxRows) {
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g;
  let rm;
  while ((rm = rowRe.exec(xml)) !== null) {
    if (maxRows && rows.length >= maxRows) break;
    const body = rm[1] || '';
    const cells = [];
    const cellRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(body)) !== null) {
      const attrs = cm[1] || '';
      const inner = cm[2] || '';
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      const type = (attrs.match(/t="([^"]+)"/) || [])[1];
      const idx = ref ? colToIndex(ref) : cells.length;

      let value = '';
      if (type === 's') {
        const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
        const i = vm ? parseInt(vm[1], 10) : -1;
        value = shared[i] !== undefined ? shared[i] : '';
      } else if (type === 'inlineStr') {
        value = textOf(inner);
      } else {
        const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
        value = vm ? unescapeXml(vm[1]) : '';
      }

      while (cells.length < idx) cells.push('');
      cells[idx] = value.replace(/\s+/g, ' ').trim();
    }
    rows.push(cells);
  }
  // drop trailing fully-empty rows
  while (rows.length && rows[rows.length - 1].every(c => !c)) rows.pop();
  return rows;
}

function renderRows(rows) {
  if (!rows.length) return '_(empty sheet)_\n';
  const width = Math.max(...rows.map(r => r.length));
  const pad = r => { const c = r.slice(); while (c.length < width) c.push(''); return c; };
  const esc = c => c.replace(/\|/g, '\\|');

  const header = pad(rows[0]).map(esc);
  let out = '| ' + header.join(' | ') + ' |\n';
  out += '|' + header.map(() => '---').join('|') + '|\n';
  for (const r of rows.slice(1)) out += '| ' + pad(r).map(esc).join(' | ') + ' |\n';
  return out;
}

// ---------- main ----------

function main() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('usage: read-xlsx.cjs <file.xlsx> [--list] [--sheet "Name"] [--max-rows N]');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const only = flag('--sheet');
  const maxRows = parseInt(flag('--max-rows') || '0', 10);

  let entries;
  try {
    entries = readZip(fs.readFileSync(file));
  } catch (e) {
    console.error(`Could not read ${file}: ${e.message}`);
    process.exit(1);
  }
  if (!entries['xl/workbook.xml']) {
    console.error('No xl/workbook.xml inside. This is a zip, but not an xlsx workbook.');
    process.exit(1);
  }

  const sheets = parseSheetList(entries);

  if (args.includes('--list')) {
    console.log(sheets.map(s => s.name).join('\n'));
    return;
  }

  const shared = parseSharedStrings(entries);
  const wanted = only
    ? sheets.filter(s => s.name.toLowerCase() === only.toLowerCase())
    : sheets;

  if (only && !wanted.length) {
    console.error(`No sheet named "${only}". Available: ${sheets.map(s => s.name).join(', ')}`);
    process.exit(1);
  }

  console.log(`# ${file.split('/').pop()}\n`);
  console.log(`Sheets: ${sheets.map(s => s.name).join(', ')}\n`);

  for (const sheet of wanted) {
    console.log(`\n## ${sheet.name}\n`);
    const entry = entries[sheet.path];
    if (!entry) { console.log('_(sheet data not found in workbook)_\n'); continue; }
    console.log(renderRows(parseSheet(entry().toString('utf8'), shared, maxRows)));
  }
}

main();
