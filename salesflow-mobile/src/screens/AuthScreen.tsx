import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, radius } from '../theme';

export default function AuthScreen(props: any) {
  const navigation = props.navigation;
  const [role, setRole] = useState<'SuperAdmin' | 'Admin' | 'User' | 'Field'>('User');
  const displayRole = role === 'User' ? 'Indoor Sales Person' : role === 'SuperAdmin' ? 'Super Administrator' : role;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  React.useEffect(() => {
    const params = (props as any)?.route?.params;
    if (params?.role) {
      setRole(params.role);
    }
    if (params?.role) {
      setRole(params.role);
    }
  }, [(props as any)?.route?.params]);

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Incorrect email or password. Please contact Admin if you do not have an account.');
        }
        throw error;
      }
    } catch (e: any) {
      Alert.alert('Authentication Failed', e.message);
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
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logoImage} 
            resizeMode="contain" 
          />
          <Text style={styles.logoText}>SalesFlow</Text>
          <Text style={styles.tagline}>{displayRole} Login</Text>
          <Text style={styles.taglineSub}>Premium CRM for Sales Professionals</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Mode Toggle Removed - Only Sign In Allowed */}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={colors.textMuted}
                value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="••••••••" placeholderTextColor={colors.textMuted}
                value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.submitText}>Sign In</Text>
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
    backgroundColor: colors.bg, // ensures no white flash
  },
  backBtn: {
    position: 'absolute', top: 20, left: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgPanel, alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
  logoImage: {
    width: 76, height: 76, borderRadius: 20,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
  },
  logoText: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 16, fontWeight: '700', color: colors.accent, marginTop: 4, textAlign: 'center' },
  taglineSub: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border,
  },
  modeToggle: {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderRadius: radius.md, padding: 4, marginBottom: spacing.xl,
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.bgPanel },
  modeBtnText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  modeBtnTextActive: { color: colors.textPrimary },
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
    // Ensure text is visible during browser autofill
    backgroundColor: 'transparent',
  },
  submitBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
    shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 12,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
