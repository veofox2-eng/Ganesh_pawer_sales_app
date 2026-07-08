import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || 'https://korgtxyzpznaondfiytk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running smoothly!' });
});

// Backend endpoints for Ganesh Pawer Sales App

app.post('/api/create-employee', async (req, res) => {
  const { email, password, role, industry_position } = req.body;
  
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }
  
  try {
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
        await supabase
          .from('profiles')
          .update({ 
            role: role, 
            is_enabled: true, 
            approval_status: 'Approved', 
            feature_flags: { ...existingProfile.feature_flags, industry_position: industry_position || null, email: email }
          })
          .eq('id', authData.user.id);
      } else {
        await supabase
          .from('profiles')
          .insert([{ 
            id: authData.user.id, 
            role: role, 
            is_enabled: true, 
            approval_status: 'Approved',
            feature_flags: { industry_position: industry_position || null, email: email }
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

    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim() })
      .eq('id', user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating username:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port} and accepting external connections`);
});
