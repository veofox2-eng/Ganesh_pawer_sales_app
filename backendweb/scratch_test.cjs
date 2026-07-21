const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('src/lib/supabase.ts', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*\}?\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY\s*\}?\s*=\s*['"]([^'"]+)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data } = await supabase.from('interactions').select('*').limit(50);
  console.log('Sample interactions:');
  const deleted = data.filter(d => d.media_url === 'DELETED' || d.type === 'APPROVAL');
  console.log('Deleted or Approvals:', deleted);
  
  const { data: profs } = await supabase.from('profiles').select('*');
  console.log('Roles:', [...new Set(profs.map(p => p.role))]);
  console.log('Usernames:', [...new Set(profs.map(p => p.username))]);
}
run();
