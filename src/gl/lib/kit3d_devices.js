/* The Kit's four devices: one config each for the shared runtime (./kit3d.js). Pure data (no imports), so the stage scene
   (src/gl/scenes/kit3d.js) and the labs read the same file. Each config came from its device's folder
   (.lab/kit3d/<device>/<device>3d.js; the console's from its fork's KEYS + DEVICE tables) and is unchanged in look.
   DEVICES[dev] = { config, base, label }: dev is kit.html's data-td-dev (own ids, so tdcore's photoreal extents
   (TD_EXT) and frame sets never apply to a 3D shot). base: the GLBs (public/assets/models/<device>/). */
// The console (.lab/kit3d/mixer: its own fork, mixer3d.js, folded here as the 'console' dialect; the same look). Axes: +Y
// up, +Z the front edge (the faders' end), 1 unit = 200 mm. az 0 faces the front panel, +90 the right side. The explode
// lifts the layers straight up in mixerB's order (knobs, faceplate with its caps, pads and keys, the display stepping
// forward 75 mm, the pad matrix, the fader bank, the main board) off the chassis, which stays.
const MIXER = {
  root: 'mixer', file: 'mixer.glb', mobileFile: 'mixer_mobile.glb', unitsMM: 200,
  dialect: 'console',
  // view keys (mixer3d.js KEYS): the hold (r2) az 21, el 17.5, so each layer reads as a slab with a readable gap (mixerB);
  // fill 0.89 x the settle push (1.035) = 0.92, as the camera's hold
  keys: {
    wide: {
      start: { az: -150, el: 32, fov: 20, fill: 0.60 },
      hero: { az: 32, el: 21, fov: 20, fill: 0.80 },
      column: { az: 24, el: 24, fov: 19, fill: 0.84 },
      exploded: { az: 21, el: 17.5, fov: 18, fill: 0.89 },
    },
    tall: {
      start: { az: -150, el: 34, fov: 22, fill: 0.84 },
      hero: { az: 24, el: 32, fov: 21, fill: 0.92 },
      column: { az: 20, el: 26, fov: 20, fill: 0.86 },
      exploded: { az: 16, el: 20, fov: 20, fill: 0.89 },
    },
  },
  settlePush: 0.035, fillMax: 1,                           // (the fork's push, unclamped: 0.89 x 1.035)
  fitInstancedMax: Infinity,                               // its screws and leads join the fit (the fork's)
  nocast: /^(screws)$/,
  shadowBox: 2.0,
  // the internals' shadows on the tray fade as they lift away (an open tray reads as a lit satin tub, mixerB)
  shadowFade: { parts: /^(display|pad_matrix|fader_bank|main_board)$/, t: [0.55, 0.9], k: 0.7, castUntil: 0.6 },
  reveal: { chassis: 'main_board' },                       // the chassis does not move: the main board lifting out of it reveals it
  special: { glow: 'glow', glow_top: 'glow', cover_glass: 'sheenGlass', screen: 'lcd', pcb: 'board' },
  glowSep: { part: 'pad_matrix', a: 'faceplate', b: 'pad_matrix', mm: 8 },   // the LEDs' halo on the board shows as the plate lifts off them
  // the console's uber dialect: satin grain, turned tops' radial streak, brushing; the backlit keys' HDR radiance (vertex
  // colour x emission x emit), the additive spill round the lit keys and the LEDs (glow), the LCD's UI (screen)
  // (the runtime's defaults: grainScale 0.055, grainStr 0.022, turn 0.12, turnSlope 0.32, brush 1, emit 2, glow 0.34, screen 1.25)
  console: {
    // p5 (it holds up at a 3x zoom): the fader caps' brushing 3-4x finer, gloss only (r4's coarse, per-line albedo and
    // height read as wood veneer); the knurl's facets blend into its smooth normal + roughness once a pyramid is under
    // ~3.5-8 px (no sparkle in motion or at the hold, full facets close up); geometric specular AA
    brushLines: [0.015, 0.05, 0.16], brushRough: 0.2, brushAlbedo: 0.0, brushNormal: 0.045,   // (brushSlope: the default 0.10)
  },   // (knurl AA from a 2 mm pitch over 3.5-8 px, roughness 0.12; specAA 2: the console dialect's defaults)
  // the cover glass's sheen: one long softbox (studio frame), analytic so its edge stays crisp; at the hero its edge crosses
  // the glass diagonally (from the back edge, 45% across, to the front edge, 70% across), as in mixerA3
  sheen: { dir: [0.3894, 0.5706, -0.723], u: [-0.6999, 0.6936, 0.1705], len: 0.5, wid: 0.075, soft: 0.003, i: 2.1 },
  // one tall strip box at view az ~+100 (studio frame), where the wedge's right wall mirrors the hero's view (el about
  // -20): its reflection gives the wall mixerA3's cool satin gradient, brighter at the top (two stacked cards)
  envExtra: [                                              // (look: the default, the origin)
    { w: 3.0, l: 3.6, pos: [6.6, -1.9, 0.7], along: [0, 1, 0], k: 9.0, tint: 0xc9d8e8 },
    { w: 2.2, l: 2.4, pos: [6.95, -0.6, 0.45], along: [0, 1, 0], k: 7.5, tint: 0xd6e2ee },
    { w: 4.0, l: 2.5, pos: [3.53, 3.75, -6.12], along: [1, 0, 0], k: 3.4 },   // p5: a soft card behind, the plate's back-left lifts
  ],
  // p5: a dim ring round the horizon, below it: the walls mirror it at every azimuth, so the wedge reads off the black
  // stage through the orbit (r4: the orbit's walls 33/255, the front band 10); the chassis' AO ramps the foot down
  envBand: [{ y0: -6.3, y1: -1.6, k: 2.0, top: 1, bot: 0.4 }],
  // the camera v5 studio with the console's deltas: full albedo (its satin anodising is lighter than the camera's
  // leatherette), a softer key (on the broad dark plate the camera's 10 read as a silver flood), no warm kicker and no warm
  // kicker card (they turned the wedge's right wall orange: mixerA3's is cool satin)
  // p5: the rim light low and to the left (studio frame; the camera's [0.8, 4.4, -6.0]): at the hero (el 21) the satin
  // plate mirrored it as a cool silver flood over its front-left (196/255, B 10 over R; the hero's median 98 against the
  // family's 33)
  light: { albedo: 1.0, key: 7.5, kick: 0.0, kickPanel: 0.0, rimPos: [-2.5, 2.4, -6.2] },
};

