---
name: build-photos
description: Add new set-build photos from Jeff's Apple Photos library to the Explore set > Build photos gallery on RC Set Studio. Use when Jeff says "add today's photos", "add build photos", "update the photo gallery", "put the new photos up", or mentions photos he took while building the set. Picks up from the gallery's addedThrough marker, shortlists the best progress shots, gets Jeff's approval, strips metadata, publishes, and ships.
---
# Build photos: add new progress photos to the gallery

The **Build photos** tab in Explore set (`public/explore-photos.js`, `.css`) shows a dated timeline of the real build, grouped by stage. The site is **public**, so nothing is published without Jeff approving the exact photos.

## Where things live

| What | Where |
|---|---|
| Gallery data: stages, photos, captions, sizes | `public/data/build-photos.json` |
| "Already reviewed up to" marker | `addedThrough` in that JSON (local time, `YYYY-MM-DDTHH:MM`). Every candidate up to it has been shown to Jeff, published or rejected. |
| Image files | `public/photos/build/<date>-<title-slug>-<width>.<hash>.webp`, widths 480 / 960 / 1600 / 2400. Content-hashed and served `immutable` (see `vercel.json`), so never edit a file in place: re-run `add` instead. |
| Pipeline | `scripts/build-photos.py` (`candidates`, then `add`). Runs only on Jeff's Mac: needs `osxphotos`, Pillow and Photos.app. |
| Tests | `tests/explore-photos.test.mjs`: every file listed and present, no EXIF/XMP chunks, stages in time order, marker not behind the newest photo. |

## Workflow

Work in a worktree from `origin/main` (other sessions use the main checkout).

1. **Find candidates.**
   ```sh
   python3 scripts/build-photos.py candidates --out <scratch folder>
   ```
   Lists camera photos taken after `addedThrough` (screenshots, hidden photos, receipts and documents are dropped), downloads full-resolution originals from iCloud, and writes `candidates.json` plus a numbered `contact-sheet.jpg` in the scratch folder. Keep the scratch folder out of the repo. Read the contact sheet (one image for the whole batch); open single photos only when the sheet leaves a real doubt.
   For background on what Jeff did that day, check Open Brain (`entities-index.md` → the RC Set project file, or today's raw daily note).

2. **Choose the shots.** Aim for the photos that show *progress*: a new stage starting, a part being made, a stage finished, and one wide "where it stands" shot at the end of the day.
   - Skip duplicates and near-duplicates (keep the clearest, best-framed one), blurry or dark frames, receipts, labels, store shelves with nothing set-related, tool close-ups that show no progress, and anything not about the set.
   - Photos showing people (Jeff or helpers) are allowed only if Jeff approves them by name: point them out.
   - Typically 5–10 photos per work day.

3. **Write the picks file** (in the scratch folder, not the repo):
   ```json
   {"staging": "<scratch folder>",
    "stages": [{"id": "rounded-corner", "title": "The rounded corner", "summary": "One sentence on what this stage achieves."}],
    "photos": [{"n": 3, "stage": "rounded-corner", "title": "Cutting the ribs", "caption": "Curved ribs cut from plywood and clamped on the bench."}]}
   ```
   - `n` is the number on the contact sheet. `stage` is an existing stage id from the JSON, or one defined in `stages` (new stages are appended; stages render in JSON order, so a new one goes after the last stage it follows in time).
   - **Title**: 2–4 words, sentence case. **Caption**: one plain sentence describing what is visible; it is also the alt text. Describe only what the photo shows: no dimensions, materials, load or safety claims you have not confirmed.
   - Keep the last photo of the day titled "Where it stands" with "the set as of <Month day>." when it is a wide progress shot.

4. **Get Jeff's approval.** Build a captioned shortlist sheet (photo, number, title, date and time) and send it to Jeff with `SendUserFile`. Say who appears in any photo and what you left out. Do not commit, push or publish until he says yes; apply any swaps he asks for.

5. **Publish into the repo.**
   ```sh
   python3 scripts/build-photos.py add <scratch folder>/picks.json
   ```
   Converts each pick to sRGB, writes the four WebP sizes with **no EXIF, GPS, XMP or ICC data**, adds a tiny blurred placeholder, appends the entries in time order and moves `addedThrough` to the newest candidate *reviewed* (rejected photos are not offered again). If a title collides with an existing photo on the same day, change the title.

6. **Check.** `npm run check` (the metadata test fails on any EXIF/XMP chunk). Start the worktree's dev server (`PORT=<free port> npm start`, or a `launch.json` entry at the RC Set root) and look at the new stage at desktop and 375 px phone width, including the full-screen viewer.

7. **Ship.** Branch, commit (photos, JSON), `gh pr create --repo JMB702/rc-set-studio`, then `npm run ship <PR>` (see the `ship` skill). Pushing many photos can drop the connection: retry with `git -c http.postBuffer=524288000 push`. After shipping, confirm `https://rc-set-studio.vercel.app/data/build-photos.json` lists the new photos. Tell Jeff in plain words what went up, without PR numbers.

## Rules

- Never publish a photo Jeff has not approved in this conversation.
- Never commit originals, contact sheets, picks files or anything with metadata. Only `add` output goes in `public/photos/build/`.
- Never move `addedThrough` by hand past photos Jeff has not seen.
- The gallery changes no set facts, so the Build guide and Pricing guide are untouched (say so in the PR).
