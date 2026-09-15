// Reachable L/J cavities: rotate from spawn, soft drop, then press A.
// The old two-CW-turn implementation fails on the L fixture.
const rows=['..........','###...##..','.###...#.#','#.##..#.#.','.##...###.','##..####.#'];
module.exports=[
  {type:'L',rotation:1,x:3,y:18,afterX:4,afterR:3,rows},
  {type:'J',rotation:-1,x:4,y:18,afterX:3,afterR:1,rows:rows.map(row=>[...row].reverse().join(''))}
];
