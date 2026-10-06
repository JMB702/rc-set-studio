// Prints the Pricing guide subtotal for every standard configuration, so a change to the set
// can be reported as a before/after diff in the pull request.
//   npm run quote               current numbers
//   npm run quote -- --angle 60 use a different wing angle (default 45)
import {readFile} from 'node:fs/promises';
import {priceRows, summary, money} from '../public/pricing-calc.js';
import {laborEstimate} from '../public/labor.js';

const data = JSON.parse(await readFile('public/data/flat-shopping-list.json', 'utf8'));
const angleArg = process.argv.indexOf('--angle');
const angle = angleArg > -1 ? Number(process.argv[angleArg + 1]) : 45;
const platformArg = process.argv.indexOf('--platform-angle');
const platformAngle = platformArg > -1 ? Math.max(angle, Number(process.argv[platformArg + 1])) : angle;

const lines = [`Pricing guide subtotals at ${angle}° wings, prices checked ${data.checkedDate} (platform items ${data.platform.products[0].checkedDate}), platform gaps 12″, angled platform at ${platformAngle}° (before tax and delivery)`, ''];
// The design a first visit opens with (public/design.js defaultDesign): 10×4 at 45°, square platform, painted floor.
{
  const rows = priceRows(data, {scope: 'set', height: 120, angle: 45, floor: 'charcoal', platformShape: 'square'});
  const {subtotal, pending} = summary(rows);
  const labor = laborEstimate({height: 120, angle: 45, floor: 'charcoal', platformShape: 'square', platformAngle: 90});
  lines.push(`Default design, full set ${money(subtotal).padStart(11)}  ${rows.length} lines, ${pending} priced pending, labor ${labor.personHours} person-hours (${labor.hours} hrs for 2)`, '');
}
for (const height of [96, 120]) {
  for (const scope of ['panel', 'set', 'floor']) {
    // Floor and platform are independent design choices: [floor, platform shape].
    const designs = scope === 'panel' ? [['wood', 'none']] : [['wood', 'none'], ['charcoal', 'none'], ['none', 'angled'], ['none', 'square'], ['wood', 'square']];
    for (const [floor, platformShape] of designs) {
      const rows = priceRows(data, {scope, height, angle, floor, platformShape, platformAngle});
      const {subtotal, pending} = summary(rows);
      const design = platformShape === 'none' ? floor : floor === 'none' ? `${platformShape} platform` : `${floor} + ${platformShape}`;
      const label = `${height / 12}x4  ${scope.padEnd(5)} ${scope === 'panel' ? ''.padEnd(16) : design.padEnd(16)}`;
      const labor = scope === 'set' ? laborEstimate({height, angle, floor, platformShape, platformAngle: platformShape === 'square' ? 90 : platformAngle}) : null;
      lines.push(`${label} ${money(subtotal).padStart(11)}  ${String(rows.length).padStart(2)} lines, ${pending} priced pending${labor ? `, labor ${labor.personHours} ph` : ''}`);
    }
  }
}
console.log(lines.join('\n'));
