// Supabase client for React Native
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://korgtxyzpznaondfiytk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DHl_fcupULbxuH_A8RT7AA_Wm1ffyR5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
