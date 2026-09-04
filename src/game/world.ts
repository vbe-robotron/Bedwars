import type { Vector3 } from './types';
import { getMap } from '../world/maps';

export interface Block {
  position: Vector3;
  type: string;
  hardness: number;
}

const HARDNESS: Record<string, number> = {
  wool: 0.8,
  wood: 2,
  stone: 4,
  endstone: 6,
  obsidian: 20,
};

function key(position: Vector3): string {
  return `${Math.round(position.x)},${Math.round(position.y)},${Math.round(position.z)}`;
}

export class World {
  private readonly blocks = new Map<string, Block>();

  get blockCount(): number {
    return this.blocks.size;
  }

  get(position: Vector3): Block | undefined {
    return this.blocks.get(key(position));
  }

  place(position: Vector3, type: string): Block | null {
    if (this.get(position)) return null;
    const block: Block = {
      position: { x: Math.round(position.x), y: Math.round(position.y), z: Math.round(position.z) },
      type,
      hardness: HARDNESS[type] ?? 1,
    };
    this.blocks.set(key(block.position), block);
    return block;
  }

  break(position: Vector3): Block | null {
    const block = this.blocks.get(key(position));
    if (!block) return null;
    this.blocks.delete(key(position));
    return block;
  }

  near(center: Vector3, radius = 2): Block[] {
    return [...this.blocks.values()].filter((block) =>
      Math.abs(block.position.x - center.x) <= radius &&
      Math.abs(block.position.y - center.y) <= radius &&
      Math.abs(block.position.z - center.z) <= radius,
    );
  }

  clear(): void {
    this.blocks.clear();
  }

  loadMap(mapId: string): void {
    this.clear();
    const map = getMap(mapId);
    Object.values(map.spawnPoints).forEach((spawn) => {
      this.place({ x: spawn.x, y: spawn.y - 1, z: spawn.z }, map.islandMaterial);
    });
  }
}
