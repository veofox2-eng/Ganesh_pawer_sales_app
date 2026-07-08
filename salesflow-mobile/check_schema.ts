
import { supabase } from './src/lib/supabase';

async function checkSchema() {
  const { data, error } = await supabase.from('payments').select('*').limit(1);
  if (error) {
    console.error('Error fetching payments:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in payments table:', Object.keys(data[0]));
  } else {
    console.log('No data in payments table to check columns.');
  }

  const { data: instData, error: instError } = await supabase.from('payment_installments').select('*').limit(1);
  if (instError) {
    console.error('Error fetching installments:', instError);
  } else if (instData && instData.length > 0) {
    console.log('Columns in payment_installments table:', Object.keys(instData[0]));
  }
}

checkSchema();
