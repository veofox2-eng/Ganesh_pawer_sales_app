
import { supabase } from './src/lib/supabase';

async function checkInteractionsSchema() {
  const { data, error } = await supabase.from('interactions').select('*').limit(1);
  if (error) {
    console.error('Error fetching interactions:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in interactions table:', Object.keys(data[0]));
  } else {
    // Try to insert a dummy row and see what happens or just get table info if possible
    console.log('No data in interactions table. Trying to get column names via select.');
    const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'interactions' });
    if (colError) {
        console.error('RPC failed, checking if we can at least see keys of an empty result? No.');
    } else {
        console.log('Table columns:', cols);
    }
  }
}

checkInteractionsSchema();
