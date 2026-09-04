import { GameRuntime } from './game/runtime';
import { GameShell } from './ui/game-shell';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) throw new Error('App root was not found');

const shell = new GameShell(app);

// Compatibility boundary while the legacy implementation is migrated.
// New systems should depend on GameRuntime instead of global variables.
const runtime = new GameRuntime(shell.frame);
runtime.start();
window.addEventListener('beforeunload', () => {
  runtime.stop();
  shell.dispose();
}, { once: true });
