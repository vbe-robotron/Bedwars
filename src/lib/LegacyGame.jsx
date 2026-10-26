import { useEffect, useRef, useState } from 'react';
import LegacyUI from '../game/LegacyUI.jsx';
import '../game/legacy.css';
import {
  activateLegacyRuntime,
  createLegacyRuntime,
  disposeLegacyRuntime,
  hasLegacyRuntimeBooted,
  isLegacyRuntimeActive,
  loadLegacyScripts
} from './legacy-runtime.js';
import './LegacyGame.css';

export default function LegacyGame() {
  const [{ runtime, initError }] = useState(() => {
    try {
      return { runtime: createLegacyRuntime(), initError: '' };
    } catch (cause) {
      return {
        runtime: null,
        initError: cause instanceof Error ? cause.message : String(cause)
      };
    }
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const mountedScriptsRef = useRef([]);

  useEffect(() => {
    if (!runtime) return undefined;
    if (isLegacyRuntimeActive() || hasLegacyRuntimeBooted()) {
      // Classic scripts cannot be re-executed in the same realm.
      location.reload();
      return undefined;
    }

    let cancelled = false;
    activateLegacyRuntime(runtime);

    (async () => {
      try {
        await loadLegacyScripts(runtime.scripts, mountedScriptsRef.current, () => !cancelled);
        if (!cancelled) setLoaded(true);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();

    return () => {
      cancelled = true;
      disposeLegacyRuntime(mountedScriptsRef.current);
      mountedScriptsRef.current = [];
    };
  }, [runtime]);

  const message = initError || error;

  return (
    <>
      <LegacyUI />
      {message ? (
        <div className="loading error" role="alert">{message}</div>
      ) : !loaded ? (
        <div className="loading" aria-live="polite">BedWars を読み込み中…</div>
      ) : null}
    </>
  );
}
