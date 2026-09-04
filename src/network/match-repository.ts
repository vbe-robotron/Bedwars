import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlayerState, Vector3 } from '../game/types';
import type { Block } from '../game/world';

export class MatchRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsertPlayer(matchId: string, player: PlayerState): Promise<void> {
    const { error } = await this.db.from('bw_players').upsert({
      match_id: matchId,
      uid: player.uid,
      name: player.name,
      team: player.team,
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      hp: player.hp,
      alive: player.alive,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'match_id,uid' });
    if (error) throw error;
  }

  async placeBlock(matchId: string, block: Block, uid: string): Promise<void> {
    const { error } = await this.db.from('bw_blocks').upsert({
      match_id: matchId,
      x: block.position.x,
      y: block.position.y,
      z: block.position.z,
      type: block.type,
      uid,
      action: 'place',
      ts: new Date().toISOString(),
    }, { onConflict: 'match_id,x,y,z' });
    if (error) throw error;
  }

  async destroyBlock(matchId: string, position: Vector3, uid: string): Promise<void> {
    const { error } = await this.db.from('bw_blocks').upsert({
      match_id: matchId,
      x: Math.round(position.x),
      y: Math.round(position.y),
      z: Math.round(position.z),
      type: '',
      uid,
      action: 'break',
      ts: new Date().toISOString(),
    }, { onConflict: 'match_id,x,y,z' });
    if (error) throw error;
  }
}
