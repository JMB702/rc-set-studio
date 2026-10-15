# RC Set Studio

An interactive 3D viewer, step-by-step **Build guide** and **Pricing guide** for a modular scenic set: a 16′ back wall and two 8′ wings built from 4′-wide panels (8′ or 10′ tall), with jacks, ballast and a 10″ plastered platform (angled or square) and an oak or painted floor, each optional and designed in one panel. Runs on a phone, with shared comments and saved estimates.

Live site: https://rc-set-studio.vercel.app

## Change it with an AI agent (easiest)

1. Point Claude Code, Codex, Cursor or any coding agent at this repository (`https://github.com/JMB702/rc-set-studio`) and describe the change you want.
2. The agent forks this repo, runs it locally, makes the change and opens a pull request.

The rules agents follow are in [`AGENTS.md`](AGENTS.md) and the [`rc-set-sync` skill](.claude/skills/rc-set-sync/SKILL.md). The headline rule: **any change to the set also updates the Build guide and the Pricing guide, and carries material changes through the whole project.**

## Run it yourself

Needs Node 20+ and npm.

```sh
git clone https://github.com/JMB702/rc-set-studio.git
cd rc-set-studio
npm install
npm start          # http://localhost:8787
```

`npm start` builds the Worker, applies the local comments database, serves the site and rebuilds whenever you edit `public/` or `worker/`. Refresh the browser to see changes. No accounts or API keys.

| Command | What it does |
|---|---|
| `npm start` | Build, migrate local DB, serve with rebuild on change |
| `npm run check` | Run the tests (includes materials and shopping-list consistency) |
| `npm run sync:shopping` | Regenerate `public/data/home-depot-shopping-list.txt` from the JSON |
| `npm run quote` | Print Pricing guide subtotals for every standard configuration |
| `npm run db:generate` | Generate a Drizzle migration after editing `db/schema.ts` |

## Contributing

Fork, branch, open a pull request. The PR template carries the checklist: Build guide updated, Pricing guide updated, materials carried through. Include the `npm run quote` before and after in the description.

## How it works

The editable browser assets are in `public/`. `worker/index.js` serves the site and its `/api/*` endpoints. `npm run build` packages the assets into one Worker module so the viewer needs no framework conversion or remote asset host.

Production runs on Vercel. Its CDN serves `public/` directly, and every `/api/*` request goes to one Vercel Function, `api/index.mjs`, which runs the same built Worker. `api/_d1.mjs` gives the Worker the small slice of the Cloudflare D1 API it uses on top of Turso (libSQL, SQLite-compatible), so the queries and Drizzle migrations are identical locally and in production. Production builds (`npm run build:vercel`) apply pending migrations; preview builds never touch the production database and get an in-memory one instead.

Comments and saved estimates live in the database (local D1 under `wrangler dev`, Turso in production); only the remembered display name is stored in a cookie (one year). Comments can be general or attached to a stable model element plus its set configuration. Names are display names, not verified identities. Comments and names are inserted into the page with `textContent`.

Local comments stay in ignored `.wrangler/` state. Schema changes belong in `db/schema.ts`; generate append-only Drizzle migrations with `npm run db:generate`.

| Area | Files |
|---|---|
| 3D model | `public/model.js`, `public/platform.js`, `public/podcast.js` |
| Design panel (walls, platform, floor, colors) | `public/design.js` |
| Build guide | `public/guide.js` |
| Pricing guide | `public/pricing*.js`, `public/shopping-*.js`, `public/data/flat-shopping-list.json` |
| Design notes | `public/assets/design-basis.txt`, `public/assets/sources.txt` |
| Server, database | `worker/index.js`, `db/schema.ts`, `drizzle/` |

## Disclaimer

This is an indoor scenic prototype, not a structural, wind-rated or code-compliant design. Validate joinery, supports, ballast and floor grip in your own layout before use. Prices are Home Depot listings observed on the date shown in the app; they change.

