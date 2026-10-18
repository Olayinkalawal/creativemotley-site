/* II · Creators: the paper reads head → Creators block → production notes fan → command cloud →
   Media Owners block → catalogue notes fan. The components live in _paper.js; the opener's camera keys
   switch to portrait keys on tall screens. */
import './creators.css';
import { initPaper, bindCamKeys } from './_paper.js';

export function init() {
  const root = document.getElementById('creators');
  if (!root) return;
  bindCamKeys(root.querySelector('[data-scene]'));
  initPaper(root);
}
