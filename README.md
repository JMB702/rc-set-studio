# RC Set Studio

An interactive 3D viewer, step-by-step **Build guide** and **Pricing guide** for a modular scenic set: a 16′ back wall and two 8′ wings built from 4′-wide panels (8′ or 10′ tall), with jacks, ballast and a 10″ plastered platform (angled or square) and an oak or painted floor, each optional and designed in one panel. Runs on a phone, with shared comments and saved estimates.

Live site: https://rc-set-studio.thereallifeatheist.chatgpt.site

## Change it with an AI agent (easiest)

1. On the site, open **Make changes to this project** at the bottom of the side panel and click **Copy prompt for agent**.
2. Paste it into Claude Code, Codex, Cursor or any coding agent, then describe the change you want at the end.
3. The agent forks this repo, runs it locally, makes the change and opens a pull request.

The prompt is generated from [`public/agent-prompt.js`](public/agent-prompt.js). The rules agents follow are in [`AGENTS.md`](AGENTS.md) and the [`rc-set-sync` skill](.claude/skills/rc-set-sync/SKILL.md). The headline rule: **any change to the set also updates the Build guide and the Pricing guide, and carries material changes through the whole project.**

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

The editable browser assets are in `public/`. `worker/index.js` serves the site and its `/api/comments` and `/api/pricing-configurations` endpoints. `npm run build` packages the assets into one Worker module so the viewer needs no framework conversion or remote asset host.

Comments and saved estimates live in the Site's D1 binding `DB`; only the remembered display name is stored in a cookie (one year). Comments can be general or attached to a stable model element plus its set configuration. Names are display names, not verified identities. Comments and names are inserted into the page with `textContent`.

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

The Pricing guide sidebar has three tabs: **Pricing guide**, **Project burn-down**, and **Project tracking**.

- Burn-down saves actual material spending, an optional shared budget, crew members, and time entries in D1. The first visitor creates the four-digit project PIN. The API requires an HttpOnly session for all cost records and receipt reads/writes; PIN hashes use salted PBKDF2, sessions expire after 12 hours, and five failed attempts trigger a 15-minute lockout. Use Lock to end the current session.
- Two crew members start at $0/hour. Each shift captures its own hourly rate. Open shifts accrue completed hours; closing a shift includes its exact partial hour. Time/rate corrections are editable and overlapping shifts are rejected. Removing crew preserves time history and supports restoration.
- JPG, PNG, WebP and PDF receipts (up to 20 MB / five pages) are read locally in the browser using pinned Tesseract.js and PDF.js from jsDelivr. OCR dependencies require internet access on first use. Receipt pixels are not sent to an OCR service. The review form pre-fills store, date and a labelled total, flags unclear or inconsistent results, and requires an explicit save. A second pass retries unclear images. Saved receipts retain compressed, viewable JPEG pages in protected D1 records (up to 1.5 MB combined); PDF originals are not retained. A file fingerprint prevents repeat uploads from being counted twice. A receipt photographed again has a different fingerprint, so check the entry list before saving it.
- Tracking starts with Walls, Dress/prime/paint, Floor, Platform and 25 production milestones aligned with the existing Build guide. Stages and their steps can be dragged or moved using arrow controls. Each step supports 0–100% progress and multiple editable notes; stages also support notes and a bulk percentage edit. The main graphic averages all step percentages. It is separate from the Build guide's reading position and is shared without the cost PIN.
- Both modules reject stale saves from other windows instead of overwriting newer work. Refresh the module before retrying a conflict. Pricing estimates, guide dimensions, quantities, and material prices are unchanged.

`npm start` applies the append-only project migrations locally. Test-only browser fixtures belong in ignored `output/` and must not be copied into production records. The project API/accounting tests are in `tests/project.test.mjs`.

An authorized initial local-to-production transfer can use the server-only `/api/project/transfer` endpoint. It is disabled unless a temporary, expiring `PROJECT_TRANSFER_SECRET` is explicitly provisioned. Imports require an empty project destination, preserve document revisions and the existing salted PIN hash, exclude sessions, and commit atomically. A transfer receipt makes identical retries safe and rejects a different payload. Remove the runtime secret and redeploy after verifying the imported database; never commit snapshots or secret values.


