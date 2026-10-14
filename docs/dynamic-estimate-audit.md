# Dynamic estimate audit — October 14, 2026

The estimate follows the active design. It does not select one saved “main” configuration, change an approval, or modify shared progress, purchases, rates, or receipts.

## Sourced products

| Cost row | Product / retailer | Unit price | Evidence |
| --- | --- | ---: | --- |
| cycSkin | Same Home Depot utility plywood as wall panels, #100543684 | $20.88/sheet | Store price and 34 sheets checked Oct 14; actual .106 × 48 × 96 inches verified against current product page |
| cycRibPly | Home Depot Plytanium #100061386 | $52.88/sheet | Store price and 7 sheets checked Oct 14; actual .703 × 47.938 × 95.938 inches |
| cycAdhesive | Same Home Depot Titebond III #100522343 | $9.98/16 oz | Store price and 25 bottles checked Oct 14; manufacturer spread 250 sq ft/gallon on tight bare-wood contacts |
| cycReinforcement | Home Depot FibaFuse #203154307, 250 ft | $7.58/roll | Checked Oct 14; free ship-to-store Oct 19–21 or free delivery Oct 19–20; both-options compound corners |

Home Depot is preferred. Lowe’s is the only permitted fallback. No specialty supplier, minimum sheet order, Ace price, or non-US price enters the calculation. The working in-app Home Depot session provided 33 current product prices with E Bradenton selected. Dated pickup, shipping and arrival evidence is keyed by SKU in `retailChecks`; see `retail-check-2026-10-14.json`. SKIM FLOOR remains a historical Oct 10 allowance because its current listing exposed no price or fulfillment quote. Later failed refreshes do not erase earlier same-day observations or turn unknown values into zero.

Sources:
- https://www.homedepot.com/p/100543684
- https://www.homedepot.com/p/100061386
- https://www.homedepot.com/p/100522343
- https://www.homedepot.com/p/203154307
- https://www.titebond.com/product/wood-glues/e8d40b45-0ab3-49f7-8a9c-b53970f736af
- https://www.adfors.com/sites/hps-mac3-adfors-us/files/2025-01/fibafuse_sell_sheet.pdf

## Quantities and physical construction

Skin rectangles keep the 96-inch grain direction along the part height/run; arcs wider than 47 inches split into supported strips. One inch of across-arc trimming stock and 1/8-inch saw kerf are included. Packing keeps real sheet positions, bounds and non-overlap. Both options add two separately allowed gore/mockup sheets.

Rib stock uses actual sheet dimensions and kerf. Smaller wing angles use the better of the wall-aligned or bisector-aligned bounding rectangles. At 90 degrees, two opposed quarter-circle ribs fit a 36-1/8-inch square blank; four ribs fit one sheet. Floor quarter-circle ribs pair within 24-1/8-inch blanks, six per sheet. Compound ribs use their actual maximum radial span by 24-inch height, not the old undersized generic square. Different rib batches keep separate sheets and do not assume shared irregular offcuts.

Wider skin arcs add scribed vertical seam backing to geometry, stock, glue contact area and labor. Rib positions support 96-inch skin joins. Glue bottles are rounded from wood-contact area, manufacturer coverage and 25% application allowance. Bend direction, clamping and finish adhesion still need the existing full-size mockup; no structural or manufacturer system approval is claimed.

Identical screw/staple SKUs share purchased packs across stable cost-row IDs. Primer, compound, paper tape and matching wall/curve paint also pool measured use before rounding containers; different paint product URLs stay separate. Removing a component or excluded row recalculates allocation. Existing receipts remain linked by the same IDs; actual spending is never reduced because the estimate improves.

## Tax and completeness

Catalog materials use 6% Florida sales tax plus 1% Manatee surtax. The county portion caps at $5,000 per tangible item. Custom costs can opt into tax; older items retain tax-as-entered behavior. Recorded expense totals already include what was paid, so estimated tax is added only to remaining purchases.

- https://floridarevenue.com/Forms_library/current/dr15dss_26.pdf
- https://floridarevenue.com/taxes/taxesfees/Pages/discretionary.aspx

Painted-floor configurations have prices for all modeled material rows, including all four seamless combinations. Perimeter over bare/unspecified floor or floating oak still requires a site-dependent transition and remains explicitly pending. The existing oak vapor-barrier question also remains conditional. Do not turn these unknowns into a false zero.

This is a planning estimate, not a guaranteed checkout quote. Local pickup is preferred. Explicit order-only products show “Need to order” only for positive remaining quantities; shipping fee and estimated arrival stay separate from material prices. Unknown fees and dates are labelled, and historical-price or fulfillment gaps appear beside the total. A free ship-to-store offer is not immediate store stock. Delivery offers are not summed as though they were a combined cart quote. New tool purchases are not assumed. Labor follows active crew/rates when unlocked; unknown rates remain unpriced. The 48-person-hour compound-junction allowance remains an estimate, with drying days separate.
