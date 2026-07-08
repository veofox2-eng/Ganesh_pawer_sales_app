
import { supabase } from './src/lib/supabase';

async function debugSchema() {
  // 1. Try to get one row to see columns
  const { data: row } = await supabase.from('interactions').select('*').limit(1);
  if (row && row.length > 0) {
    console.log('EXISTING_COLUMNS:', Object.keys(row[0]));
  } else {
    console.log('NO_EXISTING_DATA');
  }

  // 2. Try to insert with task_id and catch detailed error
  const { error: errWithTask } = await supabase.from('interactions').insert({
    task_id: '00000000-0000-0000-0000-000000000000',
    content: 'test',
    type: 'NOTE_ADDED'
  });
  if (errWithTask) {
    console.log('ERROR_WITH_TASK_ID:', errWithTask.message, errWithTask.code, errWithTask.details);
  } else {
    console.log('SUCCESS_WITH_TASK_ID');
  }

  // 3. Try to insert without task_id
  const { error: errWithoutTask } = await supabase.from('interactions').insert({
    content: 'test no task',
    type: 'NOTE_ADDED'
  });
  if (errWithoutTask) {
    console.log('ERROR_WITHOUT_TASK_ID:', errWithoutTask.message, errWithoutTask.code, errWithoutTask.details);
  } else {
    console.log('SUCCESS_WITHOUT_TASK_ID');
  }
}

debugSchema();
