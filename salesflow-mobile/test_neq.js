const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jafkvrjzzwcfmmqilxcb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4eWjAg1qxiqpnC6YrvUt1w_m9_Kd3mL';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testNeq() {
  const randomId = Math.floor(Math.random() * 10000000) + 1000;
  const { data, error } = await supabase.from('tenant_config')
    .select('admin_app_active, employee_app_active')
    .eq('id', 1)
    .neq('id', randomId)
    .single();
  
  console.log('Data:', data);
  console.error('Error:', error);
}

testNeq();
