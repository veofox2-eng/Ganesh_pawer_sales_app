
import { supabase } from './src/lib/supabase';

async function checkCols() {
  const { data, error } = await supabase.from('interactions').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('INTERACTIONS_COLS:', Object.keys(data[0]));
  } else {
    // If no data, try to insert a minimal row to see what fails
    console.log('No data found, trying minimal insert...');
    const { error: insErr } = await supabase.from('interactions').insert({ type: 'TEST' });
    if (insErr) {
        console.log('MINIMAL_INSERT_ERROR:', insErr.message, insErr.code, insErr.details);
    } else {
        console.log('MINIMAL_INSERT_SUCCESS');
        // Now it has data, check cols
        const { data: row } = await supabase.from('interactions').select('*').limit(1);
        if (row) console.log('INTERACTIONS_COLS:', Object.keys(row[0]));
    }
  }
}

checkCols();