// The microphone (.lab/kit3d/mic/mic3d.js)
const MIC = {
  root: 'mic', file: 'mic.glb', mobileFile: 'mic_mobile.glb', unitsMM: 220,
  keys: {
    wide: {
      start: { az: 60, el: 18, fov: 16, fill: 0.72 },      // a front three-quarter: the brass ring, the near knob, the yoke arm
      hero: { az: 127, el: 8, fov: 14, fill: 0.72 },       // micA: rear three-quarter, the XLR face and the knob (the camera's hero scale)
      column: { az: 130, el: 11, fov: 15, fill: 0.78 },
      exploded: { az: 132, el: 16, fov: 16, fill: 0.92 },  // micB: the parts along a diagonal, the yoke's U below (4% margins)
    },
    tall: {
      start: { az: 60, el: 18, fov: 18, fill: 0.86 },
      hero: { az: 132, el: 12, fov: 16, fill: 0.86 },
      column: { az: 132, el: 14, fov: 16, fill: 0.86 },
      exploded: { az: 132, el: 18, fov: 18, fill: 0.90 },
    },
  },
  tilt: { wide: 11, tall: 36 },                            // phones: a diagonal like micA, not upright
  tiltEx: { wide: 24, tall: 20 },                          // the exploded line eases to a steeper diagonal: it fills the near-square column (phones: ~40 degrees across the width)
  tiltExWideSlot: 11,                                      // ... but a 16:9 slot (a full-frame explode) keeps the long micB diagonal
  roll: { wide: -40, tall: -40 },                          // the yoke plane rolled: the far arm shows above the body (micA)
  yaw: { wide: 0, tall: 0 },
  // the choreography (mm, along the mic's own axes; micB's order: windscreen, grille, diaphragm, voice coil; then the XLR
  // insert slides out rearward through the yoke's eyelet, then the yoke drops and turns its U to the view)
  explode: {
    windscreen: { ex: [0, 0, 150], t: [0.00, 0.30] },
    grille: { ex: [0, 0, 98], t: [0.05, 0.36] },
    diaphragm: { ex: [0, 0, 72], t: [0.10, 0.42] },
    voice_coil: { ex: [0, 0, 58], t: [0.14, 0.46] },
    shock_mount: { ex: [0, 0, 30], t: [0.18, 0.52] },
    magnet: { ex: [0, 0, -3], t: [0.18, 0.52] },             // rides in the shock mount (nested, as in micB), a little proud
    xlr: { ex: [0, 0, -72], t: [0.30, 0.62] },
    yoke: { ex: [62, -80, 4], rot: [-22, 0, -15], t: [0.44, 0.80] },   // drops below the body, its U turned to the view (micB)
    screws: { t: [0.50, 0.84] },
    pcb: { ex: [0, 0, -50], t: [0.52, 0.88], scale: 1.25 },
    contacts: { ex: [-4, -22, -44], t: [0.56, 0.90] },          // three loose gold contacts out of the insert (micB's sparkle)
  },
  parent: { magnet: 'shock_mount', contacts: 'xlr' },
  faceView: { shock_mount: 38, diaphragm: 25, voice_coil: 25 },   // the internals turn their faces to the exploded view
  portraitEx: { diaphragm: [0, 0, 72], voice_coil: [0, 0, 42] },   // phones: the coil further from the diaphragm (their markers 28 px apart)
  portraitScale: 0.9,
  portraitNoRot: [],
  reveal: { body_tube: null, yoke_mount: 'yoke', xlr_connector: 'xlr' },
  leads: { windscreen: 'nw', capsule_grille: 'n', diaphragm: 'ne', voice_coil: 'sw', yoke_mount: 'sw', xlr_connector: 'n' },
  leadsTall: { voice_coil: 'w' },
  nocast: /^(diaphragm|voice_coil|magnet|pcb|screws|contacts)$/,
  special: { mylar: 'mylar', cloth: 'cloth' },
  metalParts: /^(magnet|grille)$/,                         // the pole face and the grille's polished bands see their own studio card
  metalCard: { pos: [-1.5, 1.5, 6.5], size: [16, 12], card: 0.9, strip: 1.2, key: 0.6 },   // (camera v5's bayonet / iris card, placed behind the view: a face turned to it mirrors it)
  metalEnv: 1.25,
  shadowBox: 2.2,
  tileA: 'foam',
  knurlMM: 1.1, foamTileMM: 7, foamSkinMM: 0.12, foamSkinRimMM: 0.45, foamSheen: 0.07, foamSpec: 0.3, foamCav: [0.42, 1.38], foamRoughMin: 0.55,
  brushStr: 0.09, brushRough: 0.3, brushEnv: 1.6,
  // the camera v5 studio, tuned for the mic against micA (tone.py; hero p90 112 vs micA 125, warm 11% vs 9%, cool 11% vs
  // 15%): a brighter, slightly cooler key softbox, more env, a stronger rim and overhead strip, +8% exposure, crisper edge sheen
  light: { albedo: 1.0, expRamp: 0.06, exposure: 1.08, key: 12, env: 0.75, softbox: 2.2, softboxTint: 0xeef3ff, rim: 4.5, overhead: 6.5 },
  edgeSheen: 0.62,
};

