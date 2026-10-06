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
