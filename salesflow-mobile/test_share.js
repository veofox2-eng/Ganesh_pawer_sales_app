const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://korgtxyzpznaondfiytk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DHl_fcupULbxuH_A8RT7AA_Wm1ffyR5';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testShare() {
  const { data, error } = await supabase.rpc('share_clients', {
    client_ids: ['00000000-0000-0000-0000-000000000000'],
    new_owner_id: '00000000-0000-0000-0000-000000000000',
    sharing_user_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('Error:', error);
  console.log('Data:', data);
}

testShare();
