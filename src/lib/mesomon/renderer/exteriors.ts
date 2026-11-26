import type { MapDefinition } from '../types';

type Point = [number, number];

/** Native raster shapes keep the steep rigging and the shallow roof ridges equally crisp. */
function pixels(ctx: CanvasRenderingContext2D) {
  function rect(color: string, x: number, y: number, width: number, height: number) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }
  function polygon(color: string, ...points: Point[]) {
    ctx.fillStyle = color;
    const ys = points.map(point => point[1]);
    for (let y = Math.min(...ys); y < Math.max(...ys); y++) {
      const cuts: number[] = [];
      points.forEach(([x1, y1], i) => {
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 > y + .5) !== (y2 > y + .5)) cuts.push(x1 + (y + .5 - y1) * (x2 - x1) / (y2 - y1));
      });
      cuts.sort((a, b) => a - b);
      for (let i = 0; i + 1 < cuts.length; i += 2) {
        const left = Math.ceil(cuts[i] - .5);
        ctx.fillRect(left, y, Math.ceil(cuts[i + 1] - .5) - left, 1);
      }
    }
  }
  function line(color: string, ...points: Point[]) {
    ctx.fillStyle = color;
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i - 1], [endX, endY] = points[i];
      const steps = Math.max(Math.abs(endX - x), Math.abs(endY - y));
      for (let n = 0; n <= steps; n++) {
        const t = steps ? n / steps : 0;
        ctx.fillRect(Math.round(x + (endX - x) * t), Math.round(y + (endY - y) * t), 1, 1);
      }
    }
  }
  return { ctx, rect, polygon, line };
}
type Paint = ReturnType<typeof pixels>;

const deep = '#364446', darkWood = '#584b3d', brass = '#c4a16c', bright = '#dbc397';

function post(p: Paint, x: number, foot: number, height: number) {
  p.polygon('#253e4188',[x-3,foot-1],[x+3,foot-1],[x+10,foot+3],[x+3,foot+4]);
  p.rect(darkWood,x-3,foot-height,6,height);
  p.rect('#a98a60',x-2,foot-height,2,height-1);
  p.rect('#7a6850',x,foot-height,2,height);
  p.rect('#4b5145',x-3,foot-4,6,2);
  p.polygon(brass,[x-4,foot-height],[x-2,foot-height-2],[x+2,foot-height-2],[x+4,foot-height],[x+2,foot-height+2],[x-2,foot-height+2]);
}

function lamp(p: Paint, x: number, base: number) {
  post(p,x,base,16);
  p.rect(deep,x-4,base-23,8,8);
  p.rect('#d6a562',x-3,base-22,6,5);
  p.rect('#f0ce84',x-2,base-22,3,4);
  p.rect('#91764e',x+1,base-22,1,5);
  p.polygon('#445953',[x-6,base-23],[x-2,base-28],[x+2,base-28],[x+6,base-23]);
  p.rect(brass,x-1,base-29,2,2);
}

function windowBank(p: Paint,x: number,y: number,panes: number) {
  const width=panes*8+3;
  p.rect('#7d705b',x+2,y+2,width,15);
  p.rect('#615d4e',x,y,width,15);
  for(let i=0;i<panes;i++) {
    const px=x+2+i*8;
    p.rect('#577879',px,y+2,6,10);
    p.rect('#79978c',px,y+2,6,4);
    p.line('#a8b6a0',[px,y+7],[px+4,y+3]);
    p.rect('#91856a',px,y+7,6,1);
  }
  p.rect('#ddc29a',x-1,y+13,width+2,2);
}

function sailboat(p: Paint,x: number,y: number) {
  // Across the water from the passenger ship, a small lugger is making port.
  p.polygon('#294d55',[x-2,y+2],[x+9,y+6],[x+27,y+4],[x+35,y-1],[x+29,y+7],[x+10,y+9]);
  p.polygon('#715942',[x-3,y-2],[x+7,y],[x+25,y-1],[x+36,y-6],[x+31,y+1],[x+24,y+4],[x+6,y+5]);
  p.line('#c8ad79',[x-2,y-2],[x+7,y+1],[x+23,y],[x+33,y-4]);
  p.line('#776e54',[x+13,y],[x+13,y-34]);
  p.polygon('#c7bd9a',[x+12,y-31],[x+11,y-6],[x-1,y-4]);
  p.polygon('#a5a58a',[x+16,y-27],[x+31,y-10],[x+15,y-6]);
  p.line('#ded0aa',[x+11,y-29],[x+4,y-10]);
}

