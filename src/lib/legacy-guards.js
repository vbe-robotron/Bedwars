/**
 * Best-effort lifecycle guards for the legacy game bundle.
 *
 * The legacy code registers timers, animation frames and global listeners
 * directly. Tracking them here lets the React wrapper tear the runtime down
 * without leaving callbacks running against removed DOM nodes.
 */
export function installLegacyGuards() {
  const original = {
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    setInterval: window.setInterval,
    clearInterval: window.clearInterval,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    addEventListener: EventTarget.prototype.addEventListener,
    removeEventListener: EventTarget.prototype.removeEventListener
  };
  const timers = new Set();
  const frames = new Set();
  const listeners = [];
  const bodyChildren = new Set(document.body.children);
  let active = true;

  window.setTimeout = function guardedSetTimeout(callback, delay, ...args) {
    const id = original.setTimeout.call(window, () => {
      timers.delete(id);
      if (typeof callback === 'function') callback(...args);
      else if (typeof callback === 'string') (0, eval)(callback);
    }, delay);
    timers.add(id);
    return id;
  };

  window.clearTimeout = function guardedClearTimeout(id) {
    timers.delete(id);
    return original.clearTimeout.call(window, id);
  };

  window.setInterval = function guardedSetInterval(callback, delay, ...args) {
    const id = original.setInterval.call(window, () => {
      if (typeof callback === 'function') callback(...args);
      else if (typeof callback === 'string') (0, eval)(callback);
    }, delay);
    timers.add(id);
    return id;
  };

  window.clearInterval = function guardedClearInterval(id) {
    timers.delete(id);
    return original.clearInterval.call(window, id);
  };

  window.requestAnimationFrame = function guardedRequestAnimationFrame(callback) {
    const id = original.requestAnimationFrame.call(window, (time) => {
      frames.delete(id);
      callback(time);
    });
    frames.add(id);
    return id;
  };

  window.cancelAnimationFrame = function guardedCancelAnimationFrame(id) {
    frames.delete(id);
    return original.cancelAnimationFrame.call(window, id);
  };

  EventTarget.prototype.addEventListener = function guardedAddEventListener(type, listener, options) {
    if (!active || !listener) {
      return original.addEventListener.call(this, type, listener, options);
    }
    if (type === 'load' && this === window && document.readyState === 'complete') {
      window.setTimeout(() => {
        try { listener.call(this, new Event('load')); }
        catch (error) { console.error(error); }
      }, 0);
      return;
    }
    if (type === 'DOMContentLoaded' && this === document && document.readyState !== 'loading') {
      window.setTimeout(() => {
        try { listener.call(this, new Event('DOMContentLoaded')); }
        catch (error) { console.error(error); }
      }, 0);
      return;
    }
    listeners.push({ target: this, type, listener, options });
    return original.addEventListener.call(this, type, listener, options);
  };

  function disposeGlobals() {
    try { if (typeof window.stopSupabaseRealtime === 'function') window.stopSupabaseRealtime(); } catch {}
    try { window.supabaseClient?.removeAllChannels?.(); } catch {}
    try { document.exitPointerLock?.(); } catch {}
    try {
      if (window.scene?.traverse) {
        window.scene.traverse((object) => {
          object.geometry?.dispose?.();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            material?.map?.dispose?.();
            material?.dispose?.();
          });
        });
      }
    } catch {}
    try {
      window.renderer?.dispose?.();
      window.renderer?.forceContextLoss?.();
      window.renderer?.domElement?.remove?.();
    } catch {}
    document.body?.classList.remove('kishiku-mode');
    for (const key of [
      '__BW_AUTH_READY', '__BW_CONFIG', '__BW_LOCAL_PEER_ID', '__BW_STORAGE',
      'SUPABASE_ANON_KEY', 'SUPABASE_URL', 'THREE', 'camera', 'renderer',
      'scene', 'supabase', 'supabaseClient'
    ]) {
      try { delete window[key]; } catch { window[key] = undefined; }
    }
  }

  return {
    dispose() {
      if (!active) return;
      active = false;
      EventTarget.prototype.addEventListener = original.addEventListener;
      window.setTimeout = original.setTimeout;
      window.clearTimeout = original.clearTimeout;
      window.setInterval = original.setInterval;
      window.clearInterval = original.clearInterval;
      window.requestAnimationFrame = original.requestAnimationFrame;
      window.cancelAnimationFrame = original.cancelAnimationFrame;

      for (const id of timers) {
        original.clearInterval.call(window, id);
        original.clearTimeout.call(window, id);
      }
      timers.clear();
      for (const id of frames) {
        original.cancelAnimationFrame.call(window, id);
      }
      frames.clear();

      for (const entry of listeners.splice(0)) {
        try { original.removeEventListener.call(entry.target, entry.type, entry.listener, entry.options); } catch {}
      }

      for (const child of Array.from(document.body.children)) {
        if (bodyChildren.has(child) || child.id === 'app' || child.tagName === 'SCRIPT') continue;
        child.remove();
      }
      disposeGlobals();
    }
  };
}
