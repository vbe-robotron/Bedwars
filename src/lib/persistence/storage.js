const memoryStorage = new Map();

function getBackend() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Small storage port used by the legacy game during the migration.
 * Values are mirrored in memory so quota/private-mode errors never stop the
 * game loop, while localStorage remains the durable backend when available.
 */
export function createStorage() {
  return {
    get(key, fallback = null) {
      const memoryKey = String(key);
      if (memoryStorage.has(memoryKey)) return memoryStorage.get(memoryKey);
      try {
        const backend = getBackend();
        const value = backend?.getItem(memoryKey);
        if (value != null) {
          memoryStorage.set(memoryKey, value);
          return value;
        }
      } catch {}
      return fallback;
    },
    set(key, value) {
      const memoryKey = String(key);
      const stringValue = String(value);
      memoryStorage.set(memoryKey, stringValue);
      try {
        getBackend()?.setItem(memoryKey, stringValue);
      } catch {}
    },
    remove(key) {
      const memoryKey = String(key);
      memoryStorage.delete(memoryKey);
      try {
        getBackend()?.removeItem(memoryKey);
      } catch {}
    }
  };
}
