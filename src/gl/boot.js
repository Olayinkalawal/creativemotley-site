/* Loaded lazily after first paint: builds the stage and registers every scene module. */
import { Stage } from './stage.js';

export function bootStage() {
  const stage = new Stage(document.getElementById('stage'));
  const mods = import.meta.glob('./scenes/*.js', { eager: true });
  for (const [path, m] of Object.entries(mods)) {
    try { m.default?.(stage); } catch (e) { console.warn('[stage] scene failed to register', path, e); }
  }
  stage.start();
  window.__stage = stage;   // for QA scripts
  return stage;
}
