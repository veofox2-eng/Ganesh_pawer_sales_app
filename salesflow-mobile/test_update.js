const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jafkvrjzzwcfmmqilxcb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4eWjAg1qxiqpnC6YrvUt1w_m9_Kd3mL';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUpdate() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'foxsuperadmin@gmail.com',
    password: 'Fox@2026'
  });
  
  if (authError) {
    console.error('Auth Error:', authError);
    return;
  }

  const { data, error } = await supabase.from('tenant_config').update({ admin_app_active: false }).eq('id', 1).select();
  console.log('Update Result Data:', data);
  console.error('Update Result Error:', error);
}

testUpdate();
