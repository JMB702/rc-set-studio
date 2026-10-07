// Regenerates public/data/home-depot-shopping-list.txt from public/data/flat-shopping-list.json,
// so the printable list can never drift from the quantities and prices the site shows.
//   node scripts/sync-shopping-list.mjs          write the file
//   node scripts/sync-shopping-list.mjs --check  exit 1 if the file is stale (used by `npm run check`)
import {pathToFileURL} from 'node:url';
import {readFile, writeFile} from 'node:fs/promises';
import {calculate} from '../public/shopping-calc.js';

const JSON_PATH = 'public/data/flat-shopping-list.json';
const TXT_PATH = 'public/data/home-depot-shopping-list.txt';
const SECTIONS = [
  ['8x4', '8x4 / ONE PANEL + TWO JACKS + SHELF + PROVISIONAL BALLAST'],
  ['10x4', '10x4 / ONE PANEL + TWO JACKS + SHELF / BALLAST PENDING'],
];
const money = cents => '$' + (cents / 100).toFixed(2);

export function render(data) {
  const out = [
    'RC SET / HOME DEPOT SHOPPING LIST',
    `Store #${data.store.id} - ${data.store.address.replace(/, (\w\w) (\d{5})$/, ' $1 $2')}`,
    `Base product prices checked ${data.checkedDate}; see per-product notes for later checks.`,
    '',
  ];
  for (const [key, title] of SECTIONS) {
    const rows = calculate(data, key, 1, true, true);
    out.push(title);
    for (const r of rows) out.push(`${r.purchaseQuantity} x ${r.name} @ ${money(r.unitPriceCents)} = ${money(r.subtotalCents)}`, `  ${r.availability}`, `  ${r.productUrl}`);
    out.push(`SUBTOTAL ${money(rows.reduce((sum, r) => sum + r.subtotalCents, 0))}`, '');
  }
  out.push(data.notes.join('\n\n'), '');
  return out.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = render(JSON.parse(await readFile(JSON_PATH, 'utf8')));
  if (process.argv.includes('--check')) {
    const current = await readFile(TXT_PATH, 'utf8');
    if (current !== next) {
      console.error(`${TXT_PATH} is out of date with ${JSON_PATH}. Run: npm run sync:shopping`);
      process.exit(1);
    }
    console.log('Printable shopping list is in sync.');
  } else {
    await writeFile(TXT_PATH, next);
    console.log(`Wrote ${TXT_PATH}`);
  }
}
