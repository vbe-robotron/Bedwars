import { createClient } from '@supabase/supabase-js';

export function createSupabaseNamespace() {
  return { createClient };
}
