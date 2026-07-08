const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jafkvrjzzwcfmmqilxcb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4eWjAg1qxiqpnC6YrvUt1w_m9_Kd3mL';

// Since RLS is active on profiles, we need a service role key to see all profiles, 
// OR we can just login as the superadmin if we know the password.
// The user previously mentioned: foxsuperadmin@gmail.com / Fox@2026

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSuperAdminRole() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'foxsuperadmin@gmail.com',
    password: 'Fox@2026'
  });
  
  if (authError) {
    console.error('Auth Error:', authError);
    return;
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
  console.log('Super Admin Profile:', data);
  console.error('Profile Fetch Error:', error);
}

checkSuperAdminRole();
