const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://korgtxyzpznaondfiytk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DHl_fcupULbxuH_A8RT7AA_Wm1ffyR5';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('profiles').select('*').limit(10);
  
  if (error) {
    console.log("Supabase error (likely RLS):", error.message);
  } else {
    console.log("Profiles:", JSON.stringify(data, null, 2));
  }
}

main();
