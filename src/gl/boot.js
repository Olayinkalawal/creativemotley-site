/* Loaded lazily after first paint: builds the stage with a registry of scene factories. Each scene module is its own
   chunk, imported the first time one of its ids enters the stage's mount window (gl/stage.js).
   Phones (STILL): one module, the still path, answers every id but td:camera3d (Method's real-time camera, drawn on
   the phone GLB: gl/scenes/camera3d.js; to put phones back on the 3D stills, drop that one factory here and the
   td:camera3d skip in scenes/stills.js). */
import { Stage } from './stage.js';
import { STILL } from '../core/env.js';

const LAZY = import.meta.glob('./scenes/*.js');
const mod = (name) => LAZY[`./scenes/${name}.js`];
const KNOWN = [
  ['film', (id) => id === 'film'],
  ['umber', (id) => id === 'plate:umber'],
  ['plates', (id) => id.startsWith('plate:')],
  ['camera3d', (id) => id === 'td:camera3d'],
  ['teardowns', (id) => id.startsWith('td:') && id !== 'td:camera3d'],
  ['posters', (id) => id === 'posters'],
  ['objects', (id) => id === 'objects'],
];

function factories() {
  if (STILL) return [{ match: (id) => id === 'td:camera3d', load: mod('camera3d') }, { match: () => true, load: mod('stills') }];
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
