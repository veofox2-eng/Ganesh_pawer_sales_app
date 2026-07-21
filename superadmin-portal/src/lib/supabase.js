import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://korgtxyzpznaondfiytk.supabase.co';
const supabaseKey = 'sb_publishable_DHl_fcupULbxuH_A8RT7AA_Wm1ffyR5';

export const supabase = createClient(supabaseUrl, supabaseKey);
