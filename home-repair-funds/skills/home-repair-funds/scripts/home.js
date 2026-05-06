#!/usr/bin/env node
/**
 * Home Maintenance Tracker
 *
 * Commands:
 *   init [--force]
 *   list
 *   add --name "..." --category ... --last-replaced YYYY-MM-DD --lifespan N --cost N [--id slug] [--notes "..."]
 *   update <id> --type replace|repair --date YYYY-MM-DD --cost N [--notes "..."]
 *   flag <id> --hoa true|false
 *   status
 *   upcoming [--years N]
 *   set-home --value N --purchase-date YYYY-MM-DD [--notes "..."]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_FILE = path.join(__dirname, '..', 'data', 'home-inventory.json');

const DEFAULT_ITEMS = [
  // Structure
  { id: 'roof', name: 'Roof (asphalt shingle)', category: 'structure', lifespan_years: 22, replacement_cost: 15000 },
  { id: 'siding', name: 'Siding', category: 'structure', lifespan_years: 30, replacement_cost: 15000 },
  { id: 'windows', name: 'Windows (whole house)', category: 'structure', lifespan_years: 25, replacement_cost: 15000 },
  { id: 'foundation-waterproofing', name: 'Foundation waterproofing', category: 'structure', lifespan_years: 25, replacement_cost: 8000 },
  { id: 'driveway', name: 'Driveway (asphalt)', category: 'structure', lifespan_years: 20, replacement_cost: 7000 },
  // HVAC
  { id: 'furnace', name: 'Furnace', category: 'hvac', lifespan_years: 18, replacement_cost: 6000 },
  { id: 'central-ac', name: 'Central AC', category: 'hvac', lifespan_years: 15, replacement_cost: 7500 },
  { id: 'water-heater', name: 'Water heater (tank)', category: 'hvac', lifespan_years: 12, replacement_cost: 2500 },
  { id: 'sump-pump', name: 'Sump pump', category: 'hvac', lifespan_years: 8, replacement_cost: 700 },
  // Plumbing/Electrical
  { id: 'sewer-line', name: 'Sewer line', category: 'plumbing-electrical', lifespan_years: 60, replacement_cost: 8000 },
  { id: 'electrical-panel', name: 'Electrical panel', category: 'plumbing-electrical', lifespan_years: 30, replacement_cost: 3000 },
  { id: 'water-softener', name: 'Water softener', category: 'plumbing-electrical', lifespan_years: 12, replacement_cost: 2000 },
  // Exterior
  { id: 'deck', name: 'Deck', category: 'exterior', lifespan_years: 20, replacement_cost: 12000 },
  { id: 'fence', name: 'Fence', category: 'exterior', lifespan_years: 18, replacement_cost: 5000 },
  { id: 'garage-door', name: 'Garage door', category: 'exterior', lifespan_years: 22, replacement_cost: 2500 },
  { id: 'garage-door-opener', name: 'Garage door opener', category: 'exterior', lifespan_years: 12, replacement_cost: 600 },
  { id: 'exterior-paint', name: 'Exterior paint', category: 'exterior', lifespan_years: 8, replacement_cost: 6000 },
  // Appliances
  { id: 'refrigerator', name: 'Refrigerator', category: 'appliances', lifespan_years: 13, replacement_cost: 2000 },
  { id: 'dishwasher', name: 'Dishwasher', category: 'appliances', lifespan_years: 10, replacement_cost: 1000 },
  { id: 'washer', name: 'Washer', category: 'appliances', lifespan_years: 12, replacement_cost: 900 },
  { id: 'dryer', name: 'Dryer', category: 'appliances', lifespan_years: 13, replacement_cost: 900 },
  { id: 'range', name: 'Range/oven', category: 'appliances', lifespan_years: 14, replacement_cost: 1500 },
  { id: 'microwave', name: 'Microwave', category: 'appliances', lifespan_years: 9, replacement_cost: 400 },
  { id: 'garbage-disposal', name: 'Garbage disposal', category: 'appliances', lifespan_years: 10, replacement_cost: 350 },
  // Interior
  { id: 'carpet', name: 'Carpet', category: 'interior', lifespan_years: 10, replacement_cost: 4000 },
  { id: 'hardwood-refinish', name: 'Hardwood refinish', category: 'interior', lifespan_years: 12, replacement_cost: 2500 },
  { id: 'interior-paint', name: 'Interior paint', category: 'interior', lifespan_years: 8, replacement_cost: 4500 },
  { id: 'kitchen-refresh', name: 'Kitchen refresh', category: 'interior', lifespan_years: 22, replacement_cost: 30000 },
  { id: 'bathroom-refresh', name: 'Bathroom refresh', category: 'interior', lifespan_years: 18, replacement_cost: 12000 },
];

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function load() {
  if (!fs.existsSync(DATA_FILE)) return null;
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function yearsBetween(dateStr, ref = new Date()) {
  const d = new Date(dateStr);
  const ms = ref - d;
  return ms / (365.25 * 24 * 3600 * 1000);
}

function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// === Commands ===

function cmdInit(args) {
  if (fs.existsSync(DATA_FILE) && !args.force) {
    console.error(`Data file already exists at ${DATA_FILE}. Use --force to overwrite.`);
    process.exit(1);
  }
  const data = {
    home: {
      purchase_date: args['purchase-date'] || null,
      value: args.value ? Number(args.value) : null,
      notes: args.notes || '',
    },
    items: [],
  };
  // Seed with default catalog (with no install date - user fills in via update)
  data.items = DEFAULT_ITEMS.map(i => ({
    ...i,
    last_replaced: null,
    hoa_covered: false,
    notes: '',
    history: [],
  }));
  save(data);
  console.log(`Created ${DATA_FILE} with ${data.items.length} default items.`);
  console.log(`Next: for each item you actually have, run:`);
  console.log(`  node home.js update <id> --type install --date YYYY-MM-DD`);
  console.log(`Run 'list' to see all items and their ids.`);
}

function cmdSetHome(args) {
  const data = load() || { home: {}, items: [] };
  if (args.value) data.home.value = Number(args.value);
  if (args['purchase-date']) data.home.purchase_date = args['purchase-date'];
  if (args.notes) data.home.notes = args.notes;
  if (args.inflation !== undefined) data.home.inflation_rate = Number(args.inflation);
  save(data);
  console.log('Home info updated:', data.home);
}

function inflatedCost(item, ref, inflationRate) {
  const dueDate = new Date(item.last_replaced);
  dueDate.setFullYear(dueDate.getFullYear() + item.lifespan_years);
  const yrsToDue = Math.max(0, (dueDate - ref) / (365.25 * 24 * 3600 * 1000));
  return item.replacement_cost * Math.pow(1 + inflationRate, yrsToDue);
}

function cmdList() {
  const data = load();
  if (!data) return console.error('No data file. Run init first.');
  const ref = new Date();
  const byCat = {};
  for (const item of data.items) {
    (byCat[item.category] ||= []).push(item);
  }
  for (const cat of Object.keys(byCat).sort()) {
    console.log(`\n[${cat.toUpperCase()}]`);
    for (const it of byCat[cat]) {
      const age = it.last_replaced ? yearsBetween(it.last_replaced, ref).toFixed(1) : '—';
      const dueIn = it.last_replaced ? (it.lifespan_years - yearsBetween(it.last_replaced, ref)).toFixed(1) : '—';
      const hoa = it.hoa_covered ? ' [HOA]' : '';
      console.log(`  ${it.id.padEnd(26)} ${it.name.padEnd(32)} age:${age}y  lifespan:${it.lifespan_years}y  due-in:${dueIn}y  cost:${fmtMoney(it.replacement_cost)}${hoa}`);
    }
  }
}

function cmdAdd(args) {
  const data = load() || { home: {}, items: [] };
  if (!args.name) return console.error('--name required');
  const id = args.id || slugify(args.name);
  if (data.items.find(i => i.id === id)) return console.error(`Item ${id} already exists.`);
  const item = {
    id,
    name: args.name,
    category: args.category || 'other',
    last_replaced: args['last-replaced'] || null,
    lifespan_years: Number(args.lifespan),
    replacement_cost: Number(args.cost),
    notes: args.notes || '',
    history: [],
  };
  if (item.last_replaced) {
    item.history.push({ date: item.last_replaced, type: 'install', cost: item.replacement_cost, notes: 'Initial install date' });
  }
  data.items.push(item);
  save(data);
  console.log(`Added ${id}`);
}

function cmdFlag(args) {
  const id = args._[0];
  if (!id) return console.error('Usage: flag <id> --hoa true|false');
  const data = load();
  if (!data) return console.error('No data file. Run init first.');
  const item = data.items.find(i => i.id === id);
  if (!item) return console.error(`No item with id ${id}.`);
  if (args.hoa !== undefined) {
    item.hoa_covered = args.hoa === 'true' || args.hoa === true;
  }
  save(data);
  console.log(`${id}: hoa_covered=${item.hoa_covered}`);
}

function cmdUpdate(args) {
  const id = args._[0];
  if (!id) return console.error('Usage: update <id> --type replace|repair|install --date YYYY-MM-DD [--cost N] [--notes "..."]');
  const data = load();
  if (!data) return console.error('No data file. Run init first.');
  const item = data.items.find(i => i.id === id);
  if (!item) return console.error(`No item with id ${id}.`);
  const type = args.type || 'replace';
  const date = args.date || today();
  const cost = args.cost ? Number(args.cost) : null;
  const entry = { date, type, cost, notes: args.notes || '' };
  item.history.push(entry);
  if (type === 'replace' || type === 'install') {
    item.last_replaced = date;
    if (cost) item.replacement_cost = cost;
  }
  save(data);
  console.log(`Updated ${id}: ${type} on ${date}${cost ? ' for ' + fmtMoney(cost) : ''}`);
}

function computeStatus(data, ref = new Date()) {
  const rows = [];
  let totalTarget = 0;
  let totalAnnual = 0;
  for (const it of data.items) {
    if (!it.last_replaced) continue; // skip un-tracked items
    if (it.hoa_covered) continue; // skip HOA-covered items from sinking fund math
    const yearsUsed = Math.min(yearsBetween(it.last_replaced, ref), it.lifespan_years);
    const annual = it.replacement_cost / it.lifespan_years;
    const target = annual * yearsUsed;
    totalTarget += target;
    totalAnnual += annual;
    rows.push({ ...it, yearsUsed, annual, target });
  }
  return { rows, totalTarget, totalAnnual };
}

function cmdStatus() {
  const data = load();
  if (!data) return console.error('No data file. Run init first.');
  const { rows, totalTarget, totalAnnual } = computeStatus(data);
  rows.sort((a, b) => b.target - a.target);
  console.log('\n=== HOME MAINTENANCE SINKING FUND STATUS ===');
  console.log(`As of ${today()}\n`);
  console.log('Item'.padEnd(34) + 'Age'.padStart(7) + 'Life'.padStart(7) + 'Cost'.padStart(11) + 'Annual'.padStart(11) + 'Target Saved'.padStart(15));
  console.log('-'.repeat(85));
  for (const r of rows) {
    console.log(
      r.name.padEnd(34) +
      `${r.yearsUsed.toFixed(1)}y`.padStart(7) +
      `${r.lifespan_years}y`.padStart(7) +
      fmtMoney(r.replacement_cost).padStart(11) +
      fmtMoney(r.annual).padStart(11) +
      fmtMoney(r.target).padStart(15)
    );
  }
  console.log('-'.repeat(85));
  console.log(`TOTAL annual accrual: ${fmtMoney(totalAnnual)}/yr`);
  console.log(`TOTAL sinking fund target right now: ${fmtMoney(totalTarget)}`);
  console.log(`Per-paycheck (weekly, 52/yr): ${fmtMoney(totalAnnual / 52)}`);
  console.log(`Per-month: ${fmtMoney(totalAnnual / 12)}`);
  if (data.home && data.home.value) {
    const pct = (totalAnnual / data.home.value) * 100;
    console.log(`Annual accrual is ${pct.toFixed(2)}% of home value (${fmtMoney(data.home.value)}).`);
  }
}

function cmdBreakdown() {
  const data = load();
  if (!data) return console.error('No data file. Run init first.');
  const { rows, totalTarget } = computeStatus(data);
  rows.sort((a, b) => b.target - a.target);
  let totalGoal = 0;
  for (const r of rows) totalGoal += r.replacement_cost;
  console.log('\n=== HOME MAINTENANCE SAVED-TOWARD vs GOAL ===');
  console.log(`As of ${today()}\n`);
  console.log('Item'.padEnd(42) + 'Saved'.padStart(10) + ' / ' + 'Goal'.padEnd(10) + '   Progress');
  console.log('-'.repeat(95));
  for (const r of rows) {
    const pct = r.target / r.replacement_cost;
    const bar = Math.round(pct * 20);
    const visual = '[' + '█'.repeat(Math.min(bar, 20)) + '░'.repeat(Math.max(0, 20 - bar)) + ']';
    console.log(
      r.name.padEnd(42) +
      fmtMoney(r.target).padStart(10) +
      ' / ' +
      fmtMoney(r.replacement_cost).padEnd(10) +
      ' ' + visual + ' ' + (pct * 100).toFixed(0) + '%'
    );
  }
  console.log('-'.repeat(95));
  console.log('TOTALS'.padEnd(42) + fmtMoney(totalTarget).padStart(10) + ' / ' + fmtMoney(totalGoal).padEnd(10));
  console.log(`\nSaved-toward = ${fmtMoney(totalTarget)} (${(totalTarget/totalGoal*100).toFixed(1)}% of full replacement cost across all tracked items)`);
}

function cmdUpcoming(args) {
  const data = load();
  if (!data) return console.error('No data file. Run init first.');
  const years = Number(args.years || 3);
  const ref = new Date();
  const cutoff = new Date(ref.getTime() + years * 365.25 * 24 * 3600 * 1000);
  const upcoming = [];
  for (const it of data.items) {
    if (!it.last_replaced) continue;
    const dueDate = new Date(it.last_replaced);
    dueDate.setFullYear(dueDate.getFullYear() + it.lifespan_years);
    if (dueDate <= cutoff) {
      upcoming.push({ ...it, dueDate });
    }
  }
  upcoming.sort((a, b) => a.dueDate - b.dueDate);
  const inflation = data.home && data.home.inflation_rate !== undefined ? data.home.inflation_rate : 0.03;
  console.log(`\n=== UPCOMING REPAIRS / REPLACEMENTS (next ${years} years) ===`);
  console.log(`Inflation assumed: ${(inflation*100).toFixed(1)}%/yr\n`);
  if (upcoming.length === 0) {
    console.log('Nothing due in this window. Nice.');
    return;
  }
  let totalToday = 0, totalFuture = 0;
  for (const u of upcoming) {
    const due = u.dueDate.toISOString().slice(0, 10);
    const overdue = u.dueDate < ref ? ' (OVERDUE)' : '';
    const future = inflatedCost(u, ref, inflation);
    console.log(`${due}  ${u.name.padEnd(34)} ${fmtMoney(u.replacement_cost).padStart(8)} → ${fmtMoney(future).padStart(8)}${overdue}`);
    totalToday += u.replacement_cost;
    totalFuture += future;
  }
  console.log('-'.repeat(80));
  console.log(`Total in today's \$: ${fmtMoney(totalToday)}  →  Inflation-adjusted: ${fmtMoney(totalFuture)}`);
}

function cmdCatchup(args) {
  const data = load();
  if (!data) return console.error('No data file. Run init first.');
  const horizonYears = Number(args.horizon || 5);
  const hysaRate = Number(args['hysa-rate'] || 0.03);
  const growthRate = Number(args['growth-rate'] || 0.07);
  const inflation = Number(args.inflation !== undefined ? args.inflation : (data.home && data.home.inflation_rate !== undefined ? data.home.inflation_rate : 0.03));
  const ref = new Date();
  const cutoff = new Date(ref.getTime() + horizonYears * 365.25 * 24 * 3600 * 1000);

  const shortTerm = [];
  const longTerm = [];
  for (const it of data.items) {
    if (!it.last_replaced || it.hoa_covered) continue;
    const dueDate = new Date(it.last_replaced);
    dueDate.setFullYear(dueDate.getFullYear() + it.lifespan_years);
    const futureCost = inflatedCost(it, ref, inflation);
    const item = { ...it, dueDate, futureCost };
    if (dueDate <= cutoff) shortTerm.push(item);
    else longTerm.push(item);
  }
  shortTerm.sort((a, b) => a.dueDate - b.dueDate);
  longTerm.sort((a, b) => a.dueDate - b.dueDate);

  // Short-term: how much weekly to a HYSA gets us to total cost by latest due date in window?
  const shortTotal = shortTerm.reduce((s, i) => s + i.futureCost, 0);
  const shortTodayDollars = shortTerm.reduce((s, i) => s + i.replacement_cost, 0);
  const latestDue = shortTerm.length ? shortTerm[shortTerm.length - 1].dueDate : ref;
  const weeksToLatest = Math.max(1, Math.ceil((latestDue - ref) / (7 * 24 * 3600 * 1000)));
  const wkRate = hysaRate / 52;
  const shortWeeklyHYSA = wkRate > 0 ? shortTotal * wkRate / (Math.pow(1 + wkRate, weeksToLatest) - 1) : shortTotal / weeksToLatest;
  const shortWeeklyNoGrowth = shortTotal / weeksToLatest;

  // Long-term: ongoing annual depreciation
  const longAnnual = longTerm.reduce((s, i) => s + i.replacement_cost / i.lifespan_years, 0);
  // With growth, weekly contribution can be lower. Approx using avg years-to-due.
  const longAvgYears = longTerm.length ? longTerm.reduce((s, i) => {
    const yrs = (i.dueDate - ref) / (365.25 * 24 * 3600 * 1000);
    return s + yrs;
  }, 0) / longTerm.length : 0;
  // Discount factor: PV of future obligation at growth rate
  const longTotalGoal = longTerm.reduce((s, i) => s + i.futureCost, 0);
  const longTodayDollars = longTerm.reduce((s, i) => s + i.replacement_cost, 0);
  const longCurrentSaved = longTerm.reduce((s, i) => {
    const yrsUsed = Math.min((ref - new Date(i.last_replaced)) / (365.25 * 24 * 3600 * 1000), i.lifespan_years);
    return s + (yrsUsed / i.lifespan_years) * i.replacement_cost;
  }, 0);
  const longGap = longTotalGoal - longCurrentSaved;
  // Time-weighted weekly to close the gap by avg due date with growth
  const yrsAvg = Math.max(1, longAvgYears);
  const wksAvg = yrsAvg * 52;
  const wkGrowth = growthRate / 52;
  const longWeeklyInvested = wkGrowth > 0 ? longGap * wkGrowth / (Math.pow(1 + wkGrowth, wksAvg) - 1) : longGap / wksAvg;
  const longWeeklyHYSA = wkRate > 0 ? longGap * wkRate / (Math.pow(1 + wkRate, wksAvg) - 1) : longGap / wksAvg;

  console.log(`\n=== TWO-BUCKET CATCH-UP PLAN ===`);
  console.log(`As of ${today()}\n`);
  console.log(`Split horizon: ${horizonYears}y  |  HYSA: ${(hysaRate*100).toFixed(1)}%  |  Growth: ${(growthRate*100).toFixed(1)}%  |  Inflation: ${(inflation*100).toFixed(1)}%\n`);

  console.log(`--- SHORT-TERM BUCKET (HYSA) ---`);
  console.log(`Items due within ${horizonYears} years (today's $ → inflated future $):`);
  for (const i of shortTerm) {
    const due = i.dueDate.toISOString().slice(0, 10);
    const overdue = i.dueDate < ref ? ' (OVERDUE)' : '';
    console.log(`  ${due}  ${i.name.padEnd(38)} ${fmtMoney(i.replacement_cost).padStart(8)} → ${fmtMoney(i.futureCost).padStart(8)}${overdue}`);
  }
  console.log(`  Today's-\$ total: ${fmtMoney(shortTodayDollars)}`);
  console.log(`  Inflation-adjusted goal: ${fmtMoney(shortTotal)}`);
  console.log(`  Latest deadline: ${latestDue.toISOString().slice(0,10)} (${weeksToLatest} weeks away)`);
  console.log(`  Weekly to HYSA @ ${(hysaRate*100).toFixed(1)}%: ${fmtMoney(shortWeeklyHYSA)}/wk`);
  console.log(`  Weekly with no interest: ${fmtMoney(shortWeeklyNoGrowth)}/wk`);

  console.log(`\n--- LONG-TERM BUCKET (Investment / Brokerage) ---`);
  console.log(`Items due ${horizonYears}+ years out (${longTerm.length} items, avg ${longAvgYears.toFixed(1)} yrs to due):`);
  console.log(`  Today's-\$ replacement value: ${fmtMoney(longTodayDollars)}`);
  console.log(`  Inflation-adjusted future cost: ${fmtMoney(longTotalGoal)}`);
  console.log(`  Currently "banked" (depreciation accrual, today's \$): ${fmtMoney(longCurrentSaved)}`);
  console.log(`  Gap to fund: ${fmtMoney(longGap)}`);
  console.log(`  Annual depreciation rate: ${fmtMoney(longAnnual)}/yr`);
  console.log(`  Weekly to brokerage @ ${(growthRate*100).toFixed(1)}%: ${fmtMoney(longWeeklyInvested)}/wk`);
  console.log(`  Weekly to HYSA @ ${(hysaRate*100).toFixed(1)}%: ${fmtMoney(longWeeklyHYSA)}/wk (slower growth)`);

  console.log(`\n--- COMBINED (parallel mode) ---`);
  const totalWeekly = shortWeeklyHYSA + longWeeklyInvested;
  console.log(`  Short-term HYSA: ${fmtMoney(shortWeeklyHYSA)}/wk`);
  console.log(`  Long-term invested: ${fmtMoney(longWeeklyInvested)}/wk`);
  console.log(`  TOTAL: ${fmtMoney(totalWeekly)}/wk (${fmtMoney(totalWeekly * 52 / 12)}/mo)`);

  // Delayed-brokerage mode: HYSA only until phase 1 deadline, then redirect to brokerage
  const phase1Weekly = shortWeeklyHYSA;
  const phase1Weeks = weeksToLatest;
  const phase2WeeksAvailable = Math.max(1, longAvgYears * 52 - phase1Weeks);
  const phase2YearsAvailable = phase2WeeksAvailable / 52;
  const phase2GrowthFactor = Math.pow(1 + wkGrowth, phase2WeeksAvailable);
  const phase2AnnuityFactor = (phase2GrowthFactor - 1) / wkGrowth;
  const phase2WeeklyNeeded = longGap / phase2AnnuityFactor;
  const phase2WithSameWeekly = phase1Weekly * phase2AnnuityFactor;
  const overshoot = phase2WithSameWeekly - longGap;
  const weeksToHitGoal = wkGrowth > 0
    ? Math.log(1 + (longGap * wkGrowth) / phase1Weekly) / Math.log(1 + wkGrowth)
    : longGap / phase1Weekly;
  const yearsToHitGoal = weeksToHitGoal / 52;

  console.log(`\n--- DELAYED-BROKERAGE MODE ---`);
  console.log(`(All ${fmtMoney(phase1Weekly)}/wk goes to HYSA until phase-1 deadline, then redirects to brokerage)`);
  console.log(`  Phase 1: ${fmtMoney(phase1Weekly)}/wk → HYSA for ${phase1Weeks} weeks (${(phase1Weeks/52).toFixed(1)} yrs)`);
  console.log(`           Funds: ${fmtMoney(shortTotal)} (short-term goal hit)`);
  console.log(`  Phase 2: ${fmtMoney(phase1Weekly)}/wk → Brokerage for up to ${phase2YearsAvailable.toFixed(1)} yrs (until avg long-term due)`);
  console.log(`           Goal: ${fmtMoney(longGap)} | Needed weekly: ${fmtMoney(phase2WeeklyNeeded)}/wk`);
  console.log(`           Same ${fmtMoney(phase1Weekly)}/wk grows to ${fmtMoney(phase2WithSameWeekly)} → overshoot ${fmtMoney(overshoot)}`);
  console.log(`           Goal hit in ~${yearsToHitGoal.toFixed(1)} yrs (instead of ${phase2YearsAvailable.toFixed(1)})`);
  console.log(`           After goal hit: stop, step down to maintenance, or redirect to other goals`);
}

function buildReportHTML(data, opts = {}) {
  const ref = new Date();
  const hysaRate = opts.hysaRate || 0.03;
  const growthRate = opts.growthRate || 0.07;
  const horizonYears = opts.horizon || 5;
  const inflation = opts.inflation !== undefined ? opts.inflation : (data.home && data.home.inflation_rate !== undefined ? data.home.inflation_rate : 0.03);
  const cutoff = new Date(ref.getTime() + horizonYears * 365.25 * 24 * 3600 * 1000);

  const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
  const dateOf = d => d.toISOString().slice(0, 10);

  // Build status rows
  const allRows = [];
  let totalTarget = 0, totalAnnual = 0, totalGoal = 0;
  for (const it of data.items) {
    if (!it.last_replaced || it.hoa_covered) continue;
    const yearsUsed = Math.min(yearsBetween(it.last_replaced, ref), it.lifespan_years);
    const annual = it.replacement_cost / it.lifespan_years;
    const target = annual * yearsUsed;
    const dueDate = new Date(it.last_replaced);
    dueDate.setFullYear(dueDate.getFullYear() + it.lifespan_years);
    const futureCost = inflatedCost(it, ref, inflation);
    totalTarget += target;
    totalAnnual += annual;
    totalGoal += it.replacement_cost;
    allRows.push({ ...it, yearsUsed, annual, target, dueDate, futureCost, pct: target / it.replacement_cost });
  }
  allRows.sort((a, b) => b.target - a.target);

  // Two-bucket split
  const shortTerm = allRows.filter(r => r.dueDate <= cutoff).sort((a, b) => a.dueDate - b.dueDate);
  const longTerm = allRows.filter(r => r.dueDate > cutoff).sort((a, b) => a.dueDate - b.dueDate);
  const shortTotalToday = shortTerm.reduce((s, i) => s + i.replacement_cost, 0);
  const shortTotal = shortTerm.reduce((s, i) => s + i.futureCost, 0);
  const latestDue = shortTerm.length ? shortTerm[shortTerm.length - 1].dueDate : ref;
  const weeksToLatest = Math.max(1, Math.ceil((latestDue - ref) / (7 * 24 * 3600 * 1000)));
  const wkRate = hysaRate / 52;
  const shortWeeklyHYSA = wkRate > 0 ? shortTotal * wkRate / (Math.pow(1 + wkRate, weeksToLatest) - 1) : shortTotal / weeksToLatest;

  const longTotalToday = longTerm.reduce((s, i) => s + i.replacement_cost, 0);
  const longTotalGoal = longTerm.reduce((s, i) => s + i.futureCost, 0);
  const longCurrentSaved = longTerm.reduce((s, i) => s + i.target, 0);
  const longGap = longTotalGoal - longCurrentSaved;
  const longAvgYears = longTerm.length ? longTerm.reduce((s, i) => s + (i.dueDate - ref) / (365.25 * 24 * 3600 * 1000), 0) / longTerm.length : 0;
  const wksAvg = longAvgYears * 52;
  const wkGrowth = growthRate / 52;
  const growthFactor = Math.pow(1 + wkGrowth, wksAvg);
  const annuityFactor = (growthFactor - 1) / wkGrowth;
  const longWeeklyInvested = longGap / annuityFactor;

  // Seed table
  const seedRows = [];
  for (const seed of [0, 1000, 2000, 3000, 4000, 5000]) {
    const seedGrowth = seed * growthFactor;
    const remaining = longGap - seedGrowth;
    const weekly = remaining / annuityFactor;
    seedRows.push({ seed, weekly, total: weekly + shortWeeklyHYSA });
  }

  const homeValue = data.home && data.home.value ? data.home.value : null;
  const annualPct = homeValue ? (totalAnnual / homeValue) * 100 : null;

  const itemRow = r => `
    <tr>
      <td>${r.name}</td>
      <td class="num">${r.yearsUsed.toFixed(1)}y</td>
      <td class="num">${r.lifespan_years}y</td>
      <td class="num">${fmt(r.replacement_cost)}</td>
      <td class="num">${fmt(r.target)}</td>
      <td class="num">${(r.pct * 100).toFixed(0)}%</td>
      <td><div class="bar"><div class="bar-fill" style="width:${Math.min(100, r.pct * 100)}%"></div></div></td>
    </tr>`;

  const upcomingRow = r => {
    const due = dateOf(r.dueDate);
    const overdue = r.dueDate < ref;
    return `<tr><td>${due}${overdue ? ' <span class="tag-overdue">OVERDUE</span>' : ''}</td><td>${r.name}</td><td class="num">${fmt(r.replacement_cost)}</td></tr>`;
  };

  const seedRow = s => `
    <tr${s.seed === 3000 ? ' class="highlight"' : ''}>
      <td class="num">${fmt(s.seed)}</td>
      <td class="num">${fmt(s.weekly)}/wk</td>
      <td class="num">${fmt(s.weekly * 52 / 12)}/mo</td>
      <td class="num">${fmt(s.total)}/wk</td>
      <td class="num">${fmt(s.total * 52 / 12)}/mo</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Home Sinking Fund Plan — ${dateOf(ref)}</title>
<style>
  :root {
    --bg: #ffffff;
    --fg: #1a1a1a;
    --muted: #666;
    --border: #e0e0e0;
    --accent: #2563eb;
    --good: #059669;
    --warn: #d97706;
    --bad: #dc2626;
    --bar-bg: #f3f4f6;
    --bar-fill: #2563eb;
    --highlight: #fef3c7;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: var(--bg);
    color: var(--fg);
    line-height: 1.55;
    max-width: 920px;
    margin: 0 auto;
    padding: 40px 32px;
    font-size: 14px;
  }
  h1 { font-size: 28px; margin: 0 0 4px 0; font-weight: 700; }
  h2 { font-size: 20px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--border); font-weight: 600; }
  h3 { font-size: 16px; margin: 20px 0 8px; font-weight: 600; }
  .subtitle { color: var(--muted); margin: 0 0 24px; }
  .meta { font-size: 12px; color: var(--muted); }
  .headline {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin: 16px 0 8px;
  }
  .stat {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    background: #fafafa;
  }
  .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 4px; }
  .stat-value { font-size: 22px; font-weight: 700; color: var(--fg); }
  .stat-value.accent { color: var(--accent); }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { font-weight: 600; background: #fafafa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted); }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.highlight { background: var(--highlight); }
  tr:hover { background: #f9fafb; }
  .bar { width: 100%; height: 8px; background: var(--bar-bg); border-radius: 4px; overflow: hidden; min-width: 80px; }
  .bar-fill { height: 100%; background: var(--bar-fill); border-radius: 4px; }
  .tag-overdue { background: var(--bad); color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; margin-left: 4px; }
  .bucket { border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; }
  .bucket.short { border-left: 4px solid var(--accent); }
  .bucket.long { border-left: 4px solid var(--good); }
  .bucket-title { font-weight: 600; margin-bottom: 8px; font-size: 16px; }
  .key-insight { background: #eff6ff; border-left: 3px solid var(--accent); padding: 12px 16px; margin: 12px 0; border-radius: 4px; }
  .key-insight strong { color: var(--accent); }
  .small { font-size: 12px; color: var(--muted); }
  ul { margin: 8px 0; padding-left: 22px; }
  li { margin: 4px 0; }
  code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); }
  @media print {
    body { padding: 24px; max-width: 100%; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: avoid; }
    .bucket { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<h1>Home Sinking Fund Plan</h1>
<p class="subtitle">${data.home && data.home.notes ? data.home.notes : 'Home maintenance reserve'} ${homeValue ? '— estimated value ' + fmt(homeValue) : ''}</p>
<p class="meta">Generated ${dateOf(ref)} &nbsp;|&nbsp; HOA covers exterior items (roof, siding, paint, foundation, driveway, fence, patio)</p>

<h2>Headlines</h2>
<div class="headline">
  <div class="stat"><div class="stat-label">Sinking Fund Target Now</div><div class="stat-value accent">${fmt(totalTarget)}</div></div>
  <div class="stat"><div class="stat-label">Total Weekly</div><div class="stat-value">${fmt(shortWeeklyHYSA + longWeeklyInvested)}</div></div>
  <div class="stat"><div class="stat-label">Monthly</div><div class="stat-value">${fmt((shortWeeklyHYSA + longWeeklyInvested) * 52 / 12)}</div></div>
  <div class="stat"><div class="stat-label">% of Home Value</div><div class="stat-value">${annualPct ? annualPct.toFixed(2) + '%' : '—'}</div></div>
</div>
<p class="small">The "$${Math.round(totalTarget).toLocaleString()} target" represents lifespan-based depreciation accrual: <code>(years_used / lifespan) × replacement_cost</code> summed across ${allRows.length} tracked items.</p>

<h2>Two-Bucket Strategy</h2>

<div class="bucket short">
  <div class="bucket-title">Bucket 1 — Short-Term HYSA &nbsp;&nbsp;<span class="small">@ ${(hysaRate * 100).toFixed(1)}% APY</span></div>
  <p>Items due within ${horizonYears} years. Money stays liquid for the June 2028 spend.</p>
  <table>
    <thead><tr><th>Due</th><th>Item</th><th class="num">Cost</th></tr></thead>
    <tbody>${shortTerm.map(upcomingRow).join('')}</tbody>
    <tfoot><tr><td colspan="2"><strong>Total goal</strong></td><td class="num"><strong>${fmt(shortTotal)}</strong></td></tr></tfoot>
  </table>
  <p><strong>Weekly contribution: ${fmt(shortWeeklyHYSA)}/wk</strong> &nbsp;|&nbsp; ${weeksToLatest} weeks until ${dateOf(latestDue)}</p>
</div>

<div class="bucket long">
  <div class="bucket-title">Bucket 2 — Long-Term Brokerage &nbsp;&nbsp;<span class="small">@ ${(growthRate * 100).toFixed(1)}% growth</span></div>
  <p>${longTerm.length} items due 5+ years out (avg ${longAvgYears.toFixed(1)} yrs). Invested for growth.</p>
  <ul>
    <li>Total replacement value: <strong>${fmt(longTotalGoal)}</strong></li>
    <li>Already accrued (notional depreciation): ${fmt(longCurrentSaved)}</li>
    <li>Gap to fund: ${fmt(longGap)}</li>
    <li>Annual depreciation: ${fmt(longTerm.reduce((s, i) => s + i.annual, 0))}/yr</li>
  </ul>
  <p><strong>Weekly contribution: ${fmt(longWeeklyInvested)}/wk</strong></p>
  <div class="key-insight">
    <strong>Why this bucket is portable:</strong> If you sell the townhome, this becomes the seed for the next home's sinking fund — or reallocates to any other goal. It's flexible long-term wealth that happens to currently be allocated to townhome maintenance.
  </div>
</div>

<h2>Combined Weekly: ${fmt(shortWeeklyHYSA + longWeeklyInvested)}/wk (${fmt((shortWeeklyHYSA + longWeeklyInvested) * 52 / 12)}/mo)</h2>

<h2>Seed Analysis — Long-Term Bucket</h2>
<p>If you lump-sum a starter contribution into the brokerage account, weekly load drops because of compounding. Each $1 seeded today grows to <strong>$${growthFactor.toFixed(2)}</strong> over ${longAvgYears.toFixed(1)} years at ${(growthRate * 100).toFixed(0)}%.</p>
<table>
  <thead>
    <tr>
      <th class="num">Seed</th>
      <th class="num">Long-term Weekly</th>
      <th class="num">Long-term Monthly</th>
      <th class="num">Combined Weekly</th>
      <th class="num">Combined Monthly</th>
    </tr>
  </thead>
  <tbody>${seedRows.map(seedRow).join('')}</tbody>
</table>
<p class="small"><strong>Recommended sweet spot:</strong> $3,000 seed → drops weekly load by ~$8/wk for the rest of the timeline.</p>

<h2>5-Year Upcoming Spend</h2>
<table>
  <thead><tr><th>Due</th><th>Item</th><th class="num">Cost</th></tr></thead>
  <tbody>${shortTerm.map(upcomingRow).join('')}</tbody>
  <tfoot><tr><td colspan="2"><strong>Total in window</strong></td><td class="num"><strong>${fmt(shortTotal)}</strong></td></tr></tfoot>
</table>

<h2>Per-Item Detail</h2>
<table>
  <thead>
    <tr>
      <th>Item</th>
      <th class="num">Age</th>
      <th class="num">Lifespan</th>
      <th class="num">Cost</th>
      <th class="num">Saved</th>
      <th class="num">%</th>
      <th>Progress</th>
    </tr>
  </thead>
  <tbody>${allRows.map(itemRow).join('')}</tbody>
  <tfoot>
    <tr>
      <td colspan="3"><strong>Totals</strong></td>
      <td class="num"><strong>${fmt(totalGoal)}</strong></td>
      <td class="num"><strong>${fmt(totalTarget)}</strong></td>
      <td class="num"><strong>${(totalTarget / totalGoal * 100).toFixed(0)}%</strong></td>
      <td></td>
    </tr>
  </tfoot>
</table>

<h2>Account Setup</h2>
<table>
  <thead><tr><th>Account</th><th>Auto-Transfer</th><th>Purpose</th></tr></thead>
  <tbody>
    <tr><td>HYSA (Marcus / Ally / SoFi)</td><td class="num">${fmt(shortWeeklyHYSA)}/wk</td><td>Locked-purpose, liquid for June 2028 spend</td></tr>
    <tr><td>Brokerage (Fidelity / Schwab) → broad index (VTI/VOO)</td><td class="num">${fmt(longWeeklyInvested)}/wk</td><td>Long-term, growth, portable</td></tr>
  </tbody>
</table>

<div class="footer">
  Generated by home-repair-funds skill &nbsp;|&nbsp; <code>node .claude/skills/home-repair-funds/scripts/home.js report</code><br>
  Data file: <code>.claude/skills/home-repair-funds/data/home-inventory.json</code>
</div>

</body>
</html>`;
}

function cmdReport(args) {
  const data = load();
  if (!data) return console.error('No data file. Run init first.');
  const outDir = args.dir || path.join(os.homedir(), 'home-sinking-fund-reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const date = today();
  const htmlPath = path.join(outDir, `home-sinking-fund-${date}.html`);
  const pdfPath = path.join(outDir, `home-sinking-fund-${date}.pdf`);
  const html = buildReportHTML(data, {
    hysaRate: Number(args['hysa-rate'] || 0.03),
    growthRate: Number(args['growth-rate'] || 0.07),
    horizon: Number(args.horizon || 5),
    inflation: args.inflation !== undefined ? Number(args.inflation) : undefined,
  });
  fs.writeFileSync(htmlPath, html);
  console.log(`HTML: ${htmlPath}`);

  // Try Chrome headless for PDF
  if (!args['no-pdf']) {
    const { execSync } = require('child_process');
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
    const chrome = chromePaths.find(p => fs.existsSync(p));
    if (chrome) {
      try {
        execSync(`"${chrome}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "file://${htmlPath}"`, { stdio: 'pipe' });
        console.log(`PDF:  ${pdfPath}`);
      } catch (e) {
        console.log(`PDF generation failed: ${e.message}`);
        console.log('You can open the HTML in a browser and File > Print > Save as PDF.');
      }
    } else {
      console.log('Chrome not found. Open the HTML in a browser and File > Print > Save as PDF.');
    }
  }
}

// === Dispatch ===

function main() {
  const [, , cmd, ...rest] = process.argv;
  const args = parseArgs(rest);
  switch (cmd) {
    case 'init': return cmdInit(args);
    case 'set-home': return cmdSetHome(args);
    case 'list': return cmdList();
    case 'add': return cmdAdd(args);
    case 'update': return cmdUpdate(args);
    case 'flag': return cmdFlag(args);
    case 'status': return cmdStatus();
    case 'breakdown': return cmdBreakdown();
    case 'catchup': return cmdCatchup(args);
    case 'upcoming': return cmdUpcoming(args);
    case 'report': return cmdReport(args);
    default:
      console.error('Usage: home.js <init|set-home|list|add|update|status|upcoming> [args]');
      process.exit(1);
  }
}

main();
