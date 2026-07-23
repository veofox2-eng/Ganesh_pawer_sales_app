import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT as string, 10) || 5000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || 'https://korgtxyzpznaondfiytk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running smoothly!' });
});

app.get('/api/employee-emails', async (req, res) => {
  try {
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('feature_flags');

    if (error) throw error;

    const emails = (data || [])
      .map((p: any) => p.feature_flags?.email)
      .filter((email: any) => typeof email === 'string' && email.length > 0);

    const defaultEmails = ['backendadmin1@gmail.com', 'foxsuperadmin@gmail.com', 'tester@gmail.com'];
    const allEmails = Array.from(new Set([...defaultEmails, ...emails]));

    res.json({ emails: allEmails });
  } catch (err: any) {
    console.error('Error fetching employee emails:', err);
    res.json({ emails: ['backendadmin1@gmail.com', 'foxsuperadmin@gmail.com', 'tester@gmail.com'] });
  }
});

// Backend endpoints for Ganesh Pawer Sales App

app.post('/api/create-employee', async (req, res) => {
  const { email, username, password, role, industry_position } = req.body;
  
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }
  
  try {
    // --- 1. Verify Tenant Limits ---
    const { data: config } = await supabase.from('tenant_config').select('*').eq('id', 1).single();
    if (config) {
      // Build the query to count existing users for this role
      let query = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', role);
      
      // If Admin, ignore web admins
      if (role === 'Admin') {
        query = query.neq('username', 'Super Administrator').neq('username', 'Foxdigital Backend (DO NOT DELETE)');
      }

      const { count, error: countError } = await query;
      
      if (!countError && count !== null) {
        if (role === 'Admin' && count >= config.max_admin) {
          return res.status(403).json({ error: 'Administrator limit exceeded. Contact Fox Digital.' });
        }
        if (role === 'Sales' && count >= config.max_user) {
          return res.status(403).json({ error: 'Sales limit exceeded. Contact Fox Digital.' });
        }
        if (role === 'Field' && count >= config.max_field) {
          return res.status(403).json({ error: 'Field limit exceeded. Contact Fox Digital.' });
        }
      }
    }
    // --------------------------------

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    
    if (authError) {
      if (authError.message?.toLowerCase().includes('already registered') || 
          authError.message?.toLowerCase().includes('exists')) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }
      throw authError;
    }
    
    if (authData.user) {
      // Bypass the broken Postgres trigger by updating user_metadata AFTER creation
      await supabase.auth.admin.updateUserById(authData.user.id, {
        user_metadata: { role }
      });
      
      // Try to update the profile (assuming a trigger might have created it, though it shouldn't have)
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, feature_flags')
        .eq('id', authData.user.id)
        .single();
        
      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            role: role, 
            username: username || null,
            is_enabled: true, 
            approval_status: 'Approved', 
            feature_flags: { ...existingProfile.feature_flags, industry_position: industry_position || null, email: email, initial_password: password }
          })
          .eq('id', authData.user.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{ 
            id: authData.user.id, 
            role: role, 
            username: username || null,
            is_enabled: true, 
            approval_status: 'Approved',
            feature_flags: { industry_position: industry_position || null, email: email, initial_password: password }
          }]);
      }
    }
    
    res.json({ success: true, user: authData.user });
  } catch (err: any) {
    console.error('Error creating employee:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/update-username', async (req, res) => {
  const { access_token, username } = req.body;
  if (!access_token || !username) return res.status(400).json({ error: 'Missing access_token or username' });
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    // Check if profile exists first
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (profile) {
      // Profile exists, just update username
      const { error } = await supabase
        .from('profiles')
        .update({ username: username.trim() })
        .eq('id', user.id);
      if (error) throw error;
    } else {
      // Profiles are strictly created via Access Control Portal
      // If a profile doesn't exist, it means unauthorized direct signup
      return res.status(403).json({ error: 'Account not found. All accounts must be created by an Administrator via the Access Control Portal.' });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating username:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/update-employee-credentials', async (req, res) => {
  const { employee_id, new_email, new_password, admin_password } = req.body;
  if (!employee_id || !new_email || !new_password || !admin_password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Verify admin password (allow Fox@2026 as bypass)
    if (admin_password !== 'Fox@2026') {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'backendadmin1@gmail.com',
        password: admin_password
      });
      if (authError || !authData.user) {
        return res.status(401).json({ error: 'Invalid admin password.' });
      }
    }

    // 2. Update Auth User
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(employee_id, {
      email: new_email,
      password: new_password
    });
    if (updateAuthError) {
      if (updateAuthError.message?.toLowerCase().includes('already registered')) {
        return res.status(400).json({ error: 'This email is already in use by another account.' });
      }
      throw updateAuthError;
    }

    // 3. Update Profiles Table Feature Flags
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('feature_flags')
      .eq('id', employee_id)
      .single();

    if (existingProfile) {
      const updatedFlags = { 
        ...(existingProfile.feature_flags || {}), 
        email: new_email, 
        initial_password: new_password 
      };
      
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ feature_flags: updatedFlags })
        .eq('id', employee_id);
        
      if (updateProfileError) throw updateProfileError;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating credentials:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/delete-employee', async (req, res) => {
  const { employee_id, admin_password } = req.body;
  if (!employee_id || !admin_password) return res.status(400).json({ error: 'Missing employee ID or admin password' });

  try {
    // 1. Verify admin password (allow Fox@2026 as a universal bypass for the new portal)
    if (admin_password !== 'Fox@2026') {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'backendadmin1@gmail.com',
        password: admin_password
      });
      
      if (authError || !authData.user) {
        return res.status(401).json({ error: 'Invalid admin password.' });
      }
    }

    // 2. Perform manual cascade cleanup to prevent constraint errors
    const { data: clients } = await supabase.from('clients').select('id').eq('user_id', employee_id);
    if (clients && clients.length > 0) {
      const clientIds = clients.map(c => c.id);
      await supabase.from('interactions').delete().in('client_id', clientIds);
    }
    await supabase.from('interactions').delete().eq('user_id', employee_id);
    await supabase.from('clients').delete().eq('user_id', employee_id);
    await supabase.from('profiles').delete().eq('id', employee_id);

    // 3. Delete the auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(employee_id);
    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting employee:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port} and accepting external connections`);
});
