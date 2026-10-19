/* III · Brands (track O1): the Brands block (+ DC31) beside a two-note fan, "How a brief runs" (DC32–DC37), the room
   and the set in velvet mats. Components from _paper.js; the opener's keys are src/gl/keys/brands.json. With WebGL
   off, the CSS plate is hidden while the sheet covers the screen (coverPlates). */
import './brands.css';
import { initPaper, bindCamKeys, coverPlates, landPlate } from './_paper.js';

export function init() {
  const root = document.getElementById('brands');
  if (!root) return;
  bindCamKeys(root.querySelector('[data-scene]'));
  initPaper(root);
  coverPlates(root.querySelector('.paper'));
  landPlate(root.querySelector('.opener'), 'brands');
}
