## What changed and why

<!-- Which heights (8×4, 10×4), floors (wood, charcoal) and layouts does it affect? -->

## Set-sync checklist

Every change to the set updates the guides in the same pull request. See `.claude/skills/rc-set-sync/SKILL.md`.

- [ ] **Build guide** updated (steps, part specs, cut list, tools), or: why it needs no change ___
- [ ] **Pricing guide** updated (quantities, products, rows, totals), or: why it needs no change ___
- [ ] **Materials carried through** (materials JSON, `npm run sync:shopping`, cut list, `design-basis.txt`, step text), or: no material change
- [ ] Swept for old values with `git grep` (every spelling: `3½″`, `3.5`, cents, `$`)
- [ ] `npm run check` passes
- [ ] Looked at it in the running app: Explore set, changed Build steps, Pricing guide (desktop and 390px)
- [ ] No invented prices; unverified items left "pending"

## Pricing impact (`npm run quote`)

<!-- Paste the output before and after your change -->

```
before:

after:
```
