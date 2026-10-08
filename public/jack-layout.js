// Keep the overall jack outline. Uprights now reach the floor; feet butt behind them.
export function jackLayout(height){
 const jackH=height===120?96:72,foot=height===120?48:36,jackBoardWidth=3.5;
 return {jackH,foot,jackBoardWidth,jackUprightLength:jackH,jackFootLength:foot-jackBoardWidth,
  // Three screws into the upright and three into the foot, inside the 8-inch gusset.
  gussetFixings:[[1.2,1.2],[1.2,3],[1.2,6],[4.5,1.2],[6,1.2],[4.5,3]]};
}
