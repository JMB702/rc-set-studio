# RC Set Studio: instructions for AI agents

Open-source 3D viewer, **Build guide** and **Pricing guide** for a modular scenic set (8×4 and 10×4 wall panels, jacks, floors). Plain browser modules in `public/`, one Cloudflare Worker in `worker/`, no framework.

## Before you change anything

**Read `.claude/skills/rc-set-sync/SKILL.md` first** (in Claude Code, invoke the `rc-set-sync` skill). It has the map of where every fact lives and the full workflow. This is mandatory, not optional.

## The rule, in short

Any change to the set (geometry, dimensions, panel count or height, lumber, hardware, floor, finishes, prices) must update, **in the same pull request**:

1. the **Build guide** (`public/guide.js`: steps, part specs, cut list),
2. the **Pricing guide** (`public/pricing-calc.js`, `public/data/flat-shopping-list.json`),
3. **everything else the change reaches.** If it needs more or less material, carry that through the materials JSON, both shopping lists, the cut list, step text, `public/assets/design-basis.txt` and the tests.

If you decide a change affects none of these, say why in the pull request.

## Run it

```sh
npm install
npm start        # http://localhost:8787, rebuilds when you edit public/ or worker/
```

Refresh the browser after an edit. No accounts or API keys are needed.

## Check it

```sh
npm run check            # tests, including materials/shopping-list consistency
npm run sync:shopping    # regenerate public/data/home-depot-shopping-list.txt after editing the JSON
npm run quote            # Pricing guide subtotals; paste before and after into the PR
```

## Ground rules

- Never push to `main`. Fork, branch, open a pull request: `gh pr create --repo JMB702/rc-set-studio --fill`.
- Do not commit `node_modules/`, `dist/`, `.wrangler/`, or `output/`.
- Do not touch `.openai/` (production hosting). Do not deploy.
- Never invent prices, stock or products. Unverified prices stay "pending" (see the skill).
- This is a scenic prototype, not a structural design. Do not add load, wind or code-compliance claims.
- `public/pricing-config.js` is inlined into the Worker by `scripts/build.mjs`: keep it plain `export function` declarations with no imports.
- Schema changes: edit `db/schema.ts`, run `npm run db:generate`, commit the new migration.
