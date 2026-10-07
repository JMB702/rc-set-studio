---
name: rc-set-sync
description: Load at the start of ANY work on the RC Set Studio repo and before editing public/, worker/, db/ or scripts/. Whenever a change touches the set's geometry, dimensions, panel count or height, lumber, hardware, jacks, ballast, floor, finishes, wall colors or prices, it must also update the Build guide and the Pricing guide in the same pull request, and carry any change in materials through every place materials appear (materials JSON, shopping lists, cut list, step text, design notes, tests).
---

# RC Set sync: one change, every place it lives

RC Set Studio shows one physical set three ways: a **3D model**, a **Build guide** (step-by-step instructions, cut list) and a **Pricing guide** (shopping list and totals). The same facts (lumber sizes, panel counts, screws, floor products, prices) are written down in several files. If you change one and not the others, the site tells people to build one thing and buy another.

## The rule

Every change to the set updates, **in the same pull request**:

1. **The Build guide**: step text, part dimensions, fastener counts, cut list, tools, floor and finish steps.
2. **The Pricing guide**: quantities, products, prices, totals, floor/finish/connection rows.
3. **Everything downstream of a materials change**: if the change needs more or less material (or different material), reflect it across the whole project (map below), not only where you first noticed it.

"This doesn't affect the guides" is a conclusion you reach by checking, and you state it in the pull request. Do not skip the check because a change looks cosmetic.

## Setup (skip if it is already running)

```sh
npm install
npm start          # builds, migrates the local DB, serves http://localhost:8787, rebuilds on every edit
```

Refresh the browser after each edit. `npm start` needs no accounts or keys.

## Where each fact lives