## Project costs and production progress

The Pricing guide sidebar has three tabs: **Pricing guide**, **Cost projection**, and **Project tracking**.

- Burn-down saves actual material spending, an optional shared budget, crew members, and time entries in the database. The first visitor creates the four-digit project PIN. The API requires an HttpOnly session for all cost records and receipt reads/writes; PIN hashes use salted PBKDF2, sessions expire after 12 hours, and five failed attempts trigger a 15-minute lockout. Use Lock to end the current session.
- Two crew members start at $0/hour. Each shift captures its own hourly rate. Open shifts accrue completed hours; closing a shift includes its exact partial hour. Time/rate corrections are editable and overlapping shifts are rejected. Removing crew preserves time history and supports restoration.
- JPG, PNG, WebP and PDF receipts (up to 20 MB / five pages) are read locally in the browser using pinned Tesseract.js and PDF.js from jsDelivr. OCR dependencies require internet access on first use. Receipt pixels are not sent to an OCR service. The review form pre-fills store, date and a labelled total, flags unclear or inconsistent results, and requires an explicit save. A second pass retries unclear images. Saved receipts retain compressed, viewable JPEG pages in protected D1 records (up to 1.5 MB combined); PDF originals are not retained. A file fingerprint prevents repeat uploads from being counted twice. A receipt photographed again has a different fingerprint, so check the entry list before saving it.
- Tracking starts with Walls, Dress/prime/paint, Floor, Platform and 25 production milestones aligned with the existing Build guide. Stages and their steps can be dragged or moved using arrow controls. Each step supports 0–100% progress and multiple editable notes; stages also support notes and a bulk percentage edit. The main graphic averages all step percentages. It is separate from the Build guide's reading position and is shared without the cost PIN.
- Both modules reject stale saves from other windows instead of overwriting newer work. Refresh the module before retrying a conflict. Pricing estimates, guide dimensions, quantities, and material prices are unchanged.

`npm start` applies the append-only project migrations locally. Test-only browser fixtures belong in ignored `output/` and must not be copied into production records. The project API/accounting tests are in `tests/project.test.mjs`.

An authorized initial local-to-production transfer can use the server-only `/api/project/transfer` endpoint. It is disabled unless a temporary, expiring `PROJECT_TRANSFER_SECRET` is explicitly provisioned. Imports require an empty project destination, preserve document revisions and the existing salted PIN hash, exclude sessions, and commit atomically. A transfer receipt makes identical retries safe and rejects a different payload. Remove the runtime secret and redeploy after verifying the imported database; never commit snapshots or secret values.


### Pricing breakdown

Cost & Tracking has three tabs, in order: **Project tracking**, **Cost projection**, **Pricing breakdown**. The Pricing breakdown itemizes the same projected total Cost projection shows: a one-line design summary (edit the design in Explore); a **Projected cost** box (materials bought + still to buy with estimated tax, labor logged + still to come); **Materials** as the purchases made so far, then what is still to buy grouped by part of the set with each item's quantity × unit price and Details; **Labor** with the crew, hours logged and still to come, and hours by stage; and **More** (spreadsheet and print exports). Add item adds custom costs. While Cost projection is unlocked, any item still to buy can be marked **Not needed**: it moves to a Not needed group with its price struck through and stops counting toward still to buy (and its tax), shared with everyone; **Needed after all** undoes it. Labor uses the Cost projection crew and rates. While Cost projection is locked there are no actuals, so the tab shows the plain estimate from list prices and the labor plan.

### Cost projection

The Pricing guide is a live projection once Cost projection is unlocked in the browser: **projected total = spent so far + estimate for what is still to buy (+ estimated tax) + labor still to come**. With nothing bought or logged it equals the estimate.

