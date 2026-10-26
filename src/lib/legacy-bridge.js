import * as THREE from 'three';
import { createSupabaseNamespace, hasSupabaseConfig } from './persistence/index.js';

/** Installs the temporary compatibility surface used by the legacy bundle. */
export function installLegacyGlobals(runtime) {
  window.__BW_CONFIG = runtime.config;
  window.__BW_STORAGE = runtime.storage;
  window.THREE = THREE;
  if (hasSupabaseConfig(runtime.config)) {
    window.supabase = createSupabaseNamespace();
  }
}