| Fact | Where | Notes |
|---|---|---|
| 3D geometry: stile/rail/jack sizes, screw positions, set layout | `public/model.js` (`design(h)`, `panel()`, `finishedSet()`, `floorMesh()`) | `design(h)` holds the per-height dimensions. Every mesh carries `userData.step`, the build-guide stage that draws it. |
| The design panel: walls (height, angle, color), platform (none/angled/square, side angle, gaps, color), floor (none/oak/painted, color) | `public/design.js` (`installDesign()`), state and rules in `app.js` `configure()` | The only place the set is designed. Explore shows the editor; Build and Pricing show a summary with Edit. The guides read `state` and must not add their own design controls. Floor and platform are independent; the floor runs under any platform. |
| Design approvals: Approve button, approved-designs list, newest approval = site default | `public/approvals.js`, `normalizeDesign()` in `pricing-config.js`, `/api/approvals` in `worker/index.js`, `design_approvals` in `db/schema.ts` | No accounts: the name comes from the comments cookie or the dialog. An approval stores every design setting (`normalizeDesign()` keys) and the reviewed labor/material estimate. Edits use an optimistic revision check and keep the original creation order; earlier approvals do not become the default merely by being edited. The newest one is merged into `defaultDesign` on load and applied unless the visitor already changed the design. Adding a design setting means adding it to `normalizeDesign()` too. |
| Labor estimate: person-hours per task, crew size (default 2), adjustable hours, a rate per person, Total estimate | `public/labor.js` (`laborTasks()`, `laborEstimate()`, `laborCost()`, `mountLabor()`, `costSummary()`); the Labor card and Total estimate in the Pricing guide; the cost gate in the approval dialog (`approvals.js`); dock and print total in `pricing.js` | Tasks follow the design and the Build guide stages, so a step, panel-count, floor or platform change must update `laborTasks()` and `tests/labor.test.mjs`. Hours are planning allowances, not a quote; drying time is not labor. Crew, rates and adjusted hours are per viewer (localStorage `rc_labor`). Approval creation and edits record the reviewed estimate; pricing configurations still do not store labor. A zero hourly rate means already covered; a blank rate means not priced. |
| Camera overlay (Explore only): 16:9 or 9:16 frame, full-frame 14–200 mm focal length | `app.js` (`camApply()`), `#cam-overlay` / `#camera-controls` in `index.html` | A viewing aid; it changes the 3D camera's field of view only in Explore and restores the 38° lens before the guides frame their views. No effect on materials or prices. |
| Scale figures (seated podcast, standing rap at a hung mic) | `public/podcast.js` | Decorative; they hide in the guide. `state.figures` and `state.platform` (deck height in inches, 0 = floor) drive `placeFigures()` in `app.js`; the figures stand on the platform deck when it is in the scene. Clothing colors are `state.clothing[person].shirt/.pants` (people listed in `figurePeople`), edited in `public/clothing.js` and recolored in place by `paintFigures()`. |
| Build guide steps and cut list | `public/guide.js`: `steps(h, floor)`, `cutRows(h)`, `buildPanel()`, `buildSet()`, `materialUI()` | Steps are numbered by **stage**. Stage numbers are hard-coded in `display()` and the other guide functions (for example `st.stage<21`, `[9,12,15,16,17,18,19]`, `>=23 && <=27`, `===28`). Inserting or removing a step means renumbering these and the `userData.step` values in `model.js` and `buildPanel`/`buildSet`. |
| 10″ platform floor: outline, modules, framing, cut list, quantities | `public/platform.js` (`platformPlan()`, `platformCuts()`), meshes in `model.js` (`platformFloor()`, `platformParts()`), steps 30–37 in `guide.js` (`platformSteps()`, `buildPlatform()`), rows in `pricing-calc.js` (`platformRows()`), platform-only products in `flat-shopping-list.json` → `platform.products` | Pure geometry, no imports, so tests use it directly. Quantities follow the wall angle and the two gaps. It reuses the `crossbar`, `skin`, `barScrews`, `staples`, `glue` and `pads` products under new row ids. |
| Quantities, products, prices, per-panel requirements, cuts text | `public/data/flat-shopping-list.json` | The source of truth for the 8×4 and 10×4 panel, jacks, shelf and ballast. `variants.*.panelRequirements/supportRequirements/ballastRequirements` are per **one** panel. `calculate()` in `public/shopping-calc.js` multiplies by panel count and rounds up to whole packs. Never hand-total. |
| Printable shopping list | `public/data/home-depot-shopping-list.txt` | **Generated.** Run `npm run sync:shopping`. A test fails if it is stale. |
| Pricing guide rows | `public/pricing-calc.js`: `priceRows()`, `floorRows()`, `floorArea()` | Floor, trim, primer, paint, seams, corners and 10′ ballast rows are **hard-coded here**, not in the JSON. The full set is 8 panels (`n = scope==='panel' ? 1 : 8`). |
| Pricing guide UI, saved estimates | `public/pricing.js`, `pricing-config.js`, `pricing-review.js`, `pricing-swipe.js` | Saved configurations store product/row ids (`excluded`) in D1. **Never rename an existing id**; add a new one. Saved estimates list removed items by id, so a renamed id makes those items reappear. |
| Design notes shipped to users | `public/assets/design-basis.txt`, `public/assets/sources.txt`, "Before you build" and cut-list text in `public/index.html` | Hand-written. They quote dimensions, screw counts, jack sizes. |
| Home Depot list on the Build tab | `public/shopping-list.js` | Reads the JSON; has descriptive text (ballast weight, glue allowance, "Prices checked Oct 5, 2026"). |
| Allowed heights, floors, angle, step range | `public/index.html` (`data-height`), `public/app.js` (WebMCP tool schemas), `public/pricing-config.js`, `worker/index.js` | Only `96`/`120`; floor `none`/`wood`/`charcoal`; platform shape `none`/`angled`/`square`; 0–90°; platform gaps 0–48″; platform angle ≥ wall angle; step ≤ 40 today. Older saves used floor `platform`, which loads as no floor plus an angled platform. Adding a height or floor means touching all of these plus both guides. |
| Database | `db/schema.ts`, `drizzle/` | Schema change: edit `schema.ts`, `npm run db:generate`, commit the new migration. Migrations are append-only. |
| Test totals | `tests/*.test.mjs` | Update expected numbers when quantities legitimately change. Do not loosen a test to make it pass. |

`pricing-config.js` is inlined into the Worker by `scripts/build.mjs` (it rewrites `export function` to `function`). Keep it to plain `export function` declarations with no imports.

## Known duplicates (reconcile whenever you touch them)