// The headphones (.lab/kit3d/headphones/headphones3d.js)
const HEADPHONES = {
  root: 'headphones', file: 'headphones.glb', mobileFile: 'headphones_mobile.glb', unitsMM: 220,
  keys: {
    wide: {
      start: { az: -58, el: 16, fov: 16, fill: 0.74 },     // from behind cup A, round past its cap (az 0) to the front
      hero: { az: 50, el: 7, fov: 14, fill: 0.86 },        // hpA: cup A's cap three-quarter, cup B's cushion
      column: { az: 46, el: 4, fov: 15, fill: 0.88 },      // the Kit's arrival (shot 2 has no orbit): hpA's pose, the band's underside
      exploded: { az: 64, el: 9, fov: 14, fill: 0.96 },    // hpB: the parts on one level line off cup A
    },
    tall: {
      start: { az: -50, el: 16, fov: 18, fill: 0.84 },
      hero: { az: 44, el: 9, fov: 16, fill: 0.86 },
      column: { az: 46, el: 8, fov: 16, fill: 0.86 },
      exploded: { az: 58, el: 14, fov: 16, fill: 0.96 },
    },
  },
  fillMax: 0.96,
  // the choreography (mm along cup A's own axes) is the GLB's extras (build_hp.py, E): outside in, the outer cap, its
  // bronze bezel, the ear cup, the driver (it turns 118 deg so its diaphragm squares to the exploded view), the baffle;
  // the cushion stays seated on the yoke's base ring and eases 8 mm off it; then the leather headband lifts. (p5: the
  // config's copy of those numbers, and the default tilt / roll / yaw, portraitNoRot and reveal, are gone: the lazy JS)
  // phones: the parts step down a diagonal under cup A (the screws follow the cap: node offset = the cap's - their own share)
  // (p5: the steps 15% wider, so each part shows at least ~3/4 of itself; the screws ride just out of the cap)
  portraitEx: {
    outer_cap: [0, -225, 133], bezel: [0, -205, 120], ear_cup: [0, -182, 106], driver: [0, -127, 74],
    baffle: [0, -81, 48], cushion: [0, 0, -8], headband: [0, 24, 0], screws: [0, -225, 24],
  },
  portraitScale: 0.65,
  portraitRot: { driver: [0, -122, 0] },
  leads: { outer_cap: 'nw', ear_cup: 'n', driver: 's', baffle: 'n', cushion: 's', headband: 'ne' },   // alternating round the line
  leadsTall: { driver: 'e', ear_cup: 'w' },
  nocast: /^(screws|driver|baffle)$/,
  special: { mylar: 'mylar' },
  mylarEnv: 0.45,                                          // p5: an opaque satin metallised film now (it was the brightest thing at the hold)
  // the sliders and blocks (satin aluminium, brushed steel) see the 'metal' studio: one broad soft card where a face along
  // the cup axis mirrors it from the hero / column view (hpA's bright left slider)
  metalParts: /^sliders$/,
  metalCard: { pos: [-10.0, -0.8, -8.4], card: 0.7, strip: 1.2, key: 0.6 },   // (studio frame: the mirror of the column / hero view off a +Z face)
  metalEnv: 1.0,
  shadowBox: 2.1,
  tileA: 'foam',
  // p5: protein leather, not vinyl: the pebble grain at ~0.5 mm (a 14 mm tile; the 3 mm one never resolved, even at 3x),
  // a softer, wider specular (0.8 drew a hard band), a little more roughness; geometric specular AA on every face
  foamTileMM: 14, foamStr: 0.45, foamSheen: 0.08, foamSpec: 0.6, foamRoughMin: 0.5,   // (no skin; foamCav the default [0.18, 1.65])
  specAA: 1.0,
  // the camera v5 studio, tuned for the headphones against hpA at the Kit's arrival (column key; tone.py: median 49 vs
  // hpA 51, p75 69 vs 74): full albedo, +14% exposure, more environment and a larger, brighter key softbox and overhead
  // strip (the leather's broad sheen, the bronze's lower half)
  light: { albedo: 1.0, exposure: 1.14, env: 0.75, softbox: 2.2, overhead: 5.0, expRamp: 0.05 },   // (a gentler explode ramp: the pads stay black at the hold)
};

