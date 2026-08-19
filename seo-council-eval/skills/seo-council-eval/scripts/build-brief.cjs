#!/usr/bin/env node
/**
 * build-brief.cjs — assemble one scoring agent's complete briefing into a single file.
 *
 * WHY THIS EXISTS:
 * Every scoring agent used to read several files and consume the whole of
 * rubric-core.md and the calibration material in order to use a fraction of each.
 * Multiplied across the panel that is a lot of wasted reading per run. The brief
 * slices rubric-core.md and the overlay to the one dimension the reader owns, and
 * carries calibration-method.md whole (it is short and applies to every seat).
 *
 * This slices both files down to the one dimension the agent actually scores,
 * keeps the parts every reader genuinely needs (weights, verdict bands, the
 * calibrated bands, the reference runs, the statistical and drift cautions),
 * and folds in the persona and the vertical overlay. The agent then reads three
 * files instead of six: this brief, the source copy, and the context pack.
 *
 * It slices reference material only. It never touches the source copy or the
 * context pack, because those must reach the agent complete.
 *
 * Usage:
 *   node build-brief.cjs --dimension onpage --persona aleyda-solis \
 *     --vertical lead-gen --source <src.md> --context <ctx.md> --out <brief.md>
 *
 * Dimensions: entity | geo | intent | eeat | onpage | fit
 */

const fs = require('fs');
const path = require('path');

const SKILL = path.resolve(__dirname, '..');
const REF = path.join(SKILL, 'references');

const DIMENSIONS = {
  entity: {
    label: 'Entity and blueprint conformance',
    rubric: '## 1. Entity and blueprint conformance',
    calib: '## Entity and semantic coverage',
    overlayKeys: ['Entity coverage', 'Entity'],
  },
  geo: {
    label: 'GEO / AEO retrieval',
    rubric: '## 2. GEO / AEO retrieval',
    calib: '## GEO / AEO retrieval',
    overlayKeys: ['GEO / AEO', 'GEO'],
  },
  intent: {
    label: 'Search intent match',
    rubric: '## 3. Search intent match',
    calib: '## Search intent match',
    calibExtra: ['## When the two intent readers disagree'],
    overlayKeys: ['Intent match', 'Intent'],
  },
  eeat: {
    label: 'E-E-A-T',
    rubric: '## 4. E-E-A-T',
    calib: '## E-E-A-T',
    overlayKeys: ['E-E-A-T'],
  },
  onpage: {
    label: 'On-page mechanics',
    rubric: '## 5. On-page mechanics',
    calib: '## On-page mechanics',
    overlayKeys: ['On-page mechanics', 'On-page'],
  },
  fit: {
    label: 'Strategic fit',
    rubric: '## 6. Strategic fit',
    calib: '## Strategic fit',
    overlayKeys: ['Strategic fit'],
  },
};

// Rubric sections every reader needs whatever dimension they score. These used
// to ride along in the preamble; once the rubric grew headed sections above the
// weights table, preamble() silently stopped short of them and briefs shipped
// without the scoring rules. Name them explicitly so that cannot recur.
const RUBRIC_UNIVERSAL = [
  '## What the composite is',
  '## Input sufficiency',
  '## Severity conditions',
  '## Dimension ownership',
  '## Weights and index',
];

function read(p) {
  if (!fs.existsSync(p)) { console.error(`Missing file: ${p}`); process.exit(1); }
  return fs.readFileSync(p, 'utf8');
}

/** Grab a "## " section by header prefix, up to the next "## " at the same level. */
function section(md, prefix) {
  const lines = md.split('\n');
  const start = lines.findIndex(l => l.startsWith('## ') && l.toLowerCase().startsWith(prefix.toLowerCase()));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').trim();
}

/** Everything before the first "## " — the rubric's weights table and verdict bands. */
function preamble(md) {
  const i = md.indexOf('\n## ');
  return (i < 0 ? md : md.slice(0, i)).trim();
}

/**
 * Overlay slice: weight shifts, this dimension's additions, and ONLY the
 * severity conditions tagged for this dimension.
 *
 * The earlier version handed every reader the whole severity list. Two readers
 * in a live run then spent reasoning explicitly declining conditions that were
 * never theirs, and a third could plausibly have applied one by mistake. A
 * defect should move exactly one number, and filtering here is what enforces it.
 */