function wayfarer(p: Paint) {
  // Build out from the existing collision rectangle. The pointed foredeck, colored
  // strakes and immersed stern lie in the surrounding water.
  p.ctx.save();
  p.ctx.beginPath();
  p.ctx.rect(0,0,256,224);
  p.ctx.rect(54,47,147,140);
  p.ctx.clip('evenodd');
  p.polygon('#294c52',[41,67],[53,37],[82,24],[125,8],[151,15],[193,31],[211,53],[218,157],[211,190],[189,205],[155,213],[85,213],[52,201],[39,179]);
  p.polygon('#3d4440',[42,63],[51,39],[79,23],[125,6],[157,15],[189,29],[207,45],[211,65],[211,177],[204,190],[183,200],[158,207],[80,207],[55,198],[43,186]);
  p.ctx.restore();
  p.polygon('#9d7955',[46,58],[56,39],[83,25],[125,10],[156,19],[186,33],[201,46],[205,61]);
  p.polygon('#c5a477',[53,53],[60,39],[84,27],[125,13],[153,21],[182,35],[196,46],[199,53]);
  for (const y of [28,34,40,46,52]) {
    const left = Math.max(55,125-(y-13)*3);
    p.rect('#a48664',left,y,Math.min(195,125+(y-13)*2)-left,1);
  }
  p.line('#f0cea0',[45,59],[53,40],[80,25],[125,8],[157,17],[188,31],[205,46]);
  p.line('#6c6650',[73,38],[83,31],[125,17],[167,30]);
  p.polygon('#5f4b3b',[42,60],[49,53],[54,53],[54,186],[65,193],[54,194],[43,183]);
  p.polygon('#6a4f3f',[201,52],[209,60],[209,180],[202,190],[191,195],[197,185]);
  p.polygon('#725140',[44,176],[61,185],[83,190],[166,191],[205,177],[202,190],[177,201],[157,205],[81,205],[54,197],[44,186]);
  p.polygon('#ad7352',[46,181],[62,188],[83,194],[163,195],[203,181],[201,185],[169,198],[157,200],[82,200],[55,192],[46,187]);
  p.line(brass,[46,179],[64,187],[83,191],[163,192],[201,178]);
  p.line('#d6b481',[47,58],[54,51],[54,175],[61,182],[83,187],[126,187]);
  p.line('#a18b6c',[146,188],[168,187],[196,177],[202,168],[202,57]);
  // A brass-capped capstan forward of the cabins, and a stowed spar above the roof.
  p.polygon('#796b50',[114,31],[128,29],[137,33],[126,37],[114,35]);
  p.rect('#895f40',117,23,11,10);
  p.rect('#c49a60',118,22,4,10);
  p.polygon(bright,[113,23],[117,19],[126,19],[131,22],[127,25],[118,26]);
  p.line(darkWood,[109,26],[133,19]);
  // Long deck planks and a teak hatch: flush fittings keep the crossing clear.
  for(let y=99;y<185;y+=7) {
    p.rect(y%2?'#916f50':'#977653',55,y,143,7);
    p.rect('#80644d',55,y+6,143,1);
    for(let x=64+(y%4)*10;x<194;x+=52) p.rect('#7e6249',x,y+1,1,5);
  }
  p.polygon('#745c46',[65,125],[97,125],[100,128],[100,149],[66,149]);
  p.rect('#bd996b',64,123,33,24);
  p.rect('#594d3b',66,125,29,19);
  for(let x=68;x<95;x+=5) p.rect('#a28258',x,126,3,17);
  for(let y=127;y<144;y+=5) p.rect('#af926c',67,y,27,2);
  p.rect('#c3a175',65,144,31,1);
  // Rope rail and bundled canvas run along the blocked perimeter.
  for(const x of [53,202]) {
    for (const y of [54,93,132,171]) {
      p.line(darkWood,[x,y-4],[x+1,y+14],[x,y+29]);
      p.line(brass,[x-1,y-6],[x,y+12],[x-1,y+29]);
      post(p,x,y,8);
    }
  }
  p.polygon('#544e40',[47,147],[54,144],[61,146],[61,168],[56,174],[47,171]);
  p.polygon('#a29a7d',[47,146],[52,143],[58,145],[59,168],[55,171],[48,168]);
  for (const y of [151,164]) p.rect('#706c54',47,y,12,2);
  // The gangway extends over the hull into the water rather than ending at the deck edge.
  p.polygon('#343f3c',[126,178],[145,178],[149,210],[144,218],[124,215]);
  p.polygon('#ad916c',[128,179],[142,179],[145,214],[127,211]);
  for(let y=184;y<213;y+=5) p.rect('#78654c',128,y,15,1);
  p.line('#dec492',[126,176],[125,210]);
  p.line('#b79a6e',[144,177],[147,214]);
  post(p,125,185,9); post(p,145,185,9);
  // High mast on the port cabin, with a split pennant and rigging into the chainplates.
  p.line('#736e59',[53,116],[75,79],[85,29],[110,79]);
  p.line('#b7ae88',[53,115],[75,78],[85,28]);
  p.rect('#6c5944',83,26,4,43);
  p.rect('#c3a172',83,26,1,41);
  p.polygon('#385c60',[85,26],[97,26],[109,20],[106,26],[112,28],[98,32],[85,32]);
  p.line('#a5b69b',[86,27],[95,27],[103,24]);
  sailboat(p,216,122);
}

