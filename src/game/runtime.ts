import { GameStore } from './store';
import type { GameMode } from './types';
import { LegacyGameBridge } from './legacy-bridge';
import { createPlayer, PlayerController } from './player';
import { World } from './world';
import { CombatSystem, type WeaponType } from './combat';
import { GameEvents } from './events';
import { MatchSync } from '../network/match-sync';
import type { NetworkClient } from '../network/client';
import { GameLoop } from './loop';
import { InputController } from './input';

type RuntimeMessage =
  | { type: 'bedwars:set-mode'; mode: GameMode }
  | { type: 'bedwars:set-match'; matchId: string | null; mapTheme?: string };

export class GameRuntime {
  readonly store = new GameStore();
  readonly world = new World();
  readonly combat = new CombatSystem();
  readonly events = new GameEvents();
  private readonly localPlayer: PlayerController;
  private matchSync: MatchSync | null = null;
  private readonly loop = new GameLoop(() => this.tick());
  private readonly input = new InputController();
  private readonly onMessage = (event: MessageEvent<RuntimeMessage>): void => {
    if (event.source !== this.frame.contentWindow || !event.data) return;

    if (event.data.type === 'bedwars:set-mode') {
      this.store.setMode(event.data.mode);
    } else if (event.data.type === 'bedwars:set-match') {
      this.store.setMatch(event.data.matchId, event.data.mapTheme);
    }
  };

  private readonly bridge: LegacyGameBridge;

  constructor(private readonly frame: HTMLIFrameElement) {
    this.bridge = new LegacyGameBridge(frame);
    this.localPlayer = createPlayer('local', 'Player');
    this.store.upsertPlayer(this.localPlayer.snapshot);
  }

  start(): void {
    window.addEventListener('message', this.onMessage);
    this.loop.start();
  }

  private tick(): void {
    if (this.store.snapshot.mode === 'lobby') return;
    const axis = this.input.axis();
    this.localPlayer.move({ x: axis.x * 0.01, y: 0, z: axis.z * 0.01 });
    this.store.upsertPlayer(this.localPlayer.snapshot);
  }

  startNetworkSync(network: NetworkClient, uid = this.localPlayer.snapshot.uid): void {
    this.matchSync?.stop();
    this.matchSync = new MatchSync(this.events, this.store, network.matches, uid);
    this.matchSync.start();
  }

  setMode(mode: GameMode): void {
    this.store.setMode(mode);
    this.bridge.setMode(mode);
    this.events.emit('mode:changed', { mode });
  }

  damageLocalPlayer(amount: number): void {
    this.localPlayer.damage(amount);
    this.store.upsertPlayer(this.localPlayer.snapshot);
  }

  respawnLocalPlayer(position = { x: 0, y: 65, z: 0 }): void {
    this.localPlayer.respawn(position);
    this.store.upsertPlayer(this.localPlayer.snapshot);
    this.events.emit('player:respawned', { uid: this.localPlayer.snapshot.uid });
  }

  placeBlock(position: { x: number; y: number; z: number }, type: string): boolean {
    const block = this.world.place(position, type);
    if (!block) return false;
    this.bridge.send({ type: 'place-block', position: block.position, blockType: block.type });
    this.events.emit('world:block-placed', { ...block.position, type: block.type });
    return true;
  }

  breakBlock(position: { x: number; y: number; z: number }): boolean {
    const block = this.world.break(position);
    if (!block) return false;
    this.bridge.send({ type: 'break-block', position: block.position });
    this.events.emit('world:block-broken', { ...block.position, type: block.type });
    return true;
  }

  attack(targetUid: string, weapon: WeaponType = 'sword') {
    const target = this.store.snapshot.players[targetUid];
    if (!target) return { accepted: false, damage: 0 as const };
    const result = this.combat.attack(this.localPlayer.snapshot, target, weapon);
    if (result.accepted) {
      target.hp = Math.max(0, target.hp - result.damage);
      target.alive = target.hp > 0;
      this.store.upsertPlayer(target);
      this.events.emit('player:damaged', { targetUid, amount: result.damage });
    }
    return result;
  }

  stop(): void {
    window.removeEventListener('message', this.onMessage);
    this.loop.stop();
    this.input.dispose();
    this.matchSync?.stop();
    this.matchSync = null;
    this.bridge.dispose();
  }
}
