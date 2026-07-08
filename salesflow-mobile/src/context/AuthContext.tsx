import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as Application from 'expo-application';

export type UserRole = 'SuperAdmin' | 'Admin' | 'User' | 'Field';

interface Profile {
  id: string;
  username: string | null;
  role: UserRole;
  is_enabled: boolean;
  approval_status: 'Pending' | 'Approved' | 'Rejected';
  industry_position?: string;
  feature_flags?: any;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isField: boolean;
  isApproved: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Use a ref to track profile subscription to prevent duplicates
  const profileSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const profileLoadedRef = useRef(false);
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Failsafe: if loading takes more than 5 seconds, force it to false
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[Auth] Failsafe timeout triggered: forcing loading to false');
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        if (!mounted) return;
        
        if (s && !profileLoadedRef.current) {
          setLoading(true);
        }
        
        const pkg = (Application.applicationId || '').toLowerCase();
        const isSuperAdminApp = pkg.includes('superadmin');

        setSession(s);
        if (s) {
          if (!profileLoadedRef.current || _event === 'SIGNED_IN') {
            await fetchProfile(s.user.id);
            subscribeToProfileChanges(s.user.id);
          }
        } else {
          setProfile(null);
          profileLoadedRef.current = false;
          setLoading(false);
          // Clean up profile subscription on logout
          if (profileSubRef.current) {
            supabase.removeChannel(profileSubRef.current);
            profileSubRef.current = null;
          }
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      authSub.unsubscribe();
      if (profileSubRef.current) {
        supabase.removeChannel(profileSubRef.current);
        profileSubRef.current = null;
      }
    };
  }, []); // ← empty array: runs ONCE. This is the critical fix.

  function subscribeToProfileChanges(userId: string) {
    // Tear down any existing profile channel before creating a new one
    if (profileSubRef.current) {
      supabase.removeChannel(profileSubRef.current);
    }

    const channel = supabase
      .channel(`profile-updates-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as Profile;
          console.log('[Auth] Real-time profile update:', updated.username, '| Role:', updated.role);
          if (updated.is_enabled === false && updated.role !== 'Admin') {
            Alert.alert('Account Disabled', 'Your account has been disabled by an administrator.');
            supabase.auth.signOut();
          } else {
            setProfile(updated);
          }
        }
      )
      .subscribe();

    profileSubRef.current = channel;
  }

  async function fetchProfile(userId: string, retries = 3) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error(`[Auth] Error fetching profile (retries left: ${retries}):`, error.message);
        if (retries > 0) {
          await new Promise(res => setTimeout(res, 1000));
          return fetchProfile(userId, retries - 1);
        }
        return;
      }

      if (data) {
        console.log('[Auth] Profile loaded:', data.username, '| Role:', data.role, '| Enabled:', data.is_enabled);
        
        // Save user ID for background tracking fallback
        AsyncStorage.setItem('last_user_id', userId).catch(e => console.warn('Failed to save last_user_id', e));

        if (data.is_enabled === false && data.role !== 'Admin') {
          console.warn('[Auth] Blocking: account is disabled in DB');
          Alert.alert('Account Disabled', 'Your account has been disabled by an administrator.');
          await supabase.auth.signOut();
          return;
        }
        setProfile(data as Profile);
        profileLoadedRef.current = true;
      }
    } catch (err) {
      console.error('[Auth] fetchProfile exception:', err);
      if (retries > 0) {
        await new Promise(res => setTimeout(res, 1000));
        return fetchProfile(userId, retries - 1);
      }
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user.id) {
      await fetchProfile(s.user.id);
    }
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isAdmin: profile?.role === 'Admin',
    isField: profile?.role === 'Field',
    isApproved: true, // Bypass approval screen entirely
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
