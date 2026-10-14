@AGENTS.md

Invoke the `rc-set-sync` skill before your first edit in this repo.

## Shipping

When Jeff explicitly says “ship changes,” “publish,” or “deploy,” make sure the work is in a pull request, then run `npm run ship` (or `npm run ship <PR number>`) and wait for it to finish. It merges the PR into `main`, waits for Vercel's production build of that merge commit, and checks the live site. Only report shipped when it prints `Shipped`. `/ship` invokes the same workflow. Do not stop at a commit or GitHub push, and do not invoke it for ordinary edits.
