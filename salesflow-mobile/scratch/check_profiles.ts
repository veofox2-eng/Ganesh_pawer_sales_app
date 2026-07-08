import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://korgtxyzpznaondfiytk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DHl_fcupULbxuH_A8RT7AA_Wm1ffyR5';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log('Checking profiles...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- PROFILES STATUS ---');
  data.forEach(p => {
    console.log(`User: ${p.username || p.id} | Role: ${p.role} | Approved: ${p.approval_status} | Enabled: ${p.is_enabled}`);
  });
}

check();
