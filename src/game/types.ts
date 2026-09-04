export type GameMode = 'lobby' | 'solo' | 'multi' | 'training_bridge' | 'training_parkour';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  uid: string;
  name: string;
  position: Vector3;
  hp: number;
  team: string;
  alive: boolean;
}

export interface GameState {
  mode: GameMode;
  matchId: string | null;
  mapTheme: string;
  players: Record<string, PlayerState>;
}
