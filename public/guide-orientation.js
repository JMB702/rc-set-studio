// Flip the flat across its long axis; the top always points away from the viewer.
export function benchPanelPose(height,depth,skinUp=false){return {xAxis:skinUp?[1,0,0]:[-1,0,0],yAxis:[0,0,-1],zAxis:skinUp?[0,1,0]:[0,-1,0],position:[skinUp?-24:24,skinUp?depth+.106:0,0],min:[-24,0,-height],max:[24,depth+.106,0]};}
