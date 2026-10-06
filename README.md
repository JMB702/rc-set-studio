# RC Set Studio

Mobile Three.js set viewer with a build guide and shared comments.

The editable browser assets are in `public/`. `worker/index.js` serves the site and
its `/api/comments` endpoint. `npm run build` packages the assets into one Worker
module so the existing viewer needs no framework conversion or remote asset host.
Comments live in the Site's D1 binding `DB`; only the remembered display name is
stored in a cookie (one year). Comments can be general or attached to a stable
model element plus its set configuration. Names are display names, not verified
identities. Comments and names are inserted into the page with `textContent`.

Local development:

```sh
npm install
npm run build
npx wrangler d1 migrations apply rc-set-comments-local --local
npm run dev
```

After editing browser assets, run `npm run build` again. Local comments stay in
ignored `.wrangler/` state. Schema changes belong in `db/schema.ts`; generate
append-only Drizzle migrations with `npm run db:generate` before publishing.