- **Materials.** Each purchase can carry receipt line items. A line linked to a shopping-list row marks that row bought (or partly bought, by quantity), so its estimate drops out of "still to buy"; the receipt total counts in full as spent. Lines not on the list still count as spent. A purchase with no line items is flagged, because its materials are otherwise counted twice. Without a receipt, use **Link shopping-list items…** to mark what it covered and leave amounts blank. Pricing guide rows show *Bought* / *Partly bought*, and the list can be filtered to what is still to buy.
- **Quote.** *Lock in quote* (Cost projection) stores the total quoted to the client on the shared finance record (`budgetCents`). The projected total is then compared with the quote; the live Pricing guide estimate is still shown beside it.
- **Hours.** Work is time-stamped: whenever a tracker step's progress goes up (checkbox, counter or Build guide), the server records when (`progressLog`), and a step reaching 100% is stamped `completedAt` (shown as "Done …" in the tracker). A time entry's stage is automatic: its hours split across the stages whose work was completed during them, weighted by that work's estimated hours. Choosing a stage on the entry overrides it. Logged hours are each stage's actual time; hours still to come are the stage estimate × the share the tracker says is left.
- **Agents.** The `receipt-reconcile` skill reads a receipt, matches lines to the shopping list (substitutions, short or extra quantities, items not on the list) and saves through `window.__studio.project` in a browser Jeff has unlocked: `status()`, `plan()`, `finance()`, `saveExpense()`, `open(id)`, `projection()`. Same validation and revision checks as the forms; the PIN is never handled by the agent.

### Construction view and guide completion

The top-right viewport icon switches between **Construction progress** (the default in Explore/Pricing) and **Completed set**. Camera positions always show the completed model. The Build guide defaults to **Full color**, showing the materials for the current instruction; its toggle can enable progress shading independently. Floor installation hides the raised platform and shows bare plywood, patched seams, primer, then paint. Platform seam preparation shows wood with visible compound bands in full color; guide outlines continue to identify the current instruction. Gray translucent parts are unconfirmed or not yet assembled. Painted/primed surfaces only appear once the corresponding finishing stage is complete.

Project tracking's assembly counters sit under the steps they measure (completed panels under *Skin the panels*, jack counts under *Build and attach jacks*, ballast under *Add shelves and ballast*) and save on change. They record completed panels (0–8), built jacks (0–16) and attached jacks. A jack is either built or not; there is no in-progress count. Join walls and set angles has its own counters: walls joined (0–8, never more than completed panels) and wing angles set (0–2); the guide's join steps happen once for the whole set, so checking them credits nothing. Attached jacks must be fully built and cannot exceed two per completed panel; fully and partially built counts together cannot exceed 16. Only attached jacks receive normal materials. Panel counts fill the back wall first, then the left/right wings. Attached jacks start at the front-right wing panel, proceed toward the back, across the back from right to left, then out the left wing; this is a count visualization, not a record of individually identified physical panels. Missing counts remain unconfirmed. Platform milestones follow guide stages 30–37; frames and legs stay gray until modules are joined, and decks/fascia/finishes respect their assembly dependencies.

Each Build guide step has a shared **Mark this step done** checkbox; there are no percentage inputs. Wall panels, jacks and ballast are counted: their guide steps and tracker steps take their percentage from the counts (the counted tracker steps are read-only). Each pass through a unit's guide steps builds one more: checking the last step adds 1 panel (steps 1–12), 2 jacks built (13–16, a mirrored pair), 2 attached (17) or 1 ballast assembly (18–20), capped at the total, and clears that unit's checkmarks for the next pass. Checking steps alone never moves progress; only the counts do. The count checkpoints (38–41) and the tracker counters correct totals directly. Other steps (cutting, finishing, floor and the single platform) follow their checkboxes, one step at a time. Overall and stage percentages are weighted by time, not step count: work already done counts at the hours actually logged against its stage (unassigned logged hours stand in for done work with none), and work not done yet at the labor estimate. While Cost projection is locked, the estimate alone is used. Notes, costs and reading position are preserved.


