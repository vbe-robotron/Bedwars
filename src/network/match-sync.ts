import type { GameEvents } from '../game/events';
import type { GameStore } from '../game/store';
import type { MatchRepository } from './match-repository';

export class MatchSync {
  private readonly unsubscribers: Array<() => void> = [];

  constructor(
    private readonly events: GameEvents,
    private readonly store: GameStore,
    private readonly repository: MatchRepository,
    private readonly uid: string,
  ) {}

  start(): void {
    this.unsubscribers.push(
      this.events.on('world:block-placed', (block) => void this.syncBlock('place', block)),
      this.events.on('world:block-broken', (block) => void this.syncBlock('break', block)),
    );
  }

  stop(): void {
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  }

  private async syncBlock(
    action: 'place' | 'break',
    block: { x: number; y: number; z: number; type: string },
  ): Promise<void> {
    const matchId = this.store.snapshot.matchId;
    if (!matchId) return;
    if (action === 'place') {
      await this.repository.placeBlock(matchId, { position: block, type: block.type, hardness: 1 }, this.uid);
    } else {
      await this.repository.destroyBlock(matchId, block, this.uid);
    }
  }
}
