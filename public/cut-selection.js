const panelParts={
 'Outer stiles':/^(Left|Right) stile$/,
 'Top + bottom rails':/^(Top|Bottom) rail$/,
 'Toggles':/^Toggle /,'Skin seam backer':/^Wide skin-seam backer$/,
 'Lower skin':/^Lower lauan skin$/,'Upper skin':/^Upper lauan skin$/,
 'Jack uprights':/ jack upright$/,'Jack feet':/ jack foot$/,
 'Diagonal blanks':/ diagonal$/,'Corner gussets':/ gusset$/,
 'Shelf crossbars':/^Shelf crossbar$/,'Ballast shelf':/^Ballast shelf$/,
 'Jack attachment screws':/^Jack attachment screw$/,
};
export function matchesCutPart(selection,name,length){
 if(selection.family==='panel')return panelParts[selection.part]?.test(name)||false;
 const names={'Rim':'Platform rim','Joist':'Platform joist','Leg':'Platform leg','Leg on sill':'Platform leg on sill','Sill':'Platform sill','Decks':'Platform deck','Fascia strips':'Platform fascia'};
 if(name!==names[selection.part])return false;
 return selection.length==null||Math.round(length*16)===Math.round(selection.length*16);
}