/** The workshop's sawtooth glass lantern, copper ridge and tall loading arch
 * occupy its contiguous roof/wall footprint. The doorway faces the south plaza. */
function workshopFacade(p: Paint) {
  p.polygon('#46504b88',[64,200],[224,191],[233,207],[232,232],[221,243],[74,244],[65,236]);
  p.rect('#a39273',66,167,153,70);
  p.rect('#c0ad87',67,175,142,59);
  p.rect('#967e61',209,172,12,62);
  p.rect('#876e52',67,222,152,12);
  p.rect('#c0a37c',68,222,142,3);
  for(const x of [67,125,176,206]) {
    p.rect('#78654e',x,174,4,58);
    p.rect('#b89971',x,174,1,57);
  }
  windowBank(p,77,196,5); windowBank(p,180,198,3);
  // One broad roof reads as a tall workshop instead of many tiled blocks.
  p.polygon('#655348',[60,182],[75,112],[102,92],[199,92],[218,112],[225,182],[219,189],[66,189]);
  p.polygon('#ab6d53',[63,177],[78,114],[102,95],[194,95],[207,113],[215,177]);
  p.polygon('#935b49',[196,95],[213,111],[222,179],[215,180],[205,118]);
  for(let y=119;y<177;y+=8) {
    const left=78-Math.floor((y-114)/4), right=207+Math.floor((y-114)/8);
    p.rect('#8e5d4d',left,y,right-left,1);
    for(let x=left+((y%3)*6);x<right-4;x+=16) p.rect('#bc8060',x,y+1,5,1);
  }
  p.line('#d3966c',[65,177],[79,114],[102,95],[194,95],[210,111]);
  p.rect('#644d41',62,179,161,7);
  p.rect('#cc9672',63,179,157,2);
  p.rect('#806250',65,187,155,3);
  // Projecting zinc monitor, glazed to face the harbor.
  p.polygon('#755a49',[92,131],[102,108],[179,106],[188,132],[182,140],[96,142]);
  p.polygon('#506c69',[89,127],[101,104],[175,104],[184,125],[182,134],[91,134]);
  p.polygon('#7e9787',[91,125],[103,106],[173,106],[179,125]);
  p.rect('#395d61',93,126,87,7);
  for(let x=94;x<180;x+=10) {
    p.rect('#96ada0',x,126,7,3);
    p.rect('#c5b99b',x,126,1,7);
  }
  p.rect('#c7b08a',90,134,93,2);
  // Kiln stack: exposed red face, shaded return and rolled metal flue.
  p.polygon('#715746',[74,138],[74,95],[83,90],[92,94],[92,133],[85,139]);
  p.rect('#bd8662',75,95,9,41);
  p.rect('#987254',84,95,7,39);
  for(let y=101;y<134;y+=7) p.rect('#a37557',75,y,9,1);
  p.rect('#685a48',73,91,20,4);
  p.rect('#c89872',74,90,18,3);
  p.rect('#53635b',78,79,9,11);
  p.rect('#879180',79,79,2,10);
  p.rect('#a3a38a',76,77,13,3);
  // Deep arch and the shell of the recessed door line up with its live object.
  p.polygon('#76694f',[132,240],[132,208],[137,198],[144,193],[158,193],[168,198],[172,208],[172,240]);
  p.polygon('#d5bd92',[134,240],[134,207],[138,200],[145,195],[157,195],[166,200],[169,207],[169,240]);
  p.polygon('#554f40',[138,240],[138,208],[144,202],[150,200],[157,201],[164,207],[165,240]);
  p.rect('#8e7051',141,211,21,26);
  p.rect('#68827b',142,208,19,7);
  p.rect('#b2a384',151,208,2,7);
  p.rect('#bc9872',139,235,25,3);
  p.rect('#c6b090',135,238,33,3);
  // Suspended surveyor's sign: a brass divider above a tide line.
  p.line(darkWood,[170,193],[181,188],[195,188]);
  p.rect(brass,181,188,2,8); p.rect(brass,192,188,2,8);
  p.polygon('#475d57',[178,195],[197,195],[197,208],[187,213],[178,208]);
  p.line('#debd7a',[182,205],[187,198],[193,205]);
  p.line('#b3be9c',[181,207],[186,206],[192,207]);
}

