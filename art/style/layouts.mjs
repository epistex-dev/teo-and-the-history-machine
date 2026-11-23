// Where the story stage puts things on each room plate (scene units = css px at scale 1 of the 390 x 840 portrait and 900 x 390 landscape art).
// Every number the engine needs comes from here: the stage fits the plate to the screen with one scale, feet on groundY above the dialogue box.
// keep: the part of the room's key furniture that must stay on screen on a short stage (x, y, w, h in art px); the stage lets Tèo and the machine step back toward the vanishing point vp to make room for it
// machine frame points (see machine.mjs): the cuckoo niche floor at (150, 96), the roof surface right of the apex at (205, 55)
const ride = (origin, s, local) => [origin[0] + local[0] * s, origin[1] + local[1] * s];
const portrait = ({ wall, keep, teoX = 98, machineX = 176, quado, vp = [195, 340] }) => {
  const origin = [machineX, 398], s = 0.66;
  return { size: [390, 840], top: 296, groundY: 622, vp, wall, keep,
    teo: { root: [teoX, 622], scale: 0.92 }, machine: { origin, scale: s },
    cuccu: { root: ride(origin, s, [150, 96]), scale: 0.52 }, quado: { root: quado ?? ride(origin, s, [205, 55]), scale: 0.52 } };
};
// landscape characters are larger than the first plates had them: Tèo's face is about 30 css px wide at 844 x 390
const landscape = ({ wall, teoX = 250, machineX = 540, quado, vp = [450, 128] }) => {
  const s = 0.62, origin = [machineX, 274 - 340 * s];
  return { size: [900, 390], top: 6, groundY: 274, vp, wall,
    teo: { root: [teoX, 274], scale: 0.78 }, machine: { origin, scale: s },
    cuccu: { root: ride(origin, s, [150, 96]), scale: 0.46 }, quado: { root: quado ?? ride(origin, s, [205, 55]), scale: 0.46 } };
};

export const LAYOUTS = {
  'ch1-office': { portrait: portrait({ wall: 486, keep: [118, 276, 124, 116] }), landscape: landscape({ wall: 214 }) },
  'ch2-feast': { portrait: portrait({ wall: 486, keep: [26, 392, 340, 140] }), landscape: landscape({ wall: 214 }) },
  'ch4-corridor': { portrait: portrait({ wall: 417, keep: [146, 298, 98, 106] }), landscape: landscape({ wall: 168 }) },
  'ch5-bethlehem': { portrait: portrait({ wall: 340, keep: [190, 282, 96, 72] }), landscape: landscape({ wall: 128 }) },
  'ch6-vault': { portrait: portrait({ wall: 418, keep: [150, 284, 130, 136] }), landscape: landscape({ wall: 168 }) },
  'ch7-harbour': { portrait: portrait({ wall: 422, keep: [4, 296, 256, 126] }), landscape: landscape({ wall: 171 }) },
  'ch8-yard': { portrait: portrait({ wall: 402, keep: [168, 322, 104, 92] }), landscape: landscape({ wall: 161 }) },
  'ch9-village': { portrait: portrait({ wall: 396, keep: [160, 300, 100, 110] }), landscape: landscape({ wall: 160 }) },
  'ch10-kitchen': { portrait: portrait({ wall: 470, keep: [150, 300, 170, 110], vp: [195, 302], quado: [335, 388], machineX: 186 }), landscape: landscape({ wall: 210, quado: [575, 97] }) },
  'ch11-parlour': { portrait: portrait({ wall: 372, keep: [160, 300, 200, 110], vp: [195, 234], quado: [309, 388] }), landscape: landscape({ wall: 143, vp: [450, 70], quado: [462, 132] }) },
  'ch12-street': { portrait: portrait({ wall: 377, keep: [150, 270, 220, 138], vp: [195, 300], quado: [335, 378] }), landscape: landscape({ wall: 193, quado: [515, 124] }) },
  'ch13-church': { portrait: portrait({ wall: 372, keep: [150, 274, 240, 134], vp: [195, 300], quado: [335, 372.5] }), landscape: landscape({ wall: 185, quado: [333, 175] }) },
  'ch14-iceland-kitchen': { portrait: portrait({ wall: 470, keep: [150, 296, 240, 110], vp: [195, 302], quado: [335, 388], machineX: 186 }), landscape: landscape({ wall: 210, quado: [510, 89] }) },
  'ch15-wool-workshop': { portrait: portrait({ wall: 470, keep: [150, 296, 240, 110], vp: [195, 302], quado: [285, 375], machineX: 186 }), landscape: landscape({ wall: 210, quado: [420, 92] }) },
  'ch16-print-shop': { portrait: portrait({ wall: 470, keep: [130, 296, 240, 110], vp: [195, 302], quado: [270, 384.1], teoX: 78, machineX: 186 }), landscape: landscape({ wall: 210, teoX: 170, quado: [425, 147] }) },
  'ch18-london-snow': { portrait: portrait({ wall: 377, keep: [14, 280, 376, 340], vp: [195, 300], teoX: 122, machineX: 196 }), landscape: landscape({ wall: 193, teoX: 125, keep: [166, 60, 560, 200] }) },
  'ch19-norway-yard': { portrait: portrait({ wall: 420, keep: [0, 282, 388, 138], vp: [195, 302], quado: [345, 384], teoX: 60, machineX: 125 }), landscape: landscape({ wall: 175, keep: [166, 60, 560, 150], quado: [500, 95] }) },
  'ch17-tio-corner': { portrait: portrait({ wall: 470, keep: [0, 300, 390, 240], vp: [195, 302], teoX: 144, machineX: 196 }), landscape: landscape({ wall: 210, teoX: 140 }) },
  'ch3-hall': { portrait: portrait({ wall: 440, keep: [110, 330, 170, 76], teoX: 96, machineX: 190, quado: [170, 598] }), landscape: landscape({ wall: 190, machineX: 540, quado: [135, 254] }) },
};
export const SCENES = Object.keys(LAYOUTS);
