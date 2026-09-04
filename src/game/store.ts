import type { GameState, PlayerState } from './types';

export class GameStore {
  private state: GameState = {
    mode: 'lobby',
    matchId: null,
    mapTheme: 'grassland',
    players: {},
  };

  get snapshot(): Readonly<GameState> {
    return this.state;
  }

  setMode(mode: GameState['mode']): void {
    this.state = { ...this.state, mode };
  }

  setMatch(matchId: string | null, mapTheme = this.state.mapTheme): void {
    this.state = { ...this.state, matchId, mapTheme };
  }

  upsertPlayer(player: PlayerState): void {
    this.state = {
      ...this.state,
      players: { ...this.state.players, [player.uid]: player },
    };
  }

  removePlayer(uid: string): void {
    const players = { ...this.state.players };
    delete players[uid];
    this.state = { ...this.state, players };
  }
}