function market(p: Paint) {
  // A long fish hall faces the open market. Its returned gable is visible at the east end.
  p.polygon('#48534b77',[305,198],[460,188],[475,206],[475,227],[313,231]);
  p.rect('#b29b76',306,165,151,54);
  p.rect('#86775f',449,162,12,55);
  p.polygon('#4a6560',[300,173],[312,129],[328,111],[442,111],[457,126],[466,173],[463,179],[300,179]);
  p.polygon('#738e7e',[302,171],[314,130],[328,114],[440,114],[449,130],[457,171]);
  for(const x of [323,346,369,392,415,438]) {
    p.line('#a1ac94',[x,116],[x-9,170]);
    p.line('#617b70',[x+1,117],[x-8,170]);
  }
  p.rect('#c0bea0',301,172,161,2);
  p.rect('#526158',302,175,161,5);
  // Three trade bays have differentiated wares: fish baskets, jars, folded cloth.
  for(let bay=0;bay<3;bay++) {
    const x=308+bay*49;
    p.rect('#635e4d',x,181,43,33);
    p.rect('#435e59',x+3,184,36,25);
    for(let i=0;i<5;i++){
      const px=x+4+i*7;
      if(bay===0) {
        p.polygon('#a1b6a5',[px,203],[px+4,200],[px+7,201],[px+5,204],[px+2,204]);
      } else if(bay===1) {
        p.rect('#b27856',px+1,200-(i%2)*3,4,7+(i%2)*3);
        p.rect('#c79966',px+2,198-(i%2)*3,2,3);
      } else {
        p.rect(i%2?'#a89873':'#8aa294',px,202-i%3,6,5);
        p.rect('#c9b58e',px,202-i%3,6,1);
      }
    }
    p.rect('#b28e64',x,207,43,4);
    p.rect('#887052',x+2,211,39,6);
    p.rect('#75614b',x+3,217,3,4); p.rect('#75614b',x+37,217,3,4);
    const fabric=[['#aa694d','#d8b185'],['#527e76','#d5c59d'],['#b3935d','#ded0aa']][bay];
    for(let i=0;i<7;i++){
      const start=x-2+i*7;
      p.polygon(fabric[i%2],[start,177],[start+7,177],[start+6,190],[start-1,190]);
      p.rect(i%2?'#ab997a':bay===0?'#935a48':'#5e7061',start-1,190,7,3);
    }
  }
  // Ridge ventilators separate the hall silhouette from the workshop skyline.
  for(const x of [344,399]){
    p.rect('#59665b',x,103,14,11); p.rect('#8c9a83',x+1,103,3,10);
    p.polygon('#a3ae95',[x-4,103],[x+4,98],[x+10,98],[x+18,103]);
    p.rect('#acb298',x-2,103,18,1);
  }
}

