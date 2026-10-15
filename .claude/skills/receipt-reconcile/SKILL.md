---
name: receipt-reconcile
description: Read an RC Set materials receipt and reconcile it against the shopping list in Cost projection, so the cost projection uses what was actually paid instead of the estimate. Use when Jeff says "read this receipt", "reconcile the receipt", "log the Home Depot run", "link this purchase", hands over a receipt photo, scan or PDF for set materials, or asks to link an existing purchase (with or without a receipt) to shopping-list items. Matches each receipt line to a shopping-list row, flags substitutions, short or extra quantities and items not on the list, and saves the line items through the same path as the manual form.
---

# Reconcile a receipt against the shopping list

Cost projection holds every purchase (an *expense*). Each expense can carry **line items**; a line item linked to a shopping-list row (`materialId`) tells the cost projection that row is bought, so its estimate stops counting as "still to buy". The projection is:

> **projected total = everything spent so far (receipt totals + logged labor) + estimate for what is still to buy + estimated tax on it + labor still to come**

Everything this skill does, Jeff can do by hand in **Cost & Tracking → Cost projection → Edit** on a purchase (line items, *Link shopping-list items…*, *Attach receipt*). Use the same path so he can review and correct it afterwards.

## Data model (what you write)

```js
// One expense. amountCents is the receipt TOTAL actually paid, tax included.
{id, vendor, date:'YYYY-MM-DD', amountCents, note, receiptId, items:[
  {materialId,   // shopping-list row id (e.g. 'board16', 'platformDeck', 'custom-…'), or null = not on the list
   description,  // the line as printed on the receipt; required when materialId is null
   quantity,     // in the row's BUY units (packs for screws/staples), or null if unknown
   amountCents,  // line total before tax, after any line discount; null if not itemized; negative for a return
   complete,     // true = this row needs nothing more (bought the full amount, or Jeff says that's all)
   substitute,   // true = a different product standing in for the planned one
   note}         // short reason: what was substituted, short count, return…
]}
```

A row is **bought** when any linked line has `complete: true`, or the linked quantities reach the plan's `purchaseQuantity`. Otherwise it is **partly bought** and the rest stays in the projection at the estimated unit price.

## Workflow

### 1. Read the receipt yourself

- Jeff gives a path (photo, scan, PDF), or it is in `~/Documents/Scans` (the `hpscan` default). Read the image with the Read tool; for PDFs pass `pages`. Long receipts: crop into overlapping strips first (`sips` or a short Python/Pillow script into the scratchpad) and read each strip, so small print stays legible.
- Transcribe every line: SKU/description, quantity, unit price, line total, any discount line under it, subtotal, tax, total, store, date. Home Depot prints the quantity and unit price on a second line (`3@15.32`).
- Do not guess unreadable digits. Mark them and ask Jeff, or leave that line's amount `null`.
- Check: line totals − discounts = subtotal; subtotal + tax = total. If not, say which line is off before saving anything.

### 2. Get the live shopping list and existing purchases

Production finance data is behind Jeff's project PIN. Never ask Jeff for the PIN, never type it, never store it.

