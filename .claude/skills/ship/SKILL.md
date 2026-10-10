---
name: ship
description: Ship RC Set Studio when Jeff explicitly says ship, publish or deploy. Uses the installed Codex CLI as an authenticated Sites publishing bridge. Do not invoke for ordinary edits or reviews.
disable-model-invocation: true
---
# Ship RC Set Studio

When Jeff explicitly asks to ship, run `npm run ship` from this checkout and let it finish. The command delegates release integration and Sites publication to the installed Codex CLI using Jeff's existing sign-in. This explicit request overrides the repository's ordinary no-deployment default.

- Do not separately deploy, change hosting audiences, copy credentials, or push competing releases while it runs.
- Check its exit code and `output/releases/last-release.json`. Only report shipped when status is `deployed` and include the live URL/version. The receipt is ignored by Git.
- If access fails, run `npm run ship:check`. Report the actual blocker; never call a GitHub push a production deployment.
- Production project data and PIN stay untouched. A separate explicit data migration request needs its own reviewed workflow.

For ordinary work, keep following `rc-set-sync`; open a PR and await a shipping request.
