import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://korgtxyzpznaondfiytk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DHl_fcupULbxuH_A8RT7AA_Wm1ffyR5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