function overlaySlice(md, keys, dimKey) {
  const out = [];

  // General vertical guidance: any overlay section that is not the weight
  // table, the per-dimension additions, or the severity list. Every reader
  // needs these. Without this pass, guidance added to an overlay as a new
  // section silently never reached a brief, which is exactly what happened
  // when the "page or a template" note was added to the ecommerce overlay.
  const SPECIAL = /^## (weight shifts|dimension additions|.*severity conditions|.*red flags|ask nothing)/i;
  for (const line of md.split('\n')) {
    if (!line.startsWith('## ') || SPECIAL.test(line)) continue;
    const sec = section(md, line.slice(0, 40));
    if (sec) out.push(sec);
  }

  const shifts = section(md, '## Weight shifts');
  if (shifts) out.push(shifts);

  const paras = md.split(/\n\n+/).filter(p => {
    const m = p.match(/^\*\*([^*]+)\*\*/);
    if (!m) return false;
    return keys.some(k => m[1].toLowerCase().includes(k.toLowerCase()));
  });
  if (paras.length) out.push('## Additions for your dimension in this vertical\n\n' + paras.join('\n\n'));

  const sevHeader = md.split('\n').find(l => /^## .*(severity conditions|red flags)/i.test(l));
  if (sevHeader) {
    const sec = section(md, sevHeader.slice(0, 30));
    if (sec) {
      const mine = sec.split('\n').filter(l => new RegExp(`^\\s*-\\s*\\*\\*\\[${dimKey}\\]`, 'i').test(l));
      out.push(mine.length
        ? `## Severity conditions you score\n\nThese are the conditions tagged to your dimension in this vertical. Other dimensions have their own; you may mention them in findings but must not take a numeric hit for them.\n\n${mine.join('\n')}`
        : `## Severity conditions you score\n\nNone in this vertical are tagged to your dimension. Score against the anchors alone. If you see a defect that clearly belongs to another dimension, note it in your findings and leave the number to that reader.`);
    }
  }
  return out.join('\n\n');
}

function main() {
  const args = process.argv.slice(2);
  const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

  const dimKey = (flag('--dimension') || '').toLowerCase();
  const dim = DIMENSIONS[dimKey];
  if (!dim) {
    console.error(`--dimension must be one of: ${Object.keys(DIMENSIONS).join(', ')}`);
    process.exit(1);
  }
  const personaArg = flag('--persona');
  const vertical = flag('--vertical');
  const source = flag('--source');
  const context = flag('--context');
  const out = flag('--out');
  if (!personaArg || !vertical || !source || !context) {
    console.error('required: --dimension --persona --vertical --source --context [--out]');
    process.exit(1);
  }

  const personaPath = personaArg.includes('/')
    ? personaArg
    : path.join(SKILL, 'personas', personaArg.replace(/\.md$/, '') + '.md');
  const overlayPath = path.join(REF, `overlay-${vertical}.md`);

  const persona = read(personaPath);
  const rubric = read(path.join(REF, 'rubric-core.md'));
  // This skill ships no per-dimension worked examples (see calibration-method.md
  // for why), so the brief carries the method file whole rather than slicing a
  // section per dimension. It is short, and every reader benefits from all of it.
  const calib = read(path.join(REF, 'calibration-method.md'));
  const overlay = read(overlayPath);

  const rubricDim = section(rubric, dim.rubric);
  if (!rubricDim) { console.error(`Could not find "${dim.rubric}" in rubric-core.md`); process.exit(1); }
  const discipline = section(rubric, '## Scoring discipline');

  const doc = `# Scoring brief: ${dim.label}

You are scoring **one dimension only**: ${dim.label}. Everything below was
assembled from the sections of the council's rubric, overlay and calibration
files that are assigned to your dimension, so you do not have to read any of
them in full. If you find yourself needing material that is not here, say so in
your findings rather than guessing at it.

Two files are NOT included here and you must read them yourself:

- The copy under review: \`${source}\`
- The context pack: \`${context}\`

Both are complete and verbatim. Read them in full.

---

# Part 1 — Your persona

${persona.trim()}

---

# Part 2 — The rubric

${preamble(rubric)}

${RUBRIC_UNIVERSAL.map(h => section(rubric, h)).filter(Boolean).join('\n\n')}

${rubricDim}

${discipline || ''}

---

# Part 3 — Vertical overlay (${vertical})

${overlaySlice(overlay, dim.overlayKeys, dimKey)}

---

# Part 4 — Calibration

This skill ships no worked scored examples. Score by the written anchors in Part 2,
and use the method and cautions below. Build your own worked anchors over time as
described here.

${calib.trim()}
`;

  if (out) {
    fs.writeFileSync(out, doc);
    const words = doc.split(/\s+/).length;
    console.error(`Wrote ${out} (${doc.length} chars, ~${Math.round(words * 4 / 3)} tokens)`);
  } else {
    console.log(doc);
  }
}

main();