- **Floor laminate price and case size** appear in `guide.js` `materialUI()` ($28.85 per 24.24 sq ft case, "listed online") **and** `pricing-calc.js` `floorRows()` ($23.99 per case, "observed at #6319"). They disagree today. Do not change one silently: update both, or label the difference clearly, and say which you did.
- **Cut lists exist twice**: `variants.*.cuts` in the JSON and `cutRows()` in `guide.js`. Keep the two consistent.
- **"8 panels"** is written in `index.html` (`#panel-count` and "Multiply by 8"), `guide.js` (twice) and `pricing.js`, and as `8` in `pricing-calc.js`. A change to the layout's panel count touches all of them.
- **Dates and store**: "Oct 5, 2026" / "PLANNING EDITION / OCT 2026" / "#6319" are repeated in `guide.js`, `shopping-list.js`, `pricing.js`, `pricing-calc.js`, `index.html`. Only update a date for prices you actually re-checked.

## Workflow

1. **Classify the change.** Which of these does it touch: geometry, steps, quantities, products, prices, floor/finish, panel count/height, layout? Write the list down; it is your checklist.
2. **Baseline.** Run `npm run quote` and keep the output. It prints the Pricing guide subtotal for every standard configuration.
3. **Model first** (`model.js`), so the guide can draw what it describes. Check it in **Explore set**.
4. **Build guide** (`guide.js`): update the affected step text, the part spec string, the fastener counts, `cutRows()`, and the tools list. Keep stage numbers and `userData.step` aligned.
5. **Materials** (`flat-shopping-list.json`): update `panelRequirements`, `supportRequirements`, `ballastRequirements`, `cuts`, and add, change or remove products. Remove a product no longer used (a test fails on orphans). Pricing-only rows go in `pricing-calc.js`.
6. **Pricing guide** (`pricing-calc.js`, `pricing.js`): update the hard-coded floor/finish/connection rows if affected. Both heights, all three scopes (set, panel, floor), both floors.
7. **Prose** (`design-basis.txt`, `sources.txt`, `index.html`, `shopping-list.js` text, `VALIDATION.txt` if step counts changed).
8. **Sweep.** For each value you changed (old and new, in every spelling: `3½″`, `3.5`, `3 1/2`, `46.5`, `46½`, cents like `1532`, `$15.32`), run `git grep -n -- "<old value>"`. Every hit is either updated or a deliberate keep.
9. **Regenerate and check.**
   ```sh
   npm run sync:shopping
   npm run check
   npm run quote       # compare with your baseline
   ```
10. **Look at it** in the running app, desktop and 390px wide: Explore set, every changed Build guide step (8×4 and 10×4, wood and charcoal floor), and the Pricing guide for set, panel and floor scopes. Headless browsers render on demand, so call `window.__studio.invalidate()` before a screenshot. Useful hooks: `__studio.configure({height, angle, floor})`, `__studio.setMode('finished'|'build'|'pricing')`, `__studio.setStep(n)`.
11. **Open the pull request** (below).

## Materials and prices: rules

- **Never invent a price, stock count or product.** A product in the JSON must have a real observed price (a test enforces it, and `calculate()` cannot total a missing one). If you cannot observe a price, do not add it to the JSON: add a pending row in `pricing-calc.js` with `price = null` and say what is unresolved in its note, as the existing floor and trim rows do. The UI then shows "Price pending" and the total excludes it.
- Lumber sizes are **actual**, not nominal. `board14` is a 1×4 whose real size is ¾″ × 3½″.
- A change to the 8×4 does not imply the same change to the 10×4 (it is a separate frame, not a scaled one). Decide each explicitly and say so.
- Jacks, shelf and ballast scale per panel; glue is one bottle per four panels. The full set is 8 panels (4 back, 2 per wing), 5 straight seams, 2 corner connections.
- Quantities in the JSON are for one panel. Do not pre-multiply.
- This is a scenic prototype, not a structural design. Do not add claims of load ratings, wind rating or code compliance.

## Pull request

Fork, branch, commit, `gh pr create --repo JMB702/rc-set-studio --fill`. Never push to `main`. Do not commit `node_modules`, `dist` or `.wrangler`. Complete the checklist in the PR template, and include in the description:

- what changed and why, and which heights/floors it affects;
- the `npm run quote` **before and after** numbers;
- which Build guide steps and Pricing guide rows you updated, or why none needed it.

Never touch `.openai/` (production hosting config) or deploy anything.
