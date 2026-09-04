import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { MatchRepository } from './match-repository';

export interface NetworkConfig {
  url: string;
  anonKey: string;
}

export class NetworkClient {
  readonly supabase: SupabaseClient;
  readonly matches: MatchRepository;

  constructor(config: NetworkConfig) {
    this.supabase = createClient(config.url, config.anonKey);
    this.matches = new MatchRepository(this.supabase);
  }

  async ping(): Promise<boolean> {
    const { error } = await this.supabase.rpc('bw_test_ping');
    return !error;
  }
}
