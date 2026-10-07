import * as T from 'three';
import {inch,design,panel,mats,box,finishedSet,floorMesh,platformFloor,platformParts,slab,dispose,grain} from './model.js';
import {floorArea} from './pricing-calc.js';
import {platformPlan,platformCuts,PLATFORM,legLength,sillLegLength,rimBottom,inches} from './platform.js';
const $=s=>document.querySelector(s);
export function cutRows(h){let d=design(h),rows=[[2,'Outer stiles',`¾″ × ${h===120?'5½':'3½'}″ × ${h}″`,h===120?'Solid 12′ stock; trim to 120″':'Nominal 1×4'],[2,'Top + bottom rails',`¾″ × ${h===120?'2½':'1½'}″ × 46½″`,'Fit between full-height stiles'],[3,'Toggles',`¾″ × ${h===120?'2½':'1½'}″ × 46½″`,'Centers: 24″, 48″, 72″']];if(h===120)rows.push([1,'Skin seam backer','¾″ × 3½″ × 46½″','Laid flat; center 96″ above bottom']);rows.push([1,'Lower skin','0.106″ × 48″ × 96″','Lauan utility plywood']);if(h===120)rows.push([1,'Upper skin','0.106″ × 48″ × 24″','Joint centered on 3½″ backer']);rows.push([2,'Jack uprights',`¾″ × 3½″ × ${d.jackH-3.5}″`,'Sit on 3½″-high feet'],[2,'Jack feet',`¾″ × 3½″ × ${d.foot}″`,'Actual stock dimensions'],[2,'Diagonal blanks',`¾″ × 3½″ × ${h===120?112:84}″`,`Fit-cut outer edge ≈ ${h===120?'107 5/16':'80½'}″`],[2,'Corner gussets','0.47″ plywood; 8″ × 8″ triangle','Inboard face, lower front corner'],[2,'Shelf crossbars','1½″ × 3½″ × 46½″','Actual 2×4; laid flat'],[1,'Ballast shelf','0.47″ × 12″ × 46½″','Centered on jack feet']);rows.push([12,'Jack attachment screws','#8 × 1¼″ flat-head wood screws','Six per jack; heads flush. Shared pack with diagonal and seam screws.']);return rows;}
export function steps(h,floor,cfg={}){let d=design(h),items=[
[0,'Cut and label the parts','Start with the actual sizes in the cut list. Mark the skin-facing edge of each board, allow for saw kerf, and reject warped or split stock.',h===120?'10′ version: 120″ solid stiles, deeper cross-members, a supported skin joint and 96″ × 48″ jacks.':'8′ version: 96″ stiles; 46½″ cross-members; one full plywood sheet.','cuts'],
[1,'Place the left stile','Work on a flat bench with the skin-facing edge down. This full-height board establishes the left outside edge.',`1 piece · ¾″ × ${d.stileDepth}″ × ${h}″`,'back'],
[2,'Place the right stile','Set the other outside edge exactly 48″ from the first. The space between stiles is 46½″.',`1 piece · ¾″ × ${d.stileDepth}″ × ${h}″`,'back'],
[3,'Fit the bottom rail','Place the bottom rail between the stiles with its bottom edge flush. Align its skin edge with both stiles.',`1 piece · ¾″ × ${d.railDepth}″ × 46½″`,'back'],
[4,'Fit the top rail','Place the top rail between the stiles, flush with their top ends. Clamp the rectangle square before joining.',`Outside diagonals should match: ${h===120?'129¼″ approximately':'107 5/16″ approximately'}.`,'back'],
[5,'Place the 24″ toggle','Measure from the bottom outside edge to the centerline of this horizontal support. Keep its skin edge flush.','1 piece · centerline 24″ from bottom','back'],
[6,'Place the 48″ toggle','Repeat with the next horizontal support. The 24″ spacing helps support the thin skin.','1 piece · centerline 48″ from bottom','back'],
[7,'Place the 72″ toggle','Add the third toggle and check all front edges sit in the same plane.','1 piece · centerline 72″ from bottom','back']];
if(h===120)items.push([8,'Back the 8′ skin joint','Lay this wider member flat, with its 3½″ face against the plywood. Center it at 96″ so both skin edges have 1¾″ of backing.','1 piece · 46½″ long × 3½″ high × ¾″ deep','back']);
items.push([9,'Glue and screw the frame','Glue each butt joint. Predrill through the stile into each rail and toggle. Countersink the heads flush so adjoining panels can touch. Lime markers locate every screw.',`#6 × 1½″ wood screws: ${h===120?'14 total; two into each end of the wide backer':'10 total, one at each member end'}. Axes ¾″ behind skin rear face; backer axes ⅜″ behind skin.`,'back'],
[10,'Position the main skin','Turn the joined frame over onto level supports so its skin-facing edges face up. Spread wood glue along every frame contact. Lay the 48″ × 96″ skin on the frame, flush with the bottom and both side edges.','0.106″ actual lauan; keep the face flat while glue cures.','front']);
if(h===120)items.push([11,'Add the upper 2′ skin','Butt the 48″ × 24″ cap to the lower sheet at 96″. Both edges land on the wide backer; no unsupported plywood joint.','2′ cap spans 96″–120″ above the bottom.','front']);
items.push([12,'Staple the skin','Fasten while the glue cures. Keep staples centered on the frame edges, about 4″ apart. Test air pressure on scrap so crowns do not cut through the veneer.','½″ narrow-crown staples. Lime markers show centers, enlarged for visibility.','front'],
[13,'Lay out both jack feet','Lay the parts for two mirrored jacks on a flat bench, with their inboard faces up. Align the feet as shown; their 3½″ edges will stand upright when installed.',`2 pieces · ¾″ × 3½″ × ${d.foot}″`,'back'],
[14,'Add the jack uprights','With each jack still lying on its side, fit the upright against the front of the foot. Clamp the two pieces at a true right angle.',`2 pieces · ${d.jackH-3.5}″ long. Overall jack height ${d.jackH}″.`,'back'],
[15,'Fit and fasten the diagonals','Lay each diagonal on the inboard face. Align its outer edge from the top-front corner to the bottom-rear toe. Scribe both ends, trim, glue the overlaps and predrill the screws.',`Start with ${h===120?'112':'84'}″ blanks. Two #8 × 1¼″ screws at each diagonal end; 8 total.`,'back'],
[16,'Add the corner gussets','Glue one triangular gusset over each foot/upright joint on the inboard face, clear of the diagonal. Predrill and screw it to both members.','0.47″ plywood; 8″ legs. Six #8 × 1″ screws per gusset.','back'],
[17,'Screw the jacks to the flat','With a helper, hold the flat upright and clamp each completed jack against its stile. Use sound wood at every screw location. Drill clearance through the stile only, then a pilot into the jack upright. Drive from the outside of the stile, with heads just flush so adjacent flats can touch. Do not use nails or staples for this connection.',`Twelve #8 × 1¼″ flat-head wood screws: six per jack at ${d.attachmentHeights.join('″, ')}″. Axis ${d.attachmentDepth}″ behind the skin rear face. Two ¾″ boards give ½″ nominal penetration into the upright; check on scrap and avoid over-countersinking.`,'back'],
[18,'Tie the jack feet together','Lay both shelf crossbars flat across the two feet. Predrill down into the center of each foot edge and fasten at all four crossings.',`2 crossbars · 1½″ × 3½″ × 46½″. Four #8 × 2½″ screws. Shelf zone: ${d.foot/2-6}″–${d.foot/2+6}″ from jack front.`,'back'],
[19,'Screw down the shelf','Place the plywood shelf across the bars. Drive six screws into each bar, with their heads flush.','46½″ × 12″ × 0.47″ shelf; twelve #8 × 1″ screws.','back'],
[20,'Secure ballast and check stability','Strap the bags around the shelf and both crossbars. Keep the weight low and centered. Check tipping, sliding, fasteners and floor contact in the actual layout before releasing the panel.','Three 25 lb bags are a preliminary planning quantity, not a certified minimum or load rating.','back'],
[21,'Join the straight panel seams','Repeat the panel assembly eight times. Clamp four panels for the back and pairs for each wing with their front faces aligned. Predrill and screw each straight seam from the inside of one stile into the next.','Four #8 × 1¼″ countersunk wood screws per seam at 12″, 36″, 60″, 84″; add one at 108″ on 10′ panels.','back'],
[22,'Set the wing angles',(floor==='wood'||floor==='charcoal'?'Stand the joined walls along the back and side edges of the finished floor, then place each 8′ wing at the chosen angle.':'Place each 8′ wing at the chosen angle.')+' The panels pivot about the front corner in this layout. Brace independently and use a screw-fixed corner connection approved for the actual layout before finishing.','Angle is a layout control, not a load-rated hinge mechanism. Corner connector selection requires a scenic-shop review.','top'],
[23,'Prepare the floor footprint','Mark the floor outline for the planned wall angle on a level, continuously supporting indoor floor. The walls stand along its back and side edges during Full assembly. The viewer uses an 8′-deep floor and changes its outline with the wings.',floor==='wood'?'Follow the laminate instructions for subfloor flatness, moisture and acclimation.':'Use smooth plywood fully supported by the existing floor. It is a floor overlay, not an elevated stage.','top']);
if(floor==='wood')items.push([24,'Roll out the underlayment','Install the underlayment specified by TrafficMaster. Butt its edges without overlap. Add the specified vapor barrier where the substrate requires it.','Let boards acclimate per the manufacturer. Never fasten the floating laminate to the subfloor.','top'],[25,'Click together the starter rows','Use the angle-angle locking joint. Begin with straight rows and a ⅜″ expansion space at the wall lines and fixed objects. Do not force a damaged tongue into place.','Gladstone Oak: 7 mm × 7.6″ × about 50.8″. First and last boards in each row: at least 16″ long.','top'],[26,'Stagger and fit the remaining rows','Continue the click-lock rows, offsetting end joints at least 16″. Scribe the boundary pieces to the angled wall lines and preserve the expansion space.','The 3D planks illustrate the finish; verify edge cuts against actual site measurements.','top'],[27,'Cover the expansion gap','Fit charcoal-painted shoe trim to the walls, covering the ⅜″ gap without trapping the floor. Attach trim only to the wall, never through the laminate.','The finished view shows the tight visual junction; the movement space sits beneath trim.','front']);
else items.push([24,'Lay and stabilize the plywood','Lay smooth 23/32″-class plywood over the existing floor; use the actual thickness listed for the purchased panel. Stagger sheet joints and support every edge.','Overlay joints must not flex or rock. Set floor fastening/underlay details for the venue; do not screw into an unapproved floor.','top'],[25,'Prepare the sheet seams','Sand ridges and fill surface defects with a compatible wood repair product. A monolithic seam coating on moving sheets may crack; confirm the seam system with its manufacturer and test a mockup.','Do not treat ordinary plaster or HENRY FeatherFinish underlayment as a verified exposed painted wear surface.','top'],[26,'Prime the plywood','Clean thoroughly, then prime with a wood-compatible primer specified by the floor-paint manufacturer. Keep filled seams smooth and flush.','BEHR lists a wood primer for its Porch & Patio floor coating. Follow the current label.','top'],[27,'Apply the solid-color floor finish','Apply the floor coating in your selected floor color. Follow the chosen coating’s number of coats and drying schedule; use an appropriate slip-resistant finish for foot traffic.','BEHR Porch & Patio is specified for wood floors. It lists 72 hours before normal use; cooler/damp conditions take longer.','front']);
items.push([28,'Dress and paint the walls','Once the configuration is fixed, dress the plywood joints with scenic seam fabric, feather the edges, sand and prime. Paint the entire face in the selected wall color for one continuous appearance.','Do not bridge a moving corner with rigid plaster. Re-dress corners after changing the wing angle. Rendered color is an approximation.','front']);
// A design may have a floor, a platform, both or neither. The floor goes down first; the platform stands on it.
const platform=floor==='platform'||cfg.platformShape&&cfg.platformShape!=='none';if(floor!=='wood'&&floor!=='charcoal')items=items.filter(([stage])=>stage<23||stage>27);
if(platform)items.push(...platformSteps(platformPlan(cfg.angle??45,cfg.platformBack??PLATFORM.gap,cfg.platformSide??PLATFORM.gap,cfg.platformAngle),floor==='wood'||floor==='charcoal'));
return items.map(([stage,title,description,spec,view])=>({stage,title,description,spec,view,section:sectionOf(stage,floor),...stepHelp(stage,floor)})).sort((a,b)=>sectionIndex(a.section)-sectionIndex(b.section));}
// The guide is split into sections a builder can jump between. Stages keep their numbers; only the order changes.
// Stages 30–39 are reserved for the platform build.
export const sections=[{id:'flat',label:'Flat build',sub:'Wall panels + jacks'},{id:'floor',label:'Floor build',sub:'Floor overlay'},{id:'platform',label:'Platform build',sub:'Raised platform'},{id:'assembly',label:'Full assembly',sub:'Stand, join + finish'}];
export function sectionOf(stage,floor){return stage<=20?'flat':stage>=30&&stage<40?'platform':stage>=23&&stage<=26||stage===27&&floor!=='wood'?'floor':'assembly';}
const sectionIndex=id=>sections.findIndex(s=>s.id===id);
// Platform build: stages 30–37. Quantities follow the current wall angle and gaps.
function platformSteps(p,onFloor){const c=p.counts,ft=v=>(v/12).toFixed(1)+' ft',gap=v=>v?inches(v):'flush',sheets=Math.ceil(p.fasciaStrips/4);return [
[30,'Lay out the platform modules',`Snap the wall lines for the chosen angle on the floor. Mark the platform outline ${gap(p.back)} from the back wall and ${gap(p.side)} from each wing, out to the front of the 8′ floor.${p.platformAngle>p.angle?` Turn its sides in to ${p.platformAngle}°, ${p.platformAngle-p.angle}° further in than the walls; they still stay at least ${gap(p.side)} from each wing.`:''} Divide it into the modules shown, none larger than 4′ × 4′, so one person can carry each frame and each deck. Number every module and mark its place on the floor.${onFloor?' Lay it out on the finished floor; the pads under every leg and sill protect it.':''}`,`${c.modules} modules · ${p.deckArea.toFixed(1)} sq ft · sides at ${p.platformAngle}° · 10″ finished height. An edge set flush against a wall gets no fascia.`,'top'],
[31,'Frame the modules',`Cut rims and joists from 2×4s (actual 1½″ × 3½″) using the platform cut list. Build each frame on a flat floor with the rims on edge around the module outline. Butt each rim into the face of the next, and set joists front to back at 16″ centers. Drive two 3″ screws through every joint and check each frame against its layout.`,`${c.rims} rims + ${c.joists} joists · #9 × 3″ screws, two per joint. Angled ends follow the outline; mark them from the layout.`,'front'],
[32,'Add the legs and sills',`Turn each frame over. Under every edge that will get a fascia, screw a 2×4 sill laid flat, flush with the outside edge. Fit a 2×4 leg into every corner and at least every 4′ along a rim, tight against the rims. Legs over a sill stand on it; the others reach the floor. Screw each leg through the rims, then screw sill legs down into the sill.`,`${c.fullLegs} legs at ${inches(legLength)} + ${c.sillLegs} legs at ${inches(sillLegLength)} on sills · ${c.sills} sills. Rim tops sit ${inches(legLength)} above the floor.`,'front'],
[33,'Set and join the modules',`Stand the frames on their marks with a neoprene pad under each leg and along the sills. Level the rim tops across every seam, shimming legs where the floor dips. Clamp neighbors flush and screw each shared rim to the next from inside the open frames, about every 12″, staggered from both sides.`,`${ft(p.seamLength)} of module seams · #9 × 3″ screws. Reverse this step to take the platform apart.`,'front'],
[34,'Screw down the decks',`Cut each deck from 19/32″ BC sanded plywood, good face up, with the face grain across the joists. Full modules take half a sheet. Screw each deck to its own frame, every 6″ on the rims and 12″ on the joists, with heads just below the surface. Do not glue the decks, so they can lift off when the platform moves.`,`${p.deckSheets} sheets, actual 0.578″ × 47 15/16″ × 95 15/16″ · #8 × 2½″ screws. A 48″ module's deck lands up to 3/32″ short; the skim coat fills it.`,'front'],
[35,'Skin the exposed sides',`Rip 1/8″ lauan into 10″ strips. Glue and staple them to every exposed rim, leg and sill, from the floor to the top of the deck so they cover the deck edge. Butt strip ends over a leg and keep the top edge flush with the deck.`,`${ft(p.fasciaLength)} of fascia · ${p.fasciaStrips} strips, four per sheet (${sheets} sheets) · ½″ staples about 4″ apart.`,'front'],
[36,'Tape, bead and skim the platform',`Fit vinyl corner bead along every top edge and outside corner. Cover the deck seams and fascia joints with mesh tape. Skim the whole top and sides with setting-type compound in two thin coats, then sand smooth so the platform reads as one continuous block. The top is walked on, so test the finish on a mockup first.`,`${p.finishArea.toFixed(0)} sq ft of top and sides · mix only what you can spread in 45 minutes. Seams can crack if modules move; keep the seam screws tight.`,'front'],
[37,'Prime and paint the platform',`Dust everything off, then prime the top and sides with KILZ 2. Roll two coats of BEHR Porch & Patio floor paint, tinted to the selected platform color, over the whole block. Let it cure as the label directs before anyone walks on it.`,`BEHR lists 4–6 hours between coats. Rendered color is an approximation.`,'front']];}
const platformHelp={30:['Floor plan · look down','Tape measure, chalk line and framing square','The outline keeps the chosen gaps from every wall line, and every module is 4′ × 4′ or smaller.'],31:['Frames flat on the floor','Miter saw, square, clamps and drill','Each frame matches its layout, the rims are flush on top and the joists sit at 16″ centers.'],32:['Frames upright on their legs','Saw, square, clamps and drill','Every leg is tight against the rims, and each frame sits flat without rocking.'],33:['Platform in place · work from outside','Drill, clamps, level and shims','Rim tops are flush across every seam, and no module rocks.'],34:['Platform in place · work from above','Circular saw, chalk line and drill','Every deck edge lands on a rim or joist, and the screw heads sit just below the surface.'],35:['Platform in place · work from outside','Table or track saw, wood glue and narrow-crown stapler','The fascia is flush with the deck top and covers every exposed edge down to the floor.'],36:['Finish the top and sides','Taping knives, mixing paddle and drill, sanding pole and sponges','Seams and corners disappear after sanding, and the surface is smooth and hard.'],37:['Finish the top and sides','Roller, brush, tray and extension pole','The paint has cured as the label directs before anyone walks on the platform.']};
const phases=['Prepare parts','Build the frame','Attach the skin','Build the jacks','Support the panel','Assemble the set','Lay the floor','Trim and finish','Build the platform'];
const checks=[
'Every part is labeled and cut to the actual size. Use the cut list below before starting.',
'The skin-facing edge is against the bench. The board lies straight.',
'Outside width is 48″; inside width is 46½″. Both ends line up.',
'The bottom rail is flush with both stile ends.',
'The two outside diagonals match. Keep the rectangle clamped square.',
'The toggle center is 24″ from the bottom outside edge.',
'The toggle center is 48″ from the bottom outside edge.',
'The toggle center is 72″ from the bottom outside edge. All skin edges align.',
'The backer center is 96″ from the bottom, leaving 1¾″ for each skin edge.',
'All joints are glued and fastened, heads are flush, and the frame is still square.',
'The sheet is flush with the bottom and both sides. The frame supports the face evenly.',
'The joint lands on the backer, with both skin edges fully supported.',
'Staples sit flush without cutting the veneer. Keep the face flat during curing.',
'You have a left and right jack, both lying with their inboard faces up.',
'Each upright meets its foot at 90°. Keep the parts clamped while fitting the diagonal.',
'Both diagonals fit their overlaps and have two screws at each end.',
'Each gusset clears the diagonal and is fastened to both members.',
'Six flush wood-screw heads per jack; no protruding tips or split wood. Keep the panel supported.',
'Both bars are flat, centered, and fastened at all four foot crossings.',
'The shelf sits flat; all twelve screw heads are flush.',
'Ballast is strapped low and centered. Verify stability in the actual layout before releasing support.',
'Four back panels and two panels per wing are aligned and joined. Supports remain secure.',
'Wings are independently braced and corners secured at the chosen angle.',
'The outline matches the final wall positions and the existing floor supports the whole overlay.',
null,null,null,null,
'Wall seams are smooth and primed. Let the selected paint cure before using the set.'
];
function stepHelp(stage,floor){
 const phaseIndex=stage===0?0:stage<=9?1:stage<=12?2:stage<=16?3:stage<=20?4:stage<=22?5:stage>=30&&stage<40?8:stage<=26||stage===27&&floor!=='wood'?6:7;
 const orientation=platformHelp[stage]?platformHelp[stage][0]:stage===0?'Parts laid flat':stage<=9?'Flat on bench · frame side up':stage<=12?'Flat on supports · skin side up':stage<=16?'Jacks on their sides · inboard faces up':stage<=20?'Panel upright · work from behind':stage<=22?'Walls upright · secure supports':stage<=26?'Floor flat · look down into the set':stage===27?'Finish at floor level':'Walls upright · work from the front';
 const tools=platformHelp[stage]?platformHelp[stage][1]:stage===0?'Tape measure, square, pencil and saw':stage<=8?'Tape measure, square and clamps':stage===9?'Wood glue, clamps, drill, pilot bit and countersink':stage<=12?'Wood glue, clamps and narrow-crown stapler':stage<=16?'Square, clamps, saw, wood glue and drill':stage===17?'Helper, clamps, drill/driver, #2 Phillips bit, clearance bit, pilot bit and countersink':stage<=20?'Drill, straps and ballast':stage<=22?'Helper, clamps, drill and independent braces':stage<=26?'Tape measure and tools specified by the floor manufacturer':'Sanding and finishing tools specified by the coating manufacturer';
 return {phase:phases[phaseIndex],phaseIndex,orientation,tools,check:platformHelp[stage]?.[2]??checks[stage]};
}
function outlinePiece(o){const outline=new T.LineSegments(new T.EdgesGeometry(o.geometry,30),new T.LineBasicMaterial({color:0x527b2b,transparent:true,opacity:1}));outline.name='Current piece outline';outline.userData.guideDecoration=true;outline.raycast=()=>{};o.add(outline);}
export function installGuide(api){
 let model,markers,animation=[],start=0,all=steps(api.state.height,api.state.floor,api.state),bounds,detailBounds,focused=false,viewOverride=null;
 const S=api.state,controls=$('.controls');let selectedBuildHeight=S.height;
 const progressKey='rc-set-build-progress-v1';let hasOpened=false,configurationChanged=false,saved;
 try{saved=JSON.parse(localStorage.getItem(progressKey));if(!saved||![96,120].includes(saved.height)||!['none','wood','charcoal','platform'].includes(saved.floor)||!Number.isFinite(saved.angle)||saved.angle<0||saved.angle>90||!steps(saved.height,saved.floor,saved).some(st=>st.stage===saved.stage))saved=null;}catch{saved=null;}
 // The collapsed configuration summary sits above every mode's controls.
 controls.prepend($('#guide-controls'));
 controls.prepend($('#design'));
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function cutUI(){let r=cutRows(S.height);$('#cut-intro').textContent=`${S.height/12}′ × 4′ panel + two ${design(S.height).jackH/12}′ jacks. Quantities below are per panel.`;$('#cut-list').innerHTML='<table><thead><tr><th>Qty</th><th>Part / actual cut</th></tr></thead><tbody>'+r.map(([q,n,d,sub])=>`<tr><td>${q}</td><td><strong>${n}</strong><br>${d}<small>${sub}</small></td></tr>`).join('')+'</tbody></table>';if(S.platformShape!=='none'){const plan=platformPlan(S.angle,S.platformBack,S.platformSide,S.platformAngle);$('#cut-list').insertAdjacentHTML('beforeend',`<h4 class="material-title">10″ platform · ${S.angle}° wings</h4><p class="hint">${plan.counts.modules} modules, all 2×4 (actual 1½″ × 3½″). Lengths are outside edges; angled ends follow the layout. ${plan.studs} studs at 96″ cover every cut below.</p><table><thead><tr><th>Qty</th><th>Part / actual cut</th></tr></thead><tbody>`+platformCuts(plan).map(c=>`<tr><td>${c.qty}</td><td><strong>${c.part}</strong><br>1½″ × 3½″ × ${inches(c.length)}<small>${c.note}</small></td></tr>`).join('')+`<tr><td>${plan.counts.modules}</td><td><strong>Decks</strong><br>0.578″ plywood, one per module<small>Up to 48″ × 48″; ${plan.deckSheets} sheets</small></td></tr><tr><td>${plan.fasciaStrips}</td><td><strong>Fascia strips</strong><br>0.106″ × 10″ × 96″ lauan<small>${(plan.fasciaLength/12).toFixed(1)} ft of exposed edge</small></td></tr></tbody></table>`);}}
function materialUI(){const area=floorArea(S.angle),cases=Math.ceil(area*1.1/24.24),cost=cases*28.85;$('#materials-body').innerHTML=`<div class="material-title">Gladstone Oak laminate</div><p>TrafficMaster 32686 · 7 mm thick · click-lock installation.</p><div class="price">$1.19 / sq ft</div><p class="hint">Listed online Oct 5, 2026; $28.85 / 24.24 sq ft case. Local stock and prices may differ.</p><p>This layout: about <strong>${Math.round(area)} sq ft</strong>. With 10% waste: <strong>${cases} cases / $${cost.toFixed(2)}</strong>, flooring only.</p><a href="https://www.homedepot.com/p/203315038" target="_blank" rel="noopener">View flooring at Home Depot</a><br><a href="https://images.thdstatic.com/catalog/pdfImages/6e/6e8e46ae-2116-49c4-8215-025cc7c0ab54.pdf" target="_blank" rel="noopener">Manufacturer installation guide</a><p>Use underlayment and a ⅜″ expansion gap, hidden by wall-mounted trim. This is a visual approximation of oak, not a product photograph.</p><div class="material-title">Solid-color painted floor</div><p>Smooth plywood over a fully supporting existing floor, compatible wood repair and primer, then a wood-rated floor coating. The viewer represents the desired seamless finish.</p><a href="https://www.homedepot.com/p/302055336" target="_blank" rel="noopener">BEHR Mined Coal floor paint</a><p>Confirm a seam-treatment system for the chosen plywood and coating. Ordinary plaster and underlayment patch are not established here as an exposed painted wear layer; moving sheet joints can crack.</p><div class="material-title">10″ platform</div><p>Movable modules up to 4′ × 4′: 2×4 rims and joists at 16″ centers on 2×4 legs, topped with Plytanium 19/32″ BC sanded plywood (actual 0.578″). The plywood is thicker than the wall skin so the top can be walked on, but kept under ¾″ to save weight. Decks are screwed, not glued, so the platform comes apart for a move.</p><a href="https://www.homedepot.com/p/100007300" target="_blank" rel="noopener">19/32″ BC sanded plywood · $44.92</a><p>Sides: 1/8″ lauan fascia. Finish: vinyl corner bead, mesh tape, ProForm Quick-Set Lite setting-type compound, sanded, then KILZ 2 primer and BEHR Porch &amp; Patio floor paint tinted to the selected platform color. Prices observed Oct 6, 2026 at #6319. Quantities follow the wall angle and gaps in the Pricing guide.</p><a href="https://www.homedepot.com/p/206454767" target="_blank" rel="noopener">BEHR Porch &amp; Patio floor paint</a>`;}

 function clear(){window.dispatchEvent(new Event('comment-scene-reset'));dispose(model);dispose(markers);model=markers=null;animation=[];}
 function visibleBounds(root,filter=()=>true){const b=new T.Box3();root.updateMatrixWorld(true);root.traverseVisible(o=>{if(o.isMesh&&filter(o)){o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});return b;}
 function fit(view){
  if(S.mode!=='build'||!bounds)return;
  const st=all[S.step],stage=st.stage,b=focused&&!detailBounds.isEmpty()?detailBounds:bounds;
  const center=b.getCenter(new T.Vector3());
  let direction=stage<=16?[0,1,.32]:stage<=20?[-.42,.6,-1]:st.view==='top'?[0,1,.001]:st.view==='front'?[.12,.35,1]:[-.2,.45,-1];
  if(focused&&stage===9)direction=[-1,.6,.4];
  if(st.section==='platform'&&st.view!=='top')direction=[.3,.75,1];
  if(view==='top')direction=[0,1,.001];else if(view==='front')direction=[.15,.45,1];else if(view==='back')direction=[-.25,.45,-1];
  const dir=new T.Vector3(...direction).normalize();
  const right=new T.Vector3().crossVectors(api.camera.up,dir).normalize(),up=new T.Vector3().crossVectors(dir,right).normalize();
  const r=$('#canvas-wrap').getBoundingClientRect(),aspect=r.width/Math.max(1,r.height),tan=Math.tan(api.camera.fov*Math.PI/360);
  let distance=.7;
  for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
   const delta=new T.Vector3(x,y,z).sub(center),depth=delta.dot(dir);
   distance=Math.max(distance,depth+Math.abs(delta.dot(right))/(tan*aspect),depth+Math.abs(delta.dot(up))/tan);
  }
  distance*=1.22;
  api.orbit.enableDamping=false;api.orbit.target.copy(center);api.camera.position.copy(center).addScaledVector(dir,distance);
  api.orbit.minDistance=focused?.35:.8;api.orbit.maxDistance=Math.max(22,distance*2);api.camera.far=Math.max(60,distance*3);api.camera.updateProjectionMatrix();api.camera.lookAt(center);api.orbit.update();api.orbit.enableDamping=true;api.invalidate();
 }
 function highlight(o,holder){
  if(!o.userData.fastener){outlinePiece(o);const mat=o.material.clone();mat.color.lerp(new T.Color('#c4e698'),.45);o.material=mat;}
  const offset=new T.Vector3(0,0,.10);o.position.copy(offset);animation.push({o,offset});
  if(o.userData.fastener){o.geometry.computeBoundingBox();const marker=new T.Mesh(new T.SphereGeometry(.012,8,5),mats.highlight);marker.userData.guideDecoration=true;marker.position.copy(o.geometry.boundingBox.getCenter(new T.Vector3()));holder.add(marker);}
 }
 function buildPanel(stage){
  const p=panel(S.height);p.userData.commentPrefix='Build panel';p.position.x=-24*inch;model.add(p);
  if(stage===0){
   const parts=p.children.filter(o=>!o.userData.fastener&&o.userData.step<9);
   for(const o of [...p.children]){o.visible=parts.includes(o);if(!o.visible)continue;
    o.geometry.computeBoundingBox();const size=o.geometry.boundingBox.getSize(new T.Vector3()),dims=[size.x,size.y,size.z].sort((a,b)=>a-b),idx=parts.indexOf(o);
    o.geometry.dispose();o.geometry=grain(new T.BoxGeometry(dims[1],dims[0],dims[2]),[dims[1]/inch,dims[0]/inch,dims[2]/inch],idx);
    o.geometry.translate((idx-(parts.length-1)/2)*6*inch,dims[0]/2,dims[2]/2);outlinePiece(o);
   }p.position.x=0;
  }else if(stage>=13&&stage<=16){
   model.remove(p);const d=design(S.height);
   for(const side of ['Left','Right']){
    const jack=new T.Group(),sign=side==='Left'?1:-1;jack.name=side+' jack laid on bench';jack.userData.commentPrefix=side+' jack';model.add(jack);
    const matrix=new T.Matrix4().makeBasis(new T.Vector3(0,sign,0),new T.Vector3(0,0,1),new T.Vector3(sign,0,0));jack.quaternion.setFromRotationMatrix(matrix);
    jack.position.set(sign*(-.15+(d.jackStart+.106)*inch),side==='Left'?-.75*inch:47.25*inch,0);
    for(const o of [...p.children]){
     const onSide=o.name.startsWith(side)||o.userData.fastener&&(side==='Left'?o.geometry.attributes.position.getX(0)<24*inch:o.geometry.attributes.position.getX(0)>24*inch);
     if(o.userData.step>=13&&o.userData.step<=16&&onSide){jack.add(o);o.visible=o.userData.step<=stage;if(o.visible&&o.userData.step===stage)highlight(o,jack);}
    }
   }dispose(p);
  }else{
   for(const o of [...p.children]){o.visible=o.userData.step<=stage;if(o.visible&&o.userData.step===stage)highlight(o,p);}
   if(stage<=9){p.rotation.x=Math.PI/2;}
   else if(stage<=12){p.rotation.x=-Math.PI/2;p.position.y=(design(S.height).stileDepth+.106)*inch;p.position.z=S.height*inch;}
  }
  const d=design(S.height);
  bounds=visibleBounds(model);
  if(stage>=1&&stage<=12){bounds.min.set(-24*inch,0,0);bounds.max.set(24*inch,(d.stileDepth+.106)*inch,S.height*inch);}
  if(stage>=13&&stage<=16){bounds.min.set(-d.foot*inch-.15,0,0);bounds.max.set(d.foot*inch+.15,2.5*inch,d.jackH*inch);}
  if(stage>=18&&stage<=20){bounds.max.y=24*inch;}
 }
 // Platform build (stages 30–37): modules appear in place; frames are built on the floor at stage 31.
 let platformDetail=null;
 function lines(points,color=0x5d4427){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));const l=new T.LineSegments(geo,new T.LineBasicMaterial({color}));l.userData.guideDecoration=true;l.raycast=()=>{};return l;}
 function outlines(polys,y){const pts=[];for(const pg of polys)pg.forEach((a,i)=>{const b=pg[(i+1)%pg.length];pts.push(a[0]*inch,y,a[1]*inch,b[0]*inch,y,b[1]*inch);});return pts;}
 function buildPlatform(stage){
  const plan=platformPlan(S.angle,S.platformBack,S.platformSide,S.platformAngle),r=S.angle*Math.PI/180,c=Math.cos(r)*96,sn=Math.sin(r)*96;
  // Wall lines snapped on the floor; the walls stand during Full assembly.
  model.add(lines([-96*inch,.003,0,96*inch,.003,0,96*inch,.003,0,(96+c)*inch,.003,sn*inch,-96*inch,.003,0,(-96-c)*inch,.003,sn*inch],0x273e2e));
  if(stage===30){model.add(lines(outlines(plan.modules.map(m=>m.poly),.004)));const pad=new T.Mesh(slab(plan.outline,0,.05),new T.MeshStandardMaterial({color:0xd3d0bd,roughness:1}));pad.userData.step=30;model.add(pad);}
  else if(stage>=36){const m=stage===37?mats.platform.clone():new T.MeshStandardMaterial({color:0xdedbd2,roughness:1});if(stage===37)m.userData.surface='platform';const block=new T.Mesh(slab(plan.outline,0,PLATFORM.height),m);block.name='Platform';block.userData.step=stage;block.castShadow=block.receiveShadow=true;model.add(block);if(stage===36)model.add(lines(outlines(plan.modules.map(x=>x.poly),(PLATFORM.height+.02)*inch),0x9c9888));}
  else{
   const parts=platformParts(plan);parts.userData.commentPrefix='Platform';model.add(parts);if(stage===31)parts.position.y=-rimBottom*inch;
   for(const o of [...parts.children]){o.visible=o.userData.step<=stage;if(o.visible&&o.userData.step===stage){outlinePiece(o);const mat=o.material.clone();mat.color.lerp(new T.Color('#c4e698'),.45);o.material=mat;const offset=new T.Vector3(0,.12,0);o.position.copy(offset);animation.push({o,offset});}}
   if(stage===33)for(const m of plan.modules)for(const e of m.edges)if(e.shared)for(let t=6;t<e.len;t+=12){const marker=new T.Mesh(new T.SphereGeometry(.018,8,5),mats.highlight);marker.position.set((e.A[0]+e.u[0]*t+e.n[0]*.75)*inch,(rimBottom+1.75)*inch,(e.A[1]+e.u[1]*t+e.n[1]*.75)*inch);markers.add(marker);}
  }
  // "See detail" frames the module nearest the front center.
  const m=plan.modules.reduce((b,x)=>Math.hypot(x.center[0],x.center[1]-96)<Math.hypot(b.center[0],b.center[1]-96)?x:b,plan.modules[0]);
  platformDetail=m&&new T.Box3(new T.Vector3((Math.min(...m.poly.map(p=>p[0]))-6)*inch,0,(Math.min(...m.poly.map(p=>p[1]))-6)*inch),new T.Vector3((Math.max(...m.poly.map(p=>p[0]))+6)*inch,(PLATFORM.height+2)*inch,(Math.max(...m.poly.map(p=>p[1]))+6)*inch));
  bounds=visibleBounds(model);bounds.min.y=0;
 }
 function buildSet(stage){
  const g=finishedSet(S.height,stage===21?0:S.angle);model.add(g);
  // Floor build happens before the walls stand, so the floor section shows the floor alone.
  if(sectionOf(stage,S.floor)==='floor')g.visible=false;
  const floorWork=stage>=23&&stage<=27;
  if(stage<27||S.floor==='none')g.traverse(o=>{if(o.name==='Charcoal shoe trim')o.visible=false;});
  if(stage>=22&&S.platformShape!=='none')model.add(platformFloor(S.angle,S.platformBack,S.platformSide,S.platformAngle));
  if(stage<28)g.traverse(o=>{if(o.isMesh&&o.material===mats.charcoal)o.material=mats.ply;});
  if(stage>=22&&(S.floor==='wood'||S.floor==='charcoal')){const f=floorMesh(S.angle,floorWork&&stage<25?'charcoal':S.floor,S.floor==='wood'&&stage===25?2:99);
   if(floorWork&&stage<27)f.traverse(o=>{if(o.isMesh){const old=o.material;o.material=stage===26&&S.floor==='charcoal'?new T.MeshStandardMaterial({color:0xd3d0bd,roughness:1}):stage===24&&S.floor==='wood'?new T.MeshStandardMaterial({color:0x798481,roughness:1,side:T.DoubleSide}):stage<25||S.floor==='charcoal'?mats.ply:o.material;if(old!==o.material)old.dispose();}});
   model.add(f);
  }
  if(stage===24&&S.floor==='charcoal'){const lines=[];for(let x=-96;x<=96;x+=48)lines.push(x*inch,.008,0,x*inch,.008,96*inch);for(let z=0;z<=96;z+=48)lines.push(-96*inch,.008,z*inch,96*inch,.008,z*inch);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(lines,3));model.add(new T.LineSegments(geo,new T.LineBasicMaterial({color:0x5d4427})));}
  if(stage===25&&S.floor==='charcoal')for(const x of [-48,0,48]){const line=new T.Mesh(new T.BoxGeometry(.018,.004,96*inch),mats.highlight);line.position.set(x*inch,.006,48*inch);model.add(line);}
  if(stage===21)for(const seam of [-48,0,48])for(const h of [12,36,60,84,...(S.height===120?[108]:[])]){const marker=new T.Mesh(new T.SphereGeometry(.026,8,5),mats.highlight);marker.position.set(seam*inch,h*inch,-.85*inch);markers.add(marker);}
  bounds=visibleBounds(model);
  // Floor work is viewed from above; frame the footprint rather than empty wall height.
  if(floorWork){bounds.min.y=0;bounds.max.y=.15;bounds.min.z=0;bounds.max.z=96*inch;}
 }
 function sectionUI(current){
  $('#guide-sections').replaceChildren(...sections.map(x=>{const count=all.filter(step=>step.section===x.id).length,b=document.createElement('button');b.type='button';b.dataset.section=x.id;b.disabled=!count;b.setAttribute('aria-pressed',x.id===current);if(x.id===current)b.setAttribute('aria-current','step');
   b.title=x.sub;b.innerHTML=`<strong>${x.label}</strong><span>${count?`${count} step${count===1?'':'s'}`:x.id==='platform'?'No platform in this design':'No floor in this design'}</span>`;b.onclick=()=>goSection(x.id);return b;}));
 }
 function instructions(st){
  const inSection=all.filter(x=>x.section===st.section),section=sections.find(x=>x.id===st.section);
  $('#step-number').textContent=`${section.label} · Step ${inSection.indexOf(st)+1} of ${inSection.length}`;$('#progress').max=inSection.length;$('#progress').value=inSection.indexOf(st)+1;
  sectionUI(st.section);
  $('#step-phase').textContent=st.phase;$('#step-title').textContent=st.title;
  const sentences=st.description.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[st.description];
  $('#step-description').textContent=sentences.shift().trim();$('#step-actions').replaceChildren(...sentences.map(text=>{const li=document.createElement('li');li.textContent=text.trim();return li;}));
  $('#step-check-text').textContent=st.check||(S.floor==='wood'?{24:'Underlayment edges meet without overlap. Follow the required moisture-barrier details.',25:'Starter rows are straight, end pieces are at least 16″, and the ⅜″ expansion gap is clear.',26:'End joints are staggered at least 16″. All perimeter pieces retain their expansion gap.',27:'Trim attaches only to the walls and lets the floating floor move.'}:{24:'All sheets and their edges are supported. No joints flex or rock.',25:'The seam system is compatible with the sheets and coating and has passed a mockup.',26:'Primer covers the clean, smooth floor. Let it dry as specified.',27:'Coating has cured for the required foot-traffic time; BEHR lists 72 hours in suitable conditions.'})[st.stage];
  $('#guide-cut-link').hidden=st.stage!==0;$('#step-spec').textContent=st.spec;$('#step-tools').textContent='Bring: '+st.tools;
  $('#guide-orientation').textContent=st.orientation;
  $('#back').disabled=S.step===0;$('#next').textContent=S.step===all.length-1?'Finish & explore →':'Next step →';
  const next=all[S.step+1];$('#guide-next-label').textContent=!next?'Last step · check the finished set':next.section!==st.section?`Up next: ${sections.find(x=>x.id===next.section).label} · ${next.title}`:'Up next: '+next.title;
  $('#guide-step-select').replaceChildren(...sections.filter(x=>all.some(step=>step.section===x.id)).map(x=>{const group=document.createElement('optgroup');group.label=x.label;let k=0;all.forEach((step,i)=>{if(step.section===x.id)group.append(new Option(`${++k}. ${step.title}`,i));});return group;}));$('#guide-step-select').value=S.step;
  $('#part-label').textContent=st.title;$('#scene-sub').textContent=st.orientation;$('#panel-count').textContent=st.section==='flat'?'1 panel + 2 jacks':st.section==='floor'?'8′-deep floor':st.section==='platform'?`${platformPlan(S.angle,S.platformBack,S.platformSide,S.platformAngle).counts.modules} platform modules`:'8 panels';$('#dimensions').textContent=st.section==='flat'?`${S.height}″ × 48″ panel`:st.section==='floor'?`Floor outline · ${S.angle}° wings`:st.section==='platform'?`10″ platform at ${S.platformAngle}° · ${S.angle}° wings`:`${S.height/12}′ walls · ${S.angle}° wings`;
 }
 function display(reframe=true){
  clear();all=steps(S.height,S.floor,S);S.step=Math.max(0,Math.min(S.step,all.length-1));
  if(S.mode!=='build'){api.getSet().visible=api.getFloor().visible=S.mode==='finished';api.invalidate();return;}
  api.getSet().visible=api.getFloor().visible=false;
  const st=all[S.step];model=new T.Group();model.name='Build step model';api.scene.add(model);markers=new T.Group();api.scene.add(markers);
  if(st.stage<21)buildPanel(st.stage);else if(st.section==='platform')buildPlatform(st.stage);else buildSet(st.stage);
  // Fit against final part positions, so placement animation cannot change the camera framing.
  for(const {o}of animation)o.position.set(0,0,0);model.updateMatrixWorld(true);
  detailBounds=visibleBounds(model,o=>o.userData.step===st.stage&&!o.userData.guideDecoration);
  if(st.stage===21)detailBounds=new T.Box3(new T.Vector3(-.15,0,-.3),new T.Vector3(.15,S.height*inch,0));
  if([9,12,15,16,17,18,19].includes(st.stage)){
   let fixing;model.traverseVisible(o=>{if(!fixing&&o.userData.fastener&&o.userData.step===st.stage)fixing=o;});
   if(fixing){fixing.geometry.computeBoundingBox();const point=fixing.geometry.boundingBox.getCenter(new T.Vector3()).applyMatrix4(fixing.matrixWorld);detailBounds=new T.Box3().setFromCenterAndSize(point,new T.Vector3(.35,.35,.35));}
  }
  if(st.stage>=22)detailBounds=bounds.clone();
  if(st.section==='platform'&&platformDetail)detailBounds=platformDetail.clone();
  if(st.stage>=23&&st.stage<=27){const z=st.stage===25?0:24;detailBounds=new T.Box3(new T.Vector3(-48*inch,0,z*inch),new T.Vector3(48*inch,.15,(z+48)*inch));}
  for(const {o,offset}of animation)o.position.copy(offset);
  focused=false;viewOverride=null;$('#guide-focus').setAttribute('aria-pressed','false');$('#guide-focus').textContent='See detail';$('#guide-focus').disabled=detailBounds.isEmpty()||st.stage===0||st.stage===22||st.stage===28;
  start=performance.now();instructions(st);try{localStorage.setItem(progressKey,JSON.stringify({height:S.height,floor:S.floor,angle:S.angle,platformShape:S.platformShape,stage:st.stage}));}catch{}if(reframe){fit();requestAnimationFrame(()=>fit());}api.invalidate();
 }
 function mode(m){
  if(m==='build'&&!hasOpened){hasOpened=true;if(saved&&!configurationChanged){api.configure({height:saved.height,floor:saved.floor,angle:saved.angle,...(saved.platformShape?{platformShape:saved.platformShape}:{})});all=steps(S.height,S.floor,S);S.step=all.findIndex(st=>st.stage===saved.stage);}}
  const entering=S.mode!=='build'&&m==='build';S.mode=m;document.body.classList.toggle('building',m==='build');
  $('#explore-controls').hidden=m!=='finished';$('#guide-controls').hidden=m!=='build';$('#guide-scene-tools').hidden=m!=='build';$('#step-overlay').hidden=true;
  $('#scene-tag').textContent=m==='finished'?'FINISHED SET':'CONSTRUCTION GUIDE';$('#view-hint').textContent=m==='finished'?'Drag to orbit · pinch to zoom':'Green = this step · drag or pinch to inspect';
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===m);b.setAttribute('aria-pressed',b.dataset.mode===m)});
  if(m==='finished'){clear();api.getSet().visible=api.getFloor().visible=true;$('#panel-count').textContent='8 panels';api.orbit.minDistance=1.4;api.orbit.maxDistance=22;api.view('front');requestAnimationFrame(()=>api.view('front'));}
  else{display();if(entering){controls.scrollTop=0;window.scrollTo(0,0);}}
 }
 function go(n){S.step=Math.max(0,Math.min(n,all.length-1));display();controls.scrollTop=0;$('#guide-index').hidden=true;$('#guide-jump').setAttribute('aria-expanded','false');$('#step-content').focus({preventScroll:true});}
 function goSection(id){const i=all.findIndex(step=>step.section===id);if(i>=0)go(i);}
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
 $('#next').onclick=()=>S.step===all.length-1?api.setMode('finished'):go(S.step+1);$('#back').onclick=()=>go(S.step-1);$('#restart').onclick=()=>go(0);
 $('#guide-jump').onclick=()=>{const open=$('#guide-index').hidden;$('#guide-index').hidden=!open;$('#guide-jump').setAttribute('aria-expanded',open);if(open)$('#guide-step-select').focus({preventScroll:true});};
 $('#guide-step-select').onchange=e=>go(+e.target.value);
 $('#guide-cut-link').onclick=()=>{const cut=$('#cut-details');cut.open=true;cut.scrollIntoView({block:'start',behavior:reducedMotion.matches?'instant':'smooth'});};
 $('#guide-reset-view').onclick=()=>{viewOverride=null;focused=false;$('#guide-focus').setAttribute('aria-pressed','false');$('#guide-focus').textContent='See detail';fit();};
 $('#guide-focus').onclick=()=>{focused=!focused;$('#guide-focus').setAttribute('aria-pressed',focused);$('#guide-focus').textContent=focused?'Whole assembly':'See detail';fit(viewOverride);};
 new ResizeObserver(()=>{if(S.mode==='build')fit(viewOverride);}).observe($('#canvas-wrap'));
 window.addEventListener('set-configured',()=>{if(S.height!==selectedBuildHeight){selectedBuildHeight=S.height;}if(!hasOpened)configurationChanged=true;const current=all[S.step]?.stage;all=steps(S.height,S.floor,S);S.step=Math.max(0,all.findIndex(st=>st.stage===current));cutUI();materialUI();if(S.mode==='build')display();});
 api.onTick=t=>{if(!animation.length)return;const e=reducedMotion.matches?1:Math.min(1,(t-start)/650),fade=(1-e)**3;for(const {o,offset}of animation)o.position.copy(offset).multiplyScalar(fade);api.invalidate();if(e===1)animation=[];};
 api.setMode=mode;api.setStep=n=>{if(!Number.isInteger(n)||n<0||n>=all.length)throw Error('Step outside guide');hasOpened=true;S.step=n;api.setMode('build');controls.scrollTop=0;window.scrollTo(0,0);return {...S,stepCount:all.length};};
 api.stepCount=()=>steps(S.height,S.floor,S).length;api.setSection=id=>{if(!all.some(step=>step.section===id))throw Error('No steps in that section');hasOpened=true;if(S.mode!=='build')api.setMode('build');goSection(id);return {...S,section:id};};api.guideView=v=>{viewOverride=v==='reset'?null:v;fit(viewOverride);};
 api.guideStats=()=>({step:S.step,...all[S.step],visible:model?.children.length||0,bounds:bounds?.clone(),detailBounds:detailBounds?.clone()});cutUI();materialUI();return {mode,display};
}