function harbor(p: Paint, map: MapDefinition) {
  // Swept stone carriage lanes meet at the district map. Narrow brick gutters and
  // flush brass route studs guide travel without implying new collision bounds.
  p.ctx.save();
  p.ctx.beginPath();
  for(let y=0;y<map.height;y++) for(let x=0;x<map.width;x++) {
    if(map.tiles[y][x]==='stone') p.ctx.rect(x*16,y*16,16,16);
  }
  p.ctx.clip();
  const lane=(x:number,y:number,w:number,h:number) => {
    p.rect('#879189',x,y,w,h);
    for(let row=y;row<y+h;row+=11){
      p.rect('#78867e',x,row,w,1);
      for(let col=x+((row-y)%22?8:23);col<x+w;col+=34) {
        p.rect('#77847d',col,row+1,1,Math.min(10,y+h-row-1));
      }
    }
  };
  lane(132,237,39,132); lane(132,336,401,32); lane(404,354,38,70);
  p.rect('#b3ad94',133,239,2,94); p.rect('#b3ad94',171,239,2,97);
  p.rect('#adab93',133,367,269,2); p.rect('#adab93',173,335,354,2);
  p.rect('#ada68a',403,371,2,49); p.rect('#ada68a',442,370,2,55);
  p.ctx.restore();
  workshopFacade(p); market(p);
  // Stone abutments and rails frame the stair mouth. The walkable approach stays open.
  for(const x of [514,581]){
    p.rect('#465955',x,310,6,66);
    p.rect('#acb29c',x,310,2,65);
    for(const y of [310,335,371]) post(p,x+2,y,8);
  }
  p.polygon('#506a65',[547,329],[547,313],[550,307],[557,301],[571,301],[577,306],[581,312],[581,329]);
  p.polygon('#adaf97',[549,331],[549,313],[553,307],[559,304],[570,304],[576,309],[579,314],[579,331]);
  p.polygon('#445654',[553,332],[553,315],[558,310],[564,308],[571,311],[575,315],[575,332]);
  p.line('#c2b591',[558,305],[559,310]);
  p.line('#c2b591',[570,305],[569,310]);
  lamp(p,581,340);
  // Piers, mooring stations and a ferry pennant distinguish arrival from the fish landing.
  for(const [x,y] of [[385,487],[463,488],[385,538],[463,538],[50,505],[124,506],[232,458],[324,459]]) post(p,x,y,8);
  const flagX=464,flagY=510;
  p.line('#615744',[flagX,flagY+11],[flagX,flagY-30]);
  p.line('#c7b28b',[flagX-1,flagY+10],[flagX-1,flagY-30]);
  p.polygon('#547e77',[flagX,flagY-29],[flagX+11,flagY-27],[flagX+21,flagY-29],[flagX+17,flagY-24],[flagX+20,flagY-21],[flagX+9,flagY-20],[flagX,flagY-22]);
  p.line('#dfc596',[flagX+3,flagY-26],[flagX+9,flagY-24],[flagX+15,flagY-25]);
  // Brass-strapped loading strips remain flush with the planking.
  for(const y of [467,495,524]) {
    p.rect('#7b654f',394,y,59,3); p.rect('#ac936c',394,y,59,1);
    for(const x of [396,449]) p.rect('#d1b183',x,y+1,2,1);
  }
  // Hanging nets below the fish landing, in the water beyond the walkable edge.
  for(let i=0;i<10;i++) {
    const x=55+i*6;
    p.line('#8c9177',[x,514],[x+5,522],[x+10,525],[x+15,514]);
    p.line('#748574',[x,521],[x+5,515]);
  }
  lamp(p,387,465);
  // Cleats and mooring lines attach the existing moored skiff to actual pier hardware.
  p.line('#aa9471',[380,503],[383,493],[386,488]);
  p.line('#9f8a6c',[349,522],[367,529],[384,536]);
  // North passage gate piers continue the wall while leaving its road visible.
  for (const x of [254,326]) {
    p.rect('#736f5e',x,50,9,27);
    p.rect('#ada58a',x,50,3,25);
    p.rect('#c5b899',x-2,47,13,4);
  }
  p.line('#66776b',[263,50],[283,56],[305,55],[326,49]);
  for (const [x,y] of [[271,53],[283,55],[296,54],[309,53]]) {
    p.polygon('#a27f59',[x,y],[x+5,y+1],[x+2,y+7]);
  }
}

/** Painted once into the terrain texture, before world objects and travelers. */
export function paintExteriors(ctx: CanvasRenderingContext2D,map: MapDefinition) {
  if (map.id === 'ship') wayfarer(pixels(ctx));
  if (map.id === 'harbor') harbor(pixels(ctx),map);
}