1. Open the production site in the built-in browser: `preview_start` with `url: https://rc-set-studio.vercel.app`. Then `__studio.setMode('pricing')`.
2. `await __studio.project.status()` → `{configured, unlocked, expenses}`. If `unlocked` is false, ask Jeff to open **Cost projection** in that browser pane and enter his PIN himself (the session lasts 12 hours), then check again.
3. `__studio.project.plan()` → the full-set shopping list exactly as the Pricing guide prices it (Jeff's design, removals and added items applied): `{id, name, group, purchaseQuantity, packSize, unitPriceCents, subtotalCents, status}`. `status` is `bought`, `partial` or `remaining`.
4. `await __studio.project.finance()` → existing expenses. Before creating one, look for the same store + date + total; if it exists, add line items to that entry instead (same `id`). If Jeff already uploaded this receipt with **Upload receipt**, that entry has a `receiptId`; reuse it.

Offline drafting only (no browser): `node -e` with `priceRows()` from `public/pricing-calc.js` and the latest approved design from `GET /api/approvals` gives the same row ids, but without Jeff's Pricing guide removals or added items. Never save from this.

### 3. Match each receipt line

| Receipt line | Line item |
|---|---|
| Same product as a planned row | `materialId` = that row, `quantity` in buy units, `amountCents` = line total after its discount |
| Different product doing the same job (pine for whitewood, 1×4×8 for a 1×4×10 cut, another brand of screw) | link the row, `substitute: true`, `note` says what it is |
| Bought less than the plan | link, `complete: false` unless Jeff says that is all that is needed |
| Bought more than the plan | link, `complete: true`, `note: 'N extra'` |
| One planned row split over two receipts | a line on each; the second one completes it |
| Not on the list (tools, blades, pencils, a cart fee) | `materialId: null`, `description` from the receipt |
| Return or refund | negative `amountCents`; if it undoes a planned row, link it and set `complete` to match what is left |
| Tax, subtotal, payment, change | not line items. Tax is inside the expense total |

Unit traps: screws, staples and sandbags are bought in **packs** (`packSize` > 1, `purchaseQuantity` is packs). Sand is planned by the pound but bought in 50 lb bags; lumber by the stick; paint by the gallon. When a match is uncertain (two 1×4 rows, 8 ft vs 10 ft), say so and ask rather than pick.

### 4. Show Jeff the reconciliation before saving

A short table: receipt line → shopping-list row, quantity vs plan, paid vs estimate, and a flag column (substitute, short, extra, not on list, unreadable). Then the totals check and what changes: rows that become bought, rows still partly to buy, and the expected change in **Still to buy**. Ask only the real questions. Save once he agrees, or straight away if he already said to.

### 5. Save through the page API

```js
await __studio.project.saveExpense({
  id,                       // omit to create a new expense; pass an existing id to update it
  vendor:'Home Depot', date:'2026-10-12', amountCents:48713, note:'',
  items:[{materialId:'platformLumber', description:'2X4-8 STUD', quantity:30, amountCents:12750, complete:true, substitute:false, note:''},
         {materialId:null, description:'DEWALT 6PC DRILL BIT SET', quantity:1, amountCents:1297, complete:false, substitute:false, note:''}]
});
```

It runs the same revision-checked save as the form. Passing `items` replaces that expense's whole line-item list, so include the existing lines when you add to an entry. A conflict error means someone saved in another window: fetch `finance()` again, merge, retry once.

To attach the receipt image, open the entry for Jeff with `await __studio.project.open(id)` and have him tap **Attach receipt** (the file picker needs him). The image is stored privately and shown with the entry.

Never delete an expense or a line Jeff entered unless he asks. Never invent an amount: no receipt means `amountCents: null`.

Rows Jeff says he will not buy (already on hand, dropped on purpose) can be marked with `await __studio.project.setNotNeeded(rowId, true, 'note')` (`false` to undo; `__studio.project.notNeeded()` lists them). They stay on the shopping list but stop counting toward still to buy. Only mark a row when Jeff says so.

### 6. Confirm the result

`__studio.project.projection()` → report: projected total, spent so far, still to buy (and how many items are unpriced), how many purchases are still unlinked, and "paid X for items estimated at Y" (`materials.spentCents` vs `materials.coveredEstimateCents`). One or two lines, not a dump.

## Linking a purchase that has no receipt

Same as above, but every line is `{materialId, quantity:null, amountCents:null, complete:true}`, one per row the purchase covered. The expense total stays the amount Jeff paid. Example: the Oct 9 Home Depot purchase ($1,462.00, "Materials for 8 wall panels") covers every row in the **Wall panels** (`group: 'panel'`) and **Jacks and shelf** (`group: 'supports'`) groups. When the receipt turns up, add quantities and amounts to those same lines.

## Hours (for context)

Labor works the same way: each time entry has a stage of work (`taskId`, one of the Pricing guide labor tasks). Logged hours are that stage's actual time; the hours still to come are the stage estimate scaled by how much the Project tracker says is left. Time with no stage still counts as spent. If Jeff mentions hours alongside a receipt, he can set the stage on the entry in **Time entries → Edit**.
