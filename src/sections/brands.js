/* III · Brands: Brands block beside a two-note fan, two XXL photo cards in painted mats, then the
   leadership-experience row. Components from _paper.js; portrait camera keys on tall screens. */
import './brands.css';
import { initPaper, bindCamKeys } from './_paper.js';

export function init() {
  const root = document.getElementById('brands');
  if (!root) return;
  bindCamKeys(root.querySelector('[data-scene]'));
  initPaper(root);
}
