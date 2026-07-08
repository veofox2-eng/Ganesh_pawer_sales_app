const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jafkvrjzzwcfmmqilxcb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4eWjAg1qxiqpnC6YrvUt1w_m9_Kd3mL';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkConfig() {
  const { data, error } = await supabase.from('tenant_config').select('*').single();
  console.log('tenant_config:', data);
  console.error('error:', error);
}

checkConfig();