### Construction view and guide completion

The top-right viewport icon switches between **Construction progress** (the default in Explore/Pricing) and **Completed set**. Camera positions always show the completed model. The Build guide defaults to **Full color**, showing the materials for the current instruction; its toggle can enable progress shading independently. Floor installation hides the raised platform and shows bare plywood, patched seams, primer, then paint. Platform seam preparation shows wood with visible compound bands in full color; guide outlines continue to identify the current instruction. Gray translucent parts are unconfirmed or not yet assembled. Painted/primed surfaces only appear once the corresponding finishing stage is complete.

Project tracking's **Assembly counts** records completed panels (0–8), fully built jacks (0–16), attached jacks, and partially built jacks. Attached jacks must be fully built and cannot exceed two per completed panel; fully and partially built counts together cannot exceed 16. Only attached jacks receive normal materials. Counts fill the back wall first, then the left/right wings; this is a count visualization, not a record of individually identified physical panels. Missing counts remain unconfirmed. Platform milestones follow guide stages 30–37; frames and legs stay gray until modules are joined, and decks/fascia/finishes respect their assembly dependencies.

Each Build guide step has a shared **Mark this step done** checkbox. Checked instructions calculate the percentage of their linked tracking milestone. Existing 100% milestones initialize as checked; partial manual percentages do not guess which individual instructions are complete. Direct percentage edits in Project tracking supersede checkbox detail for that milestone. Checking a guide instruction whose original tracking milestone was removed restores that linked milestone. Notes, costs, assembly counts and reading position are preserved; marking instructions done never changes physical assembly quantities automatically.


Platform finishing has separate raw plywood, patched-seam, full skim, primer and painted appearances. Generated pine-plywood and neutral compound textures are recorded in `texture-provenance.json`. Seam bands use actual deck-piece and long fascia-strip edges and wrap across the top perimeter and vertical fascia joints (not the bottom edge); they follow both angled and square layouts. Their visual width and light-gray color are illustrative, not a product specification or an approval for foot traffic. Existing completed skim work initializes the new seam-patching milestone at the same progress. Guide step 36 covers patching and full skim together; edit the separate milestones to show the intermediate seam-only stage.


### Larger platform decks

Decks are planned independently of the small support frames. Adjacent frames within each row share a larger 19/32-inch plywood deck where a 4×8 sheet permits it, with face grain running across the joists. At 45° wall angles and 12-inch gaps, the square platform uses **4 deck pieces over 8 frames from 4 sheets**; the angled platform uses **7 pieces over 13 frames from 7 sheets**. Each deck has a stable label, supporting-frame list, cut-blank dimensions and sheet assignment in the Build guide cut list. Actual undersized stock is centered on the supporting rims; the model and cut plan include the small edge allowance. Stock nesting allows a 1/8-inch saw kerf and does not rotate blanks across the grain.

Remove spanning decks and bridging fascia before separating frames. Deck screws are counted at 6-inch perimeter spacing and 12-inch spacing on interior rims and joists. Frame joining screws remain unchanged. Mesh tape and visible top seams now follow plywood-piece boundaries; fascia retains its own joints. Finishing and labor estimates use the revised seam and screw totals. A spanning deck stays gray until all of its supporting frames are assembled and the deck is attached. Existing approval records are preserved; platform approvals need review for the larger-deck revision.

Guide completion cycles through undone, done, and highlighted auto-mark. In auto-mark mode, Next saves the following step as done before advancing. A third tap unmarks the current step and turns auto-mark off. Auto-mark is session-only and does not act on Back or manual jumps.

Platform fascia uses long strips cut along 8-foot lauan sheets, spanning frames.
Measure the actual floor-to-deck height (about 10 inches) and trim to fit.
Butt joints land on existing legs; corner ends include a trim allowance.
Default square layout: 6 side pieces instead of 12. Default angled: 12 instead of 19.
Cut lengths, stock packing, staples and joint tape follow these pieces; no bottom-edge tape.
