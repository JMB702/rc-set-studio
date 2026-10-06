// Prints the Pricing guide subtotal for every standard configuration, so a change to the set
// can be reported as a before/after diff in the pull request.
//   npm run quote               current numbers
//   npm run quote -- --angle 60 use a different wing angle (default 45)
import {readFile} from 'node:fs/promises';
import {priceRows, summary, money} from '../public/pricing-calc.js';

const data = JSON.parse(await readFile('public/data/flat-shopping-list.json', 'utf8'));
const angleArg = process.argv.indexOf('--angle');
const angle = angleArg > -1 ? Number(process.argv[angleArg + 1]) : 45;

const lines = [`Pricing guide subtotals at ${angle}° wings, prices checked ${data.checkedDate} (before tax and delivery)`, ''];
for (const height of [96, 120]) {
  for (const scope of ['panel', 'set', 'floor']) {
    for (const floor of scope === 'panel' ? ['wood'] : ['wood', 'charcoal']) {
      const rows = priceRows(data, {scope, height, angle, floor});
      const {subtotal, pending} = summary(rows);
      const label = `${height / 12}x4  ${scope.padEnd(5)} ${scope === 'panel' ? '       ' : floor.padEnd(7)}`;
      lines.push(`${label} ${money(subtotal).padStart(11)}  ${String(rows.length).padStart(2)} lines, ${pending} priced pending`);
    }
  }
}
console.log(lines.join('\n'));
