import {platformPlan} from './platform.js';
// This is the existing material schedule, surfaced at the point of use.
// Quantities are per panel with two jacks unless the note names the full set/platform.
export function stepFasteners(stage,height,floor,cfg={}){
  const item=(title,note,productId=null,quantity=null)=>({title,note,productId,quantity});
  const none=note=>[item('No fasteners in this step',note)];
  if(stage===0)return none('Cut and label only. Fasteners are listed on the joining steps.');
  if(stage>=1&&stage<=8)return none('Dry-fit and clamp the frame. Use the #6 × 1½″ screws in “Glue and screw the frame.”');
  if(stage===9)return [item('#6 × 1½″ flat-head wood screws',height===120?'14 per panel: one at each rail/toggle end, plus two at each end of the seam backer. Predrill; heads flush.':'10 per panel: one at each end of the two rails and three toggles. Predrill; heads flush.','frameScrews',height===120?14:10),item('Titebond III wood glue','Glue every frame butt joint.','glue')];
  if(stage===10||stage===11)return [item('Titebond III wood glue','Spread along every frame-to-skin contact. Clamp the skin flat; fasten it in “Staple the skin.”','glue')];
  if(stage===12)return [item('½″ long, 18-gauge, ¼″ narrow-crown staples',`About 4″ apart, centered over framing. Allow ${height===120?144:108} per panel. Match the stapler; these are not brad nails.`,'staples',height===120?144:108)];
  if(stage===13||stage===14)return none('Clamp the foot and upright square. The diagonals and corner gussets secure these joints in the following steps.');
  if(stage===15)return [item('#8 × 1¼″ flat-head wood screws','Two at each end of each diagonal: 8 total for two jacks. Predrill.','lapScrews',8),item('Titebond III wood glue','Glue each diagonal overlap.','glue')];
  if(stage===16)return [item('#8 × 1″ flat-head wood screws','Six per corner gusset: 12 total for two jacks. Use three screws into the foot and three into the upright.','shortScrews',12),item('Titebond III wood glue','Glue both gusset contact faces.','glue')];
  if(stage===17)return [item('#8 × 1¼″ flat-head wood screws','Six per jack: 12 per panel, driven through the stile into the jack upright. Predrill; keep heads flush. No nails or staples here.','lapScrews',12)];
  if(stage===18)return [item('#8 × 2½″ flat-head wood screws','One at each crossbar/foot crossing: 4 total. Predrill down through the bars into the feet.','barScrews',4)];
  if(stage===19)return [item('#8 × 1″ flat-head wood screws','Six into each shelf crossbar: 12 total. Heads flush.','shortScrews',12)];
  if(stage===20)return height===120?[item('Ballast retention: specification pending','The 10′ ballast mass and strap/retention arrangement still require review; the Pricing guide lists them as pending.')]:[item('Cam-buckle straps','Three per panel, around the ballast shelf and crossbars. No additional wood screws in this step.','straps',3)];
  if(stage===21)return [item('#8 × 1¼″ flat-head wood screws',`${height===120?5:4} per straight seam; ${height===120?25:20} across the full set’s five seams. Clamp faces flush and predrill.`,'lapScrews',height===120?25:20)];
  if(stage===22)return [item('Corner fasteners: specification pending','Use a reviewed screw-fixed corner connection. Screw size and count are not specified yet; the Pricing guide keeps both corner assemblies pending.')];
  if(stage===23||stage===30)return none('Mark the layout only.');
  if(stage===24&&floor==='wood')return [item('Underlayment seam tape, if required','Use the underlayment manufacturer’s specified tape/barrier method. No screws, nails or staples through the floating floor.')];
  if((stage===25||stage===26)&&floor==='wood')return none('The laminate uses click-lock joints. Do not nail or screw it to the floor.');
  if(stage===27&&floor==='wood')return [item('Trim fasteners: specification pending','Attach shoe trim only to the wall. Select the fastener for the actual trim and wall backing; never pin the floating laminate. Trim and fixings remain pending in pricing.')];
  if(stage===42)return [item('Full-spread wood adhesive + plywood layer screws','Bond upper sheets to lower sheets; screw while adhesive cures. Select a plywood-compatible adhesive and clamp/fastener schedule. Do not fasten into the concrete.','floorGlue'),item('Screw pack selection pending','Keep heads flush and screw tips within the combined plywood thickness.','floorLayerScrews')];
  if(stage===25&&floor==='charcoal')return [item('Rapid Set SKIM FLOOR cement underlayment','Thin full-surface cement skim. Follow the product’s preparation and curing directions.','floorSeams')];
  if(stage===24)return [item('Floor-overlay fastening: specification pending','Use the venue-approved attachment/underlay detail. Do not drive screws into an unapproved existing floor.')];
  if(stage===25||stage===26||stage===27||stage===28||stage===37)return none('This is a surface preparation or coating step. Use the filler, seam fabric, primer or paint specified in the instructions.');
  if(stage===36)return [item('Vinyl corner-bead attachment per manufacturer','Use the selected bead’s specified attachment method; it is not an additional structural screw connection. Apply the listed mesh tape and setting compound.')];
  const p=platformPlan(cfg.angle??45,cfg.platformBack??12,cfg.platformSide??12,cfg.platformAngle),c=p.counts;
  if(stage===31)return [item('#9 × 3″ star-drive flat-head wood screws',`Two per rim corner joint and two at each joist end. ${c.rims*2+c.joists*4} planned for all platform frames.`,'platformFrameScrews',c.rims*2+c.joists*4)];
  if(stage===32)return [item('#9 × 3″ star-drive flat-head wood screws',`Four per leg through the rims, two per sill, plus two per leg resting on a sill. ${c.legs*4+c.sills*2+c.sillLegs*2} planned for the whole platform.`,'platformFrameScrews',c.legs*4+c.sills*2+c.sillLegs*2)];
  if(stage===33)return [item('#9 × 3″ star-drive flat-head wood screws','Join shared rims from inside the frames, about 12″ apart overall, staggered from both sides. Use the module seam allowance in the Pricing guide.','platformFrameScrews',p.frameScrews-(c.rims*2+c.joists*4+c.legs*4+c.sills*2+c.sillLegs*2))];
  if(stage===34)return [item('#8 × 2½″ flat-head wood screws',`Every 6″ around each larger deck perimeter and 12″ on interior rims and joists. ${p.deckScrews} planned for the whole platform. Heads slightly recessed; do not glue. Remove each spanning deck before separating its frames.`,'platformDeckScrews',p.deckScrews)];
  if(stage===35)return [item('½″ long, 18-gauge, ¼″ narrow-crown staples',`About 4″ apart into the rims, sills and legs. ${p.staples} planned for all fascia.`,'platformStaples',p.staples),item('Titebond III wood glue','Glue the fascia-to-frame contact surfaces.','platformGlue')];
  return none('Follow the step instructions.');
}
