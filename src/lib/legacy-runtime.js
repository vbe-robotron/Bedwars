import { legacyScripts } from '../game/legacy-scripts.js';
import { createStorage, getSupabaseConfig } from './persistence/index.js';
import { disposeLegacyRuntime as disposeLegacyScripts, loadLegacyScripts } from './legacy-loader.js';
import { installLegacyGlobals } from './legacy-bridge.js';
import { installLegacyGuards } from './legacy-guards.js';
export { loadLegacyScripts } from './legacy-loader.js';
export { installLegacyGlobals } from './legacy-bridge.js';

let activeRuntime = false;
let activeGuards = null;
let bootCount = 0;

export function isLegacyRuntimeActive() {
  return activeRuntime;
}

export function hasLegacyRuntimeBooted() {
  return bootCount > 0 || window.__BW_BOOTED === true;
}

export function createLegacyRuntime() {
  return {
    config: getSupabaseConfig(),
    scripts: legacyScripts,
    storage: createStorage()
  };
}

/* The bridge owns the old global API; this flag remains module-local. */
export function activateLegacyRuntime(runtime) {
  activeGuards = installLegacyGuards();
  installLegacyGlobals(runtime);
  activeRuntime = true;
  window.__BW_BOOTED = true;
  bootCount += 1;
}

export function disposeLegacyRuntime(mountedScripts) {
  activeGuards?.dispose();
  activeGuards = null;
  disposeLegacyScripts(mountedScripts);
  activeRuntime = false;
}
