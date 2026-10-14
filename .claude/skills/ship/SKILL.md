---
name: ship
description: Ship RC Set Studio when Jeff explicitly says ship, publish or deploy. Merges the pull request so Vercel deploys main to production, then verifies the live site. Do not invoke for ordinary edits or reviews.
disable-model-invocation: true
---
# Ship RC Set Studio

Production is https://rc-set-studio.vercel.app, built by Vercel from `main`. Shipping means merging a verified pull request; Vercel does the deploy.

1. Make sure the completed work is committed on a branch with an open PR against `main` (`gh pr create --repo JMB702/rc-set-studio --fill`). Run `npm run check` first; fix failures before shipping.
2. Run `npm run ship <PR number>` (or `npm run ship` on the PR's branch). It merges the PR, waits for Vercel's production build of the merge commit, and checks `/`, `/api/project/tracking` (200) and `/api/project/finance` (401).
3. Only report shipped when it prints `Shipped`. If the Vercel build fails, open the build log link it prints, fix forward in a new PR, and ship that. Never call a push or merge alone a deployment.

- Do not run `vercel deploy --prod` by hand while the GitHub integration is connected; it races the integration.
- Production project data and PIN stay untouched. Database schema changes ship as additive Drizzle migrations, which the production build applies. A data migration needs its own explicit request.

For ordinary work, keep following `rc-set-sync`; open a PR and await a shipping request.
