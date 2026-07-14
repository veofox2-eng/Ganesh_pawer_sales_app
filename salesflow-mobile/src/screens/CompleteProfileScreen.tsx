import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function CompleteProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCompleteProfile() {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter your display name.');
      return;
    }

    setLoading(true);
    try {
      if (!profile?.id) throw new Error("No profile found.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No session found");

      // We call our custom backend endpoint to bypass RLS restrictions securely
      // Assuming your backend runs on a known URL, you can put the production URL here. 
      // For local testing, we'll try a common local network IP, or you can replace it with your actual backend IP.
      const API_URL = 'https://ganesh-backend-3j1t.onrender.com/api/update-username'; // Live Backend URL
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: session.access_token,
          username: username.trim()
        })
      });
      
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'Failed to update profile');
      
      Alert.alert('Success', 'Profile updated successfully!');
      await refreshProfile(); // Refresh AuthContext so it proceeds
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logoImage} 
            resizeMode="contain" 
          />
          <Text style={styles.logoText}>Welcome to SalesFlow</Text>
          <Text style={styles.tagline}>Please complete your profile to continue</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Display Name</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Enter your full name" 
                placeholderTextColor={colors.textMuted}
                value={username} 
                onChangeText={setUsername} 
                autoCapitalize="words" 
              />
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleCompleteProfile} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.submitText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: colors.bg, 
  },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
  logoImage: {
    width: 76, height: 76, borderRadius: 20,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
  },
  logoText: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, textAlign: 'center' },
  tagline: { fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border,
  },
  field: { marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, color: colors.textPrimary, fontSize: 15,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
  submitBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
    shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 12,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
