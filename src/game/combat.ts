import type { PlayerState } from './types';

export type WeaponType = 'hand' | 'sword' | 'bow';

const DAMAGE: Record<WeaponType, number> = { hand: 1, sword: 7, bow: 5 };
const MAX_RANGE: Record<WeaponType, number> = { hand: 3.2, sword: 4.5, bow: 32 };

function distance(a: PlayerState, b: PlayerState): number {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const dz = a.position.z - b.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface AttackResult {
  accepted: boolean;
  damage: number;
  reason?: 'dead' | 'out_of_range' | 'same_team';
}

export class CombatSystem {
  attack(attacker: PlayerState, target: PlayerState, weapon: WeaponType): AttackResult {
    if (!attacker.alive || !target.alive) return { accepted: false, damage: 0, reason: 'dead' };
    if (attacker.team === target.team) return { accepted: false, damage: 0, reason: 'same_team' };
    if (distance(attacker, target) > MAX_RANGE[weapon]) {
      return { accepted: false, damage: 0, reason: 'out_of_range' };
    }
    return { accepted: true, damage: DAMAGE[weapon] };
  }
}
