const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createAdmin() {
  console.log('Creating admin user...');
  
  // Create user in auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'backendadmin@gmail.com',
    password: 'Fox@2026',
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
        console.log('User already exists, updating password...');
        // Update password if exists
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existingUser = listData.users.find(u => u.email === 'backendadmin@gmail.com');
        if (existingUser) {
            await supabase.auth.admin.updateUserById(existingUser.id, { password: 'Fox@2026' });
            
            // Ensure profile exists and is Admin
            await supabase.from('profiles').upsert({
                id: existingUser.id,
                username: 'Backend Admin',
                role: 'Admin',
                approval_status: 'Approved',
                feature_flags: { email: 'backendadmin@gmail.com', initial_password: 'Fox@2026' }
            });
            console.log('Admin user updated successfully.');
        }
        return;
    }
    console.error('Auth error:', authError);
    return;
  }

  const user = authData.user;
  
  // Create profile in profiles table
  const { error: profileError } = await supabase.from('profiles').upsert([
    { 
      id: user.id, 
      username: 'Backend Admin', 
      role: 'Admin', 
      approval_status: 'Approved',
      feature_flags: { email: 'backendadmin@gmail.com', initial_password: 'Fox@2026' }
    }
  ]);

  if (profileError) {
    console.error('Profile error:', profileError);
    return;
  }

  console.log('Admin user created successfully!');
}

createAdmin();
