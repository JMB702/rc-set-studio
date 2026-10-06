Comments checked locally on 2026-10-05 using the Worker and a real local D1 database.

- Required name blocks blank submissions in the browser and on the server.
- General comments post without selecting an element.
- The name cookie survives reload; a fresh visitor has a blank name.
- A fresh visitor reads the same saved comments.
- Actual canvas clicks attach a finished wall and a build-guide left stile.
- Clicking an attached comment restores its height/configuration and highlights the element.
- Mobile checked at 390 x 844: panel scrolls, picking reveals the scene, no horizontal overflow.
- Failed post preserves name, text and attachment; submit becomes available for retry.
- Retry with the same comment ID produces one stored row.
- Script-shaped comment content renders as text with no injected script element.
- Invalid configuration and comments over 2,000 characters rejected server-side.
- Drizzle migration inspected: one comments table and a date index; no runtime schema creation.

Test comments exist only in the local preview database, which is ignored by Git.
