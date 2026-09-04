import type { GameMode } from './types';
import type { GameCommand } from './commands';

export class LegacyGameBridge {
  constructor(private readonly frame: HTMLIFrameElement) {}

  setMode(mode: GameMode): void {
    this.send({ type: 'set-mode', mode });
  }

  send(command: GameCommand): void {
    this.frame.contentWindow?.postMessage({ type: 'bedwars:command', command }, '*');
  }

  dispose(): void {
    this.frame.remove();
  }
}
