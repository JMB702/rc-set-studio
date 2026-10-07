// Screw-only side lap between two actual 3/4-inch boards. This is a prototype
// fastening schedule, not a tested structural capacity or a like-for-like rating.
export function jackAttachment(height){
 return {
  attachmentDepth:height===120?4.625:2.625,
  attachmentHeights:height===120?[12,26,40,54,68,82]:[12,22,32,42,52,62],
  attachmentScrewLength:1.25,
  attachmentMemberThickness:.75,
 };
}
