// Browser-only probes for the real chapter walkthrough. Capture the Phaser output
// rather than its sprite indices so an upside-down, mirrored or missing frame fails.
export async function trackBattleSprites(page, opponent) {
  return page.evaluate(async ({ opponent }) => {
    const screen = document.querySelector('.mesomon canvas');
    const image = new Image();
    image.src = '/games/mesomon/creature-battle-v1.png';
    await image.decode();
    const size = 192;
    if (image.naturalWidth !== size * 4 || image.naturalHeight !== size * 5) throw Error('Unexpected encounter sheet dimensions');
    const sheet = document.createElement('canvas');
    sheet.width = image.naturalWidth;
    sheet.height = image.naturalHeight;
    const context = sheet.getContext('2d', {willReadFrequently: true});
    context.drawImage(image, 0, 0);
    const rows = ['rillik','muddren','gleamwing','tressel','rift-wretch'];
    const poses = ['rest','ready','action','recoil'];
    const actors = [
      {name: 'rillik', left: 21 * 4, top: 50 * 4, mirror: false},
      {name: opponent, left: 92 * 4, top: 19 * 4, mirror: true},
    ];
    for (const actor of actors) {
      const row = rows.indexOf(actor.name) * size;
      actor.samples = poses.map((_, pose) => {
        const data = context.getImageData(pose * size, row, size, size).data;
        const sample = [];
        for (let y = 3; y < size; y += 7) for (let x = 2; x < size; x += 7) {
          const i = (y * size + x) * 4;
          if (data[i + 3] === 255) sample.push([actor.mirror ? size - 1 - x : x, y, data[i], data[i+1], data[i+2]]);
        }
        if (sample.length < 24) throw Error('Missing opaque creature artwork for ' + actor.name);
        return sample;
      });
    }
    const seen = {rillik: {}, [opponent]: {}};
    const closest = {};
    const live = screen.getContext('2d');
    const captures = {};
    const stopAt = performance.now() + 25000;
    const margin = 24;
    const side = size + 2 * margin;
    // Native walk, lunge and recoil offsets, in logical pixels. Try only these
    // positions so a frame drawn on the wrong platform cannot pass by chance.
    const offsets = [[0,0],[-2,0],[5,-2],[3,-2],[1,0],[-4,-1],[-2,-1]];
    let frame = 0;
    function sample() {
      if (!screen.isConnected || screen.width !== 640 || screen.height !== 576 || performance.now() >= stopAt) return;
      for (const actor of actors) {
        const pixels = live.getImageData(actor.left - margin, actor.top - margin, side, side).data;
        let best = 0, bestPose = -1;
        for (let i = 0; i < poses.length; i++) {
          for (const [dx, dy] of offsets) {
            let matches = 0;
            for (const [x, y, red, green, blue] of actor.samples[i]) {
              const index = 4 * ((y + margin + dy * 4) * side + x + margin + dx * (actor.mirror ? -4 : 4));
              if (Math.abs(red - pixels[index]) <= 1 && Math.abs(green - pixels[index+1]) <= 1 &&
                  Math.abs(blue - pixels[index+2]) <= 1) matches++;
            }
            const score = matches / actor.samples[i].length;
            if (score > best) { best = score; bestPose = i; }
          }
        }
        if (!closest[actor.name] || best > closest[actor.name].score) closest[actor.name] = {pose: poses[bestPose], score: best};
        if (best > .94) {
          const pose = poses[bestPose];
          seen[actor.name][pose] = Math.max(seen[actor.name][pose] ?? 0, best);
          // Copy the frame now and encode it after the turn to leave timing intact.
          if (opponent === 'tressel' && (pose === 'action' || pose === 'recoil')) {
            const name = actor.name + '-' + pose;
            if (!captures[name]) {
              const still = document.createElement('canvas');
              still.width = screen.width;
              still.height = screen.height;
              still.getContext('2d').drawImage(screen, 0, 0);
              captures[name] = still;
            }
          }
        }
      }
      frame = requestAnimationFrame(sample);
    }
    window.mmCreatureProbe?.stop();
    window.mmCreatureProbe = {
      seen, closest, stop: () => cancelAnimationFrame(frame),
      stills: () => Object.entries(captures).map(([name, still]) => [name, still.toDataURL('image/png')]),
    };
    sample();
  }, {opponent});
}
