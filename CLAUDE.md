@AGENTS.md

Invoke the `rc-set-sync` skill before your first edit in this repo.

## Shipping

When Jeff explicitly says “ship changes,” “publish,” or “deploy,” run `npm run ship` and wait for the verified deployment receipt. `/ship` invokes the same workflow. Use `npm run ship:check` for a read-only access check. This uses the installed Codex CLI with the existing Sites sign-in; it does not require credentials copied into Claude. Do not stop at a commit or GitHub push. Do not invoke for ordinary edits, and never recursively invoke it when `RC_SITES_SHIP_ACTIVE` is set.
