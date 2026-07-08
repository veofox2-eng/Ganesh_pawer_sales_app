import { supabase } from './src/lib/supabase';
async function test() {
  const { data, error } = await supabase.from('employee_locations').upsert({
    user_id: '00000000-0000-0000-0000-000000000000',
    latitude: 0,
    longitude: 0,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  console.log('Error:', error);
}
test();
