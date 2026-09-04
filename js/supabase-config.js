'use strict';

// Public client configuration. Never put a service_role key in browser code.
window.SUPABASE_URL = 'https://vccexkzvxejsamzaxwak.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_X6HsNUlfphNmMRR0yHQ1iw__e20ce1j';

if (!window.supabase) {
  console.error('Supabase JS が読み込まれていません。');
} else {
  window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
}
