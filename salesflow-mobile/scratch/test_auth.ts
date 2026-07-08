import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://korgtxyzpznaondfiytk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DHl_fcupULbxuH_A8RT7AA_Wm1ffyR5';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLogin() {
  const email = 'foxy03346@gmail.com';
  const password = 'fox@2010';

  console.log(`Testing login for ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login Failed:', error.message);
  } else {
    console.log('Login Successful!');
    console.log('User ID:', data.user?.id);
    
    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user?.id)
      .single();
      
    if (profileError) {
      console.error('Profile Check Failed:', profileError.message);
    } else {
      console.log('Profile Data:', profile);
    }
  }
}

testLogin();
