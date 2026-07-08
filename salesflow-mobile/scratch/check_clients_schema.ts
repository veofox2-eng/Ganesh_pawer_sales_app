import { supabase } from './src/lib/supabase';

async function run() {
  const { data, error } = await supabase.from('clients').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else if (data && data[0]) {
    console.log('Clients columns:', Object.keys(data[0]));
  }
}
run();
