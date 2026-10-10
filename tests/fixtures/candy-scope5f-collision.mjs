// Distinct accepted JSON graphs with the same short Hypergraph change marker.
export const collisionA = [
  {id:'h0',vertices:['A','B'],time:'00011dd6',weight:1,attributes:{}},
  {id:'h1',vertices:['B','C'],time:null,weight:1,attributes:{}},
  {id:'h2',vertices:['C','A'],time:null,weight:1,attributes:{}},
];
export const collisionB = [
  {id:'h0',vertices:['A','B'],time:'00002427',weight:1,attributes:{}},
  {id:'h1',vertices:['B','C'],time:null,weight:1,attributes:{}},
  {id:'h2',vertices:['D','E'],time:null,weight:1,attributes:{}},
];
export const dynamicCollisionA = collisionA.map(e => ({...e, time:e.id==='h0'?'000039f3':e.time}));
export const dynamicCollisionB = collisionB.map(e => ({...e, time:e.id==='h0'?'000002a7':e.time}));
