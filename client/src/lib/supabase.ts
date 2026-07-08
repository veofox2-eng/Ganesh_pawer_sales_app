import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://korgtxyzpznaondfiytk.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DHl_fcupULbxuH_A8RT7AA_Wm1ffyR5';

export const supabase = createClient(supabaseUrl, supabaseKey);
