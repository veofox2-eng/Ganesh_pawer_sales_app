import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function SuperAdminLoginScreen() {
  const { colors, isDark } = useTheme();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const MASTER_EMAIL = 'foxsuperadmin@gmail.com';

  async function handleLogin() {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter the master password.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = MASTER_EMAIL.trim();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: {
                username: 'Super Administrator',
                role: 'Admin', // Must be 'Admin' to pass profiles table CHECK constraint
                is_enabled: true,
                approval_status: 'Approved'
              }
            }
          });

          if (signUpError) {
            if (signUpError.message.includes('already registered')) {
               throw new Error('Incorrect Master Password.');
            } else {
               throw signUpError;
            }
          }
        } else {
          throw signInError;
        }
      }
    } catch (e: any) {
      Alert.alert('Access Denied', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.content}>
          
          <View style={styles.header}>
            <View style={styles.iconWrapper}>
              <View style={styles.iconBackground}>
                <Ionicons name="shield-checkmark" size={48} color="#EF4444" />
              </View>
            </View>
            <Text style={styles.title}>Super Admin HQ</Text>
            <Text style={styles.subtitle}>
              Enter the master password to unlock the global feature control panel.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>MASTER PASSWORD</Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="••••••••" 
                placeholderTextColor={colors.textMuted}
                value={password} 
                onChangeText={setPassword} 
                secureTextEntry={!showPass} 
                autoCapitalize="none"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleLogin} 
              disabled={loading} 
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>Unlock Dashboard</Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.bg,
  },
  keyboardView: {
    flex: 1,
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 40,
    width: '100%',
  },
  iconWrapper: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBackground: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  title: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: colors.textPrimary, 
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: { 
    fontSize: 15, 
    color: colors.textSecondary, 
    textAlign: 'center', 
    lineHeight: 22, 
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgPanel,
    borderRadius: 24, 
    padding: 24,
    borderWidth: 1, 
    borderColor: colors.border,
    shadowColor: isDark ? '#000' : colors.textMuted,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 24,
    elevation: 8,
  },
  label: { 
    color: colors.textSecondary, 
    fontSize: 12, 
    fontWeight: '700', 
    marginBottom: 12, 
    textTransform: 'uppercase', 
    letterSpacing: 1.2,
  },
  inputContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: colors.bg, 
    borderRadius: 16,
    borderWidth: 1, 
    borderColor: colors.border,
    paddingHorizontal: 16, 
    marginBottom: 24,
    height: 56,
  },
  inputIcon: { 
    marginRight: 12,
  },
  input: { 
    flex: 1, 
    color: colors.textPrimary, 
    fontSize: 16, 
    height: '100%',
  },
  eyeBtn: { 
    padding: 8, 
    marginRight: -8,
  },
  submitBtn: {
    backgroundColor: '#EF4444', 
    borderRadius: 16,
    height: 56, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    elevation: 6,
  },
  submitText: { 
    color: '#FFFFFF', 
    fontWeight: '700', 
    fontSize: 16, 
    letterSpacing: 0.5,
  }
});
