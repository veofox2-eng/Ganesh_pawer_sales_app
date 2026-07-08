import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function optimize() {
  console.log('Optimizing employee_locations table...');
  
  // Note: Since I can't run RAW SQL ALTER TABLE easily via the anon key if not allowed, 
  // I will check if the user can do it.
  
  console.log('PLEASE RUN THIS SQL IN SUPABASE EDITOR:');
  console.log(`
    -- 1. Remove old location records, keeping only the latest one per user
    DELETE FROM employee_locations a
    USING employee_locations b
    WHERE a.id < b.id 
    AND a.user_id = b.user_id;

    -- 2. Add unique constraint to enable UPSERT
    ALTER TABLE employee_locations ADD CONSTRAINT unique_user_location UNIQUE (user_id);
  `);
}

optimize();
