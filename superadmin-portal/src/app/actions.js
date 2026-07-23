"use server";

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://korgtxyzpznaondfiytk.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function fetchAllProfiles() {
  const { data, error } = await supabaseAdmin.from('profiles').select('*');
  if (error) {
    console.error("Error fetching profiles:", error);
    return [];
  }
  return data;
}
