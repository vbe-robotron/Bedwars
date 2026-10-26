

/* v25 Supabase通信セルフテスト */
window.bwSupabaseSelfTest=async function(){
  const out={client:!!window.supabaseClient, url:window.SUPABASE_URL||'', keyPresent:!!window.SUPABASE_ANON_KEY};
  if(!window.supabaseClient){out.ok=false;out.error='Supabase client not initialized';return out;}
  try{
    const ping=await sbRequest({action:'testPing'});
    out.ping=!!ping?.ok;
    const settings=await sbRequest({action:'getSettings'});
    out.settings=!!settings?.ok;
    out.ok=out.ping&&out.settings;
  }catch(e){out.ok=false;out.error=e?.message||String(e);}
  console.table(out);
  return out;
};
