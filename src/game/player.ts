import type { PlayerState, Vector3 } from './types';

const MAX_HP = 20;

export class PlayerController {
  constructor(private readonly state: PlayerState) {}

  get snapshot(): Readonly<PlayerState> {
    return this.state;
  }

  move(delta: Vector3): void {
    if (!this.state.alive) return;
    this.state.position.x += delta.x;
    this.state.position.y += delta.y;
    this.state.position.z += delta.z;
  }

  damage(amount: number): boolean {
    if (!this.state.alive) return false;
    const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    this.state.hp = Math.max(0, this.state.hp - safeAmount);
    if (this.state.hp === 0) this.state.alive = false;
    return true;
  }

  respawn(position: Vector3): void {
    this.state.position = { ...position };
    this.state.hp = MAX_HP;
    this.state.alive = true;
  }
}

export function createPlayer(uid: string, name: string, team = 'Blue'): PlayerController {
  return new PlayerController({
    uid,
    name,
    team,
    position: { x: 0, y: 65, z: 0 },
    hp: MAX_HP,
    alive: true,
  });
}