// The phone (.lab/kit3d/phone/phone3d.js)
const PU = 220;                                             // mm per model unit
// phoneB's grouping (mm, post-mirror, the phone's own axes): the front pair steps forward and left, the rear groups
// step back and right (a wider step, so the battery and the rear glass each show most of their faces past the frame)
function groups({ cover, display, battery, rear, coil = 8, cam = [0, 0, 14], board = 3 }) {
  const plus = (a, b) => a.map((v, k) => v + b[k]);
  return { cover_glass: cover, display, logic_board: [0, 0, board], battery, rear_glass: rear,
    charging_coil: plus(rear, [0, 0, coil]), camera_module: plus(rear, cam) };
}
const DESK = groups({ cover: [-24, -18, 42], display: [-12, -9, 21], battery: [24, 2, -28], rear: [42, 14, -54], cam: [4, -12, 14] });
const TALL = groups({ cover: [-12, -36, 40], display: [-6, -18, 20], battery: [12, 20, -26], rear: [24, 40, -50], cam: [4, -12, 14] });

const PHONE = {
  root: 'phone', file: 'phone.glb', mobileFile: 'phone_mobile.glb', unitsMM: PU,
  keys: {
    wide: {
      start: { az: 214, el: 8, fov: 16, fill: 0.85 },      // a rear three-quarter: the frosted glass, the plateau, the band
      hero: { az: 24, el: 26, fov: 15, fill: 0.82 },       // phoneA3: lying back, the display, the button side, the bottom edge
      column: { az: 26, el: 26, fov: 15, fill: 0.80 },     // the Kit's arrival (the phone shot has no orbit)
      exploded: { az: 40, el: 10, fov: 16, fill: 0.88 },   // phoneB: five groups, overlapping, climbing to the right (4-5% margins after the settle)
    },
    tall: {
      start: { az: 214, el: 8, fov: 18, fill: 0.84 },
      hero: { az: 26, el: 30, fov: 17, fill: 0.80 },
      column: { az: 26, el: 30, fov: 17, fill: 0.80 },
      exploded: { az: 40, el: 20, fov: 18, fill: 0.86 },
    },
  },
  fillMax: 0.92,
  tilt: { wide: 64, tall: 64 },
  roll: { wide: -12, tall: -12 },
  yaw: { wide: 0, tall: 0 },
  poseStart: { wide: { tilt: 10, roll: -22 }, tall: { tilt: 10, roll: -10 } },   // upright from behind
  poseEx: { wide: { tilt: 0, roll: -28, t0: 0.0, t1: 0.75 }, tall: { tilt: 0, roll: -8, t0: 0.0, t1: 0.75 } },   // it stands up as it comes apart
  // the choreography (overrides the GLB's extras: mm, post-mirror). Rear parts leave back to front (the rear glass
  // first), front parts front to back; the board stays seated in the frame (3 mm proud)
  explode: {
    cover_glass: { ex: DESK.cover_glass, t: [0.00, 0.46] },
    display: { ex: DESK.display, t: [0.06, 0.52] },
    logic_board: { ex: DESK.logic_board, t: [0.40, 0.90] },
    battery: { ex: DESK.battery, t: [0.24, 0.78] },
    rear_glass: { ex: DESK.rear_glass, t: [0.00, 0.60] },
    charging_coil: { ex: DESK.charging_coil, t: [0.10, 0.70] },
    camera_module: { ex: DESK.camera_module, rot: [0, 180, 0], rotT: [0.25, 1.0], t: [0.06, 0.66], scale: 1.22 },
  },
  portraitEx: Object.fromEntries(Object.entries(TALL).map(([k, v]) => [k, v.map((x) => x)])),
  portraitScale: null,
  portraitNoRot: [],
  reveal: { frame: null },
  leads: { display: 'nw', logic_board: 'ne', battery: 'sw', charging_coil: 's', camera_module: 'ne', rear_glass: 'se', frame: 'e', cover_glass: 'n' },
  leadsTall: { logic_board: 'n', battery: 's' },
  fitTransparent: true,
  hugDepth: true,
  nocast: /^(cover_glass)$/,
  hideAssembled: /^(logic_board|battery|charging_coil)$/,   // sealed inside while closed: not drawn (performance; the prewarm poses exploded)
  special: { cover_glass: 'glass', sapphire: 'sapphire', screen: 'screen', pcb: 'pcb', lens_coat: 'mylar', lens_violet: 'mylar' },
  mylarEnv: 1.4, sapphireEnv: 1.6, glassEnv: 1.0, pcbEnv: 0.9,
  studios: ['coat'], mylarEnvMap: 'coat', coatDome: 0x3c3c4a,   // the coated elements (lens_coat, lens_violet) see a dim dome: their thin film always shows
  // the board (its lids, chips and faces) sees its own studio at the hold: one broad soft card where its face, turned to
  // the exploded view, mirrors it (the camera v5's 'metal' studio): phoneB's bright champagne and nickel lids
  metalParts: /^(logic_board|battery)$/,                   // (the pouch too: a broad soft sheen its wrinkles and rolled edge catch)
  metalCard: { pos: [-6.1, -1.2, -3.2], size: [9, 7], card: 0.6, strip: 1.2, key: 0.6 },
  metalEnv: 1.0,
  shadowBox: 1.1,
  tileA: 'foam',                                           // the tile-A slot carries the foil wrinkle tile (code 0.66); no foam on the phone
  grainTileMM: 7, grainStr: 0.05, grainRough: 0.6, grainRoughMin: 0.34, grainSpecClamp: 0.25,
  foilTileMM: 96, foilStr: 0.07, foilSheen: 0.35, perfMM: 0.85,
  brushStr: 0.18, brushRough: 0.6,
  edgeSheen: 0.45,
  smoothSpec: 0.15,                                        // mirror-smooth metal: the softboxes in the env, not the point key
  // the screen: off (a black glass panel) through the orbit and the hero, as phoneA3; a dim neutral glow on the loose
  // panel in the hold, with a sub-pixel mesh (0.5 mm cells: the panel is 66.9 x 142.4 mm) that fades out below a pixel
  screen: 0.5, screenEnv: 0.06, screenRough: 0.16,
  screenGlow: { orbit: 0, hold: 3.0, t0: 0.35, t1: 0.9 },
  screenMesh: { mm: 0.9, str: 0.35 }, screenUV: [66.9 / 0.9, 142.4 / 0.9],
  // the cover glass: its strip env (phoneA3's band direction) and analytic softboxes; the printed border's inner edge
  // (model units) so the reflective layer is weaker over it and the border reads on every edge
  strip: { w: 4.2, l: 18, pos: [-3.8, 6.0, 4.0], along: [1, 0.2, -0.6], k: 6.0, wash: 0.2 },
  glassMask: { hw: 32.83 / PU, hh: 70.58 / PU, r: 7.68 / PU, k: 0.32 },
  glassFade: [0.12, 0.5],
  glassKeyK: 0.6,
  glassBoxes: [
    { when: 'pre', dir: [-0.10, 0.88, -0.48], dist: 2.4, w: 0.55, h: 5.0, rot: 100, k: 5.6, soft: 0.45, fall: 1.0 },   // the hero: phoneA3's band down the display's left side
    { when: 'ex', rel: true, tall: false, dir: [0.27, 0.08, 1.0], dist: 2.4, w: 2.2, h: 6.0, rot: 35, k: 3.0, soft: 1.0, fall: 2.0 },   // the desktop hold: a broad soft gradient across the loose glass (phoneB)
    { when: 'ex', rel: true, tall: true, dir: [0.27, 0.08, 1.0], dist: 2.4, w: 2.2, h: 6.0, rot: 35, k: 2.7, soft: 1.0, fall: 2.0 },
  ],
  // one phone-specific card (like the console's): broad, cool-neutral, below and behind the view, so the polished band's
  // side and the bottom face mirror lit metal (phoneA3) instead of the black studio
  // (studio frame; reflectInfo: at the hero the button-side band mirrors (0.84, -0.52, 0.17), the bottom face (-0.22, -0.83, -0.52))
  envExtra: [
    { w: 7, l: 5, pos: [5.9, -3.6, 1.2], along: [0, 1, 0], k: 1.4, tint: 0xeef2f8 },     // the side band: a cool grey (phoneA3)
    { w: 8, l: 6, pos: [-1.5, -5.8, -3.6], along: [1, 0, 0], k: 1.2, tint: 0xf2f2f2 },   // the bottom face: lit satin metal, the port legible
  ],
  // the orbit's opening: a near light above and left of the rear glass (studio frame, model units round the fit's centre),
  // so the frosted face reads as a soft gradient (round 2's was a flat slab); it fades out by the orbit's middle
  localLight: { pos: [-0.4, 0.62, 0.42], k: 5, until: 0.45, color: 0xf2f4f8, hold: { pos: [0.45, 0.55, 0.2], k: 3 } },   // (hold: it moves over the explode to light the rear glass's inner face from above, phoneB's soft gradient)
  light: { albedo: 1.15, key: 10, rim: 3.0, kick: 0.25, kickPanel: 0.3, overhead: 5.5, rimStrip: 2.6, sideStrip: 1.6, expRamp: 0.15, envRamp: 0.2, lift: 0.95 },
};

export const DEVICES = {
  mixer3d: { config: MIXER, base: '/assets/models/mixer/', label: 'Console' },
  mic3d: { config: MIC, base: '/assets/models/mic/', label: 'Microphone' },
  headphones3d: { config: HEADPHONES, base: '/assets/models/headphones/', label: 'Headphones' },
  phone3d: { config: PHONE, base: '/assets/models/phone/', label: 'Phone' },
};
