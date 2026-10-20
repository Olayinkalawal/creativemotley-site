/* Loaded lazily after first paint: builds the stage with a registry of scene factories. Each scene module is its own
   chunk, imported the first time one of its ids enters the stage's mount window (gl/stage.js).
   Phones (STILL): one module, the still path, answers every id but td:camera3d (Method's real-time camera, drawn on
   the phone GLB: gl/scenes/camera3d.js) where the phone can carry it (core/env.js CAM3D: >= 4 GB, >= 6 cores, or
   ?cam3d=1). Without CAM3D the still path draws ink there, as for every teardown, and the section shows its 3D stills.
   To put every phone back on the stills, make CAM3D false on STILL in core/env.js. */
import { Stage } from './stage.js';
import { STILL, CAM3D } from '../core/env.js';

const LAZY = import.meta.glob('./scenes/*.js');
const mod = (name) => LAZY[`./scenes/${name}.js`];
const KNOWN = [
  ['film', (id) => id === 'film'],
  ['umber', (id) => id === 'plate:umber'],
  ['plates', (id) => id.startsWith('plate:')],
  ['camera3d', (id) => id === 'td:camera3d' && CAM3D],
  ['teardowns', (id) => id.startsWith('td:') && id !== 'td:camera3d'],
  ['posters', (id) => id === 'posters'],
  ['objects', (id) => id === 'objects'],
];

function factories() {
  if (STILL) return [{ match: (id) => id === 'td:camera3d' && CAM3D, load: mod('camera3d') }, { match: () => true, load: mod('stills') }];
  const list = KNOWN.filter(([n]) => mod(n)).map(([n, match]) => ({ match, load: mod(n) }));
  // a scene module added later without a registry line: imported (once) when an id nobody claims shows up
  const rest = Object.keys(LAZY).filter((p) => !KNOWN.some(([n]) => p === `./scenes/${n}.js`) && p !== './scenes/stills.js');
  if (rest.length) {
    let all = null;
    list.push({
      match: (id) => !list.slice(0, -1).some((f) => f.match(id)) && !/^(film|posters|objects|plate:|td:)/.test(id),
      load: () => (all ||= Promise.all(rest.map((p) => LAZY[p]())).then((ms) => ({ default: (stage) => ms.forEach((m) => m.default?.(stage)) }))),
    });
  }
  return list;
}

export function bootStage() {
  const stage = new Stage(document.getElementById('stage'), factories());
  stage.start();
  window.__stage = stage;   // for QA scripts
  return stage;
}
