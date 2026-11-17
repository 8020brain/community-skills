/**
 * Building blocks for the free-written sections of a build check sheet
 * (anything in `before` or `after`, and the notes lists).
 *
 * A sheet.cjs can export a function instead of an object. It is called with these
 * helpers, so custom sections can be written without hand-typing the HTML:
 *
 *   module.exports = (b) => ({
 *     before: [{ title: 'What we found', html: b.note('...') + b.call('Why', '...') }],
 *   });
 *
 * Text passed to these helpers is HTML, so <strong> and <em> work. Escape any
 * stray < or & yourself, or run it through b.esc().
 */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A plain paragraph in the body text style.
const note = (html) => `<p class="note">${html}</p>`;

// A boxed callout. { warn: true } gives it the amber edge for cautions.
const call = (title, html, opts = {}) =>
  `<div class="call${opts.warn ? ' warn' : ''}"><div class="t">${title}</div><p>${html}</p></div>`;

// The small uppercase label that sits above a table or list.
const label = (text) => `<div class="plabel">${text}</div>`;

// A coloured status tag. kind: new (brand colour), upd (green), old (grey), wait (amber).
const pill = (text, kind = 'new') => `<span class="pill p-${kind}">${text}</span>`;

// Monospaced text, for IDs and technical names.
const mono = (text) => `<span class="mono">${text}</span>`;

// A table. rows are arrays of cells; the first cell of each row is bolded.
const table = (headers, rows) => `
  <div class="tw"><table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
${rows.map((r) => `      <tr>${r.map((c, i) => `<td${i === 0 ? ' class="ag"' : ''}>${c}</td>`).join('')}</tr>`).join('\n')}
    </tbody>
  </table></div>`;

// Numbered step cards in a row, for "how it works" explanations. items: [{ h, d }]
const steps = (items) => `
  <div class="flow">
${items.map((s, i) => `    <div class="fx"><div class="n">Step ${String(i + 1).padStart(2, '0')}</div><div class="h">${s.h}</div><div class="d">${s.d}</div></div>`).join('\n')}
  </div>`;

// Stat tiles. items: [{ label, value, sub, wait }]. wait: true greys the edge.
const stats = (items) => `
<div class="strip">
${items.map((s) => `  <div class="st${s.wait ? ' wait' : ''}"><span class="lbl">${s.label}</span><div class="val">${s.value}</div>${s.sub ? `<div class="sub">${s.sub}</div>` : ''}</div>`).join('\n')}
</div>`;

// A collapsed panel for detail the client may not need, like IDs.
const details = (summary, count, inner) => `
  <details>
    <summary>${summary}${count ? `<span class="cnt">${count}</span>` : ''}</summary>
    <div class="dbody">${inner}</div>
  </details>`;

// A bullet list. items are HTML strings.
const list = (items) => `<ul>\n${items.map((i) => `  <li>${i}</li>`).join('\n')}\n</ul>`;

// Render a notes array [{ title, body, warn }] as callouts.
const calls = (notes = []) => notes.map((n) => call(n.title, n.body, n)).join('\n');

module.exports = { esc, note, call, label, pill, mono, table, steps, stats, details, list, calls };
