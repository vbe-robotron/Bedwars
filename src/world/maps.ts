import type { Vector3 } from '../game/types';

export interface MapDefinition {
  id: string;
  name: string;
  spawnPoints: Record<string, Vector3>;
  islandMaterial: string;
}

export const MAPS: Record<string, MapDefinition> = {
  grassland: {
    id: 'grassland',
    name: '草原',
    islandMaterial: 'grass',
    spawnPoints: {
      Blue: { x: -24, y: 65, z: 0 },
      Red: { x: 24, y: 65, z: 0 },
      Green: { x: 0, y: 65, z: -24 },
      Yellow: { x: 0, y: 65, z: 24 },
    },
  },
};

export function getMap(id: string): MapDefinition {
  return MAPS[id] ?? MAPS.grassland;
}
