export function getSupabaseConfig(env = import.meta.env) {
  return Object.freeze({
    supabaseUrl: env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || ''
  });
}

export function hasSupabaseConfig(config) {
  return Boolean(config?.supabaseUrl && config?.supabaseAnonKey);
}
