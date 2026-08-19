#!/usr/bin/env node
/**
 * check-attribution.cjs - refuse to ship a council report that presents a seat
 * as though the named practitioner reviewed the client's page.
 *
 * Why this is a script and not a rule: the rule already existed, in the report
 * template, stated plainly. It was ignored in six of ten reports anyway, five of
 * which went into client folders. A written instruction that the orchestrator
 * reads once at the start of a long run is not a control. This is.
 *
 * Two checks:
 *   1. Every report carries the disclaimer.
 *   2. No heading or table row attributes a score to a bare practitioner name.
 *      Lens form ("Entity lens, informed by Koray Tugberk GUBUR's work") passes;
 *      "Koray Tugberk GUBUR on entity and semantic coverage: 5/10" does not.
 *
 * The roster is read from personas/, so new seats are covered automatically.
 *
 * Usage:
 *   node check-attribution.cjs <file-or-dir>...
 *   node check-attribution.cjs --all        # every council report in the brain
 *   node check-attribution.cjs --personas   # lint the persona files themselves
 *
 * Exit codes: 0 clean, 1 violations found, 2 bad usage.
 */

const fs = require('fs');
const path = require('path');

const DISCLAIMER_KEY = 'not consultations, endorsements, or opinions given by';
const SKILL_DIR = path.resolve(__dirname, '..');