Platform finishing has separate raw plywood, patched-seam, full skim, primer and painted appearances. Generated pine-plywood and neutral compound textures are recorded in `texture-provenance.json`. Seam bands use actual deck-piece and long fascia-strip edges and wrap across the top perimeter and vertical fascia joints (not the bottom edge); they follow both angled and square layouts. Their visual width and light-gray color are illustrative, not a product specification or an approval for foot traffic. Existing completed skim work initializes the new seam-patching milestone at the same progress. Guide step 36 covers patching and full skim together; edit the separate milestones to show the intermediate seam-only stage.


### Platform decks

Each 19/32-inch plywood sheet keeps its full 4-foot width and runs its 8-foot length and face grain front to back, across side-to-side joists. Sheets are laid from the left edge of the platform, so most decks need one crosscut to depth and only the last, narrower deck is ripped. Frame columns follow those sheet joints: every joint lands on a pair of rims, or on a front-to-back seam joist where a narrow leftover joins the last frame. For the approved square platform (18-inch back and side clearance, 12-inch front setback) that is **4 deck pieces over 6 frames from 4 sheets with 5 saw cuts**, down from 8 frames and 8 cuts with the earlier side-to-side decks. Each deck has a stable label, supporting-frame list, cut-blank dimensions, saw cuts and sheet assignment in the Build guide cut list. Actual undersized stock is centered on the supporting rims.

Remove spanning decks and bridging fascia before separating frames. Deck screws are counted at 6-inch perimeter spacing and 12-inch spacing on interior rims and joists. Frame joining screws remain unchanged. Mesh tape and visible top seams now follow plywood-piece boundaries; fascia retains its own joints. Finishing and labor estimates use the revised seam and screw totals. A spanning deck stays gray until all of its supporting frames are assembled and the deck is attached. Existing approval records are preserved; platform approvals need review for each deck-layout revision (now `rotated-v1`).

Guide completion cycles through undone, done, and highlighted auto-mark. In auto-mark mode, Next saves the following step as done before advancing. A third tap unmarks the current step and turns auto-mark off. Auto-mark is session-only and does not act on Back or manual jumps.

Platform fascia uses long strips cut along 8-foot lauan sheets, spanning frames. Each exposed run splits into the fewest equal strips that fit 96-inch stock; joints land on the top and bottom rims.
Measure the actual floor-to-deck height (about 10 inches) and trim to fit.
Butt joints land on existing legs; corner ends include a trim allowance.
Default square layout: 6 side pieces instead of 12. Default angled: 12 instead of 19.
Cut lengths, stock packing, staples and joint tape follow these pieces; no bottom-edge tape.

Project tracking omits the decorative heading, manual refresh and assembly-count card (stored counts remain intact). Visible viewers check shared tracking revisions every three seconds, retry after connection failures and refresh on focus. Polls pause during edits, dialogs, saves and drags; stale responses are discarded. The progress hero contracts into a sticky summary on scroll, below the mobile 3D preview. No material or pricing changes.

Explore/Pricing page loads use a 1.5-second opening camera move after workspace restoration: slightly closer and straight on, easing to an angled full-set fit. Bounds include floor, jacks and figures; fitting considers horizontal/vertical FOV and viewport aspect. Resizing refits until interaction; pointer, wheel or keyboard input cancels the intro. Reduced motion settles immediately. Build and saved camera-position views retain their existing restoration behavior.

### Shipping

Vercel's GitHub integration builds every pull request as a preview and every push to `main` as production. Tell Claude **“Ship changes”** or invoke **`/ship`**: Claude runs `npm run ship [PR number]`, which merges the pull request, waits for Vercel's production build of that merge commit and checks the live site. You can also just merge the PR on GitHub.

The Turso credentials live only in the Vercel project's Production environment (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`). Code releases preserve production progress, receipts, hours and PIN. `npm run ship` only reports success after the production build passes and the live checks answer correctly.
