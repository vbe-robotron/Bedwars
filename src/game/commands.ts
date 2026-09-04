import type { GameMode, Vector3 } from './types';

export type GameCommand =
  | { type: 'set-mode'; mode: GameMode }
  | { type: 'load-map'; mapId: string }
  | { type: 'move-player'; position: Vector3 }
  | { type: 'place-block'; position: Vector3; blockType: string }
  | { type: 'break-block'; position: Vector3 };