function repoRoot(start) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md')) && fs.existsSync(path.join(dir, 'clients'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** Practitioner names, read from the persona files so the roster cannot drift. */
function roster() {
  const dir = path.join(SKILL_DIR, 'personas');
  if (!fs.existsSync(dir)) return [];
  const names = [];
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.md'))) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    // Collect every name this person might appear under. The formal "Full Name"
    // is not always what reports write: Mike King's persona records "Michael
    // King", and a gate matching only that missed every "Mike King" heading in
    // six reports while reporting them clean. Aliases come from the file's H1,
    // the Full Name field, and the filename slug.
    const aliases = new Set();
    const h1 = txt.match(/^#\s+(.+?)\s+-\s+Council Persona/m);
    if (h1) aliases.add(h1[1].trim());
    const m = txt.match(/\*\*Full Name:\*\*\s*(.+)/);
    if (m) aliases.add(m[1].trim());
    aliases.add(f.replace(/\.md$/, '').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '));

    if (!aliases.size) continue;
    const primary = h1 ? h1[1].trim() : m[1].trim();
    const lensMatch = txt.match(/\*\*Lens:\*\*\s*(.+)/);
    names.push({
      full: primary,
      aliases: [...aliases].sort((a, b) => b.length - a.length),
      surname: primary.split(/\s+/).pop(),
      lens: lensMatch ? lensMatch[1].trim() : `Analytical lens, informed by ${primary}'s published work`,
    });
  }
  return names;
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A line is a violation if it is a heading or table row, names a practitioner,
 * and does not frame that name as a lens.
 *
 * Surnames are matched only in the narrow "### King on retrieval" shape, because
 * several are ordinary words (King, Law, Ray, Shaw) and matching them loosely
 * would flag prose that is perfectly fine.
 */
function scanLine(line, names) {
  const isHeading = /^#{1,6}\s/.test(line);
  const isTableRow = /^\s*\|/.test(line);
  if (!isHeading && !isTableRow) return null;
  if (/\blens\b/i.test(line)) return null;

  for (const n of names) {
    for (const alias of n.aliases) {
      if (new RegExp(`\\b${esc(alias)}\\b`, 'i').test(line)) return n;
    }
    if (new RegExp(`^#{1,6}\\s*${esc(n.surname)}\\s+on\\b`, 'i').test(line)) return n;
  }
  return null;
}

function checkFile(file, names) {
  const raw = fs.readFileSync(file, 'utf8');
  // Normalise whitespace so a disclaimer wrapped across lines still matches.
  const flat = raw.replace(/\s+/g, ' ');
  const problems = [];

  if (!flat.includes(DISCLAIMER_KEY)) {
    problems.push({ line: null, kind: 'missing-disclaimer', text: 'Report does not carry the attribution disclaimer.' });
  }

  raw.split('\n').forEach((line, i) => {
    const who = scanLine(line, names);
    if (who) problems.push({ line: i + 1, kind: "bare-name", text: line.trim(), who: who.full, lens: who.lens });
  });

  return problems;
}

/**
 * Is this file a council report, as opposed to a document that merely mentions
 * one? Matching on the skill name appearing anywhere in the first few
 * kilobytes was too loose: it flagged a companion build spec whose opening line
 * cites the council report it was written alongside. That document has no seats
 * and needs no disclaimer, and holding it to this gate would train people to
 * ignore failures.
 *
 * The reliable signal is the `council:` frontmatter field the report template
 * writes. Filename is kept as a fallback for reports written without the
 * template.
 */
function isCouncilReport(file) {
  if (/seo-council-eval/i.test(path.basename(file))) return true;
  const head = fs.readFileSync(file, 'utf8').slice(0, 1200);
  return /^council:\s*(seo-council-eval)/m.test(head);
}

function collect(target, out) {
  const st = fs.statSync(target);
  if (st.isDirectory()) {
    for (const n of fs.readdirSync(target)) collect(path.join(target, n), out);
  } else if (/\.md$/i.test(target)) {
    out.push(target);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('usage: node check-attribution.cjs <file-or-dir>... | --all');
    process.exit(2);
  }

  const names = roster();
  if (!names.length) {
    console.error('Could not read any personas. Is personas/ present next to this script?');
    process.exit(2);
  }

  let files = [];
  if (args.includes('--all')) {
    // --all is a batch convenience: scan every council report in the project. The
    // mandatory gate is single-file mode, which needs no root at all. So if there
    // is no Agency Brain root, fall back to the working directory rather than
    // erroring; a project with no clients/ and no data/councils/ simply yields
    // "no reports to check", which is the correct answer for a fresh install.
    const root = repoRoot(process.cwd()) || repoRoot(__dirname) || process.cwd();
    const candidates = [];
    const clients = path.join(root, 'clients');
    if (fs.existsSync(clients)) {
      for (const c of fs.readdirSync(clients)) {
        const r = path.join(clients, c, 'reports');
        if (fs.existsSync(r) && fs.statSync(r).isDirectory()) collect(r, candidates);
      }
    }
    const councils = path.join(root, 'data', 'councils');
    if (fs.existsSync(councils)) collect(councils, candidates);
    files = candidates.filter(isCouncilReport);
  } else {
    // A named file is checked as given. A directory is filtered to council
    // reports, so pointing this at clients/x/reports/ does not flag topical map
    // briefs and blueprints, which have no seats and need no disclaimer.
    for (const a of args) {
      if (!fs.existsSync(a)) { console.error(`No such path: ${a}`); process.exit(2); }
      const resolved = path.resolve(a);
      if (fs.statSync(resolved).isDirectory()) {
        files.push(...collect(resolved, []).filter(isCouncilReport));
      } else {
        files.push(resolved);
      }
    }
  }

  files = [...new Set(files)].sort();
  if (!files.length) {
    console.log('No council reports found to check.');
    return;
  }

  let failed = 0;
  const root = repoRoot(process.cwd()) || repoRoot(__dirname) || '';
  for (const f of files) {
    const problems = checkFile(f, names);
    const rel = root ? path.relative(root, f) : f;
    if (!problems.length) {
      console.log(`PASS  ${rel}`);
      continue;
    }
    failed++;
    console.log(`FAIL  ${rel}`);
    for (const p of problems) {
      if (p.kind === 'missing-disclaimer') {
        console.log('        missing disclaimer. Add near the top, as a blockquote:');
        console.log('        > The lenses below are analytical perspectives built from each');
        console.log("        > practitioner's published work. They are not consultations,");
        console.log('        > endorsements, or opinions given by the named individuals, none of');
        console.log('        > whom has reviewed this page.');
      } else {
        console.log(`        line ${p.line}: names ${p.who} without lens framing`);
        console.log(`          ${p.text.slice(0, 110)}`);
        console.log(`          use: ${p.lens}`);
      }
    }
    console.log('');
  }

  console.log(`\n${files.length - failed}/${files.length} reports pass attribution.`);
  if (failed) {
    console.log('\nRewrite flagged headings in lens form, moving the name into an');
    console.log('italic attribution line beneath the heading:');
    console.log('');
    console.log('  ### Entity and semantic coverage: 5/10');
    console.log('');
    console.log("  *Entity and semantic lens, informed by Koray Tugberk GUBUR's published");
    console.log('  topical authority frameworks.*');
    console.log('');
    console.log('In scorecard tables, put the lens phrase in the Lens column rather than');
    console.log('the bare name. The exact phrase for each seat is printed above.');
    process.exit(1);
  }
}


/**
 * Lint the persona files. These are the only files in the skill that name real
 * people at length, so they carry three rules that are easy to undo by accident
 * when someone adds or edits a seat:
 *
 *   - a `**Lens:**` line, so a report can name the seat without naming the person
 *   - a `## Sources` block, so the file reads as commentary on published work
 *   - no invented first-person quotation attributed to the named individual
 *
 * The third matters most. A disclaimer in another file does not travel with a
 * quotation, and a fabricated quote is the item most likely to cause real
 * offence to a real person. Conceptual quoting ("what can we rank for") and real
 * book titles are legitimate and are deliberately not flagged.
 */
function cmdPersonas() {
  const dir = path.join(SKILL_DIR, 'personas');
  if (!fs.existsSync(dir)) { console.error('No personas/ directory found.'); process.exit(2); }
  const files = fs.readdirSync(dir).filter(n => n.endsWith('.md')).sort();
  let bad = 0;

  for (const name of files) {
    const txt = fs.readFileSync(path.join(dir, name), 'utf8');
    const problems = [];

    if (!/^\*\*Lens:\*\*\s*\S/m.test(txt)) problems.push('missing a **Lens:** line');
    if (!/^## Sources/m.test(txt)) problems.push('missing a ## Sources section');
    else if (!/^## Sources[\s\S]{0,400}?^- /m.test(txt)) problems.push('## Sources has no entries');

    const speech = txt.match(/\b(saying|says,|puts it,|would say|in his words|in her words)\s*"/i);
    if (speech) problems.push(`quotation attributed as speech near "${speech[0].trim()}"`);

    const vt = txt.match(/^\*\*Voice tell:\*\*.*$/m);
    if (vt && /"/.test(vt[0])) problems.push('the Voice tell line contains a quotation');

    if (problems.length) {
      bad++;
      console.log(`FAIL  personas/${name}`);
      problems.forEach(pr => console.log(`        ${pr}`));
    }
  }

  console.log(`\n${files.length - bad} of ${files.length} personas pass.`);
  if (bad) {
    console.log('\nVoice tells describe how the lens reasons, in the third person.');
    console.log('They must not put words in a real person\'s mouth.');
    process.exit(1);
  }
}

if (process.argv.includes('--personas')) { cmdPersonas(); } else { main(); }

