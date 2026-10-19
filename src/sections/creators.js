/* II · Creators (track O1): the paper reads head | Creators block → the notes fan → "What we run" (DC10–DC17) beside
   the command cloud and Media Owners (+ DC19, the catalogue's notes). Components from _paper.js; the opener's keys
   are src/gl/keys/creators.json. With WebGL off, the CSS plate is hidden while the sheet covers the screen. */
import './creators.css';
import { initPaper, bindCamKeys, coverPlates, landPlate } from './_paper.js';

export function init() {
  const root = document.getElementById('creators');
  if (!root) return;
  bindCamKeys(root.querySelector('[data-scene]'));
  initPaper(root);
  coverPlates(root.querySelector('.paper'));
  landPlate(root.querySelector('.opener'), 'creators');
}
